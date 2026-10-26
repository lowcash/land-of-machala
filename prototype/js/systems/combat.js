/*
 * Boj 1v1 - pravidla bez DOMu a časovačů. `c` se mění na místě; náhoda jen přes `rng`.
 * Záměr nepřítele má 3 vrstvy: trueIntent (skutečný) · hint (co hráč vidí) · readChance (jak moc věřit).
 */
(function (root, factory) {
  const dep = (name, path) => (typeof require === "function" ? require(path) : root.LOM)[name];
  const api = factory(dep("ENEMIES", "../data/enemies.js"));
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (ENEMIES) {
  const INTENTS = ["heavy", "quick", "guard"];
  const COST = { heavy: 4, special: 6 };
  const GAIN = { guard: 2, evade: 1, observe: 1 };
  /* násobek příchozího poškození: [akce hráče][záměr nepřítele] */
  const INCOMING = {
    guard: { heavy: 0.35, quick: 0.55, guard: 0.5 },
    evade: { heavy: 0.7, quick: 0.4, guard: 1 },
    quick: { heavy: 0.6, quick: 1, guard: 1 },
    observe: { heavy: 0.85, quick: 0.85, guard: 0.85 },
  };
  /* na co se nepřítel přizpůsobí, když hráč opakuje akci */
  const COUNTER = { heavy: "guard", quick: "heavy", guard: "quick", evade: "heavy", special: "guard" };

  /* Ladicí konstanty - upravuje sim/tune; hodnoty ověřené `node js/sim.js`. */
  const TUNE = {
    quickDmg: 0.48, quickPlus: 1, quickHit: 0.75,
    heavyDmg: 0.96, heavyPlus: 2, heavyHit: 0.56,
    specialDmg: 0.8,
    enemyDmg: 1, enemyHp: 1,
    riposte: 0.46, // správná reakce (obrana vs těžký, úhyb vs rychlý) vrátí část úderu
    surrenderMinPlayerHp: 0.4, // nepřítel se vzdá, jen když má hráč aspoň tento podíl max. HP (jinak zuří)
    desperateHeavy: 0.2, // váha těžkého úderu navíc u zuřícího nepřítele - ladit
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* síla speciálu podle povolání: pacholek zbraň, dřevorubec obratnost, bylinkář intelekt, písař slabší intelekt */
  function specialPower(p) {
    if (p.classId === "chanter") return Math.max(p.atk, p.int * 1.3);
    if (p.classId === "tracker") return Math.max(p.atk, p.dex * 1.45);
    if (p.classId === "legist") return Math.max(p.atk, p.int * 1.1);
    return p.atk;
  }

  function createCombat({ enemyId, player, items = {}, familiarity = 0, rng, weatherFlee = 0 }) {
    const e = ENEMIES[enemyId];
    if (!e) throw new Error(`Neznámý nepřítel: ${enemyId}`);
    const c = {
      enemyId,
      enemyName: e.name,
      enemyLevel: e.level,
      enemyType: e.type,
      enemyHp: Math.round(e.hp * TUNE.enemyHp),
      enemyMax: Math.round(e.hp * TUNE.enemyHp),
      enemyAtk: e.dmg.heavy,
      enemyDef: e.def,
      hp: player.hp,
      hpMax: player.hpMax,
      res: player.res,
      resMax: player.resMax,
      p: { atk: player.atk, def: player.def, dex: player.dex, int: player.int, classId: player.classId },
      items: { heal: items.heal || 0, foresight: items.foresight || 0 },
      familiarity: clamp(familiarity, 0, 0.15),
      fleeBonus: 0,
      weatherFlee: clamp(weatherFlee, -0.3, 0.3), // počasí (systems/weather.js): déšť −, mlha +; trvalé po celý boj
      readBonus: 0, // jednorázově (pozorování)
      foresightTurns: 0,
      history: [],
      turn: 1,
      over: false,
      result: null,
      offer: null,
      desperate: false,
    };
    rollIntent(c, rng);
    return c;
  }

  function readChance(c) {
    const e = ENEMIES[c.enemyId];
    const base = 0.3 + 0.04 * c.p.int + c.familiarity + c.readBonus + (c.foresightTurns > 0 ? 0.4 : 0);
    const eff = clamp(base, 0.15, 0.9) * (1 - (e.tactics.feint || 0));
    return clamp(eff, 0.15, 0.9);
  }

  function confidenceLabel(p) {
    return p >= 0.75 ? "jistě" : p >= 0.5 ? "tuším" : "nejasné";
  }

  /* morálka nepřítele na konci sil: 'surrender' (nabídne vzdání) · 'desperate' (hráč je slabý, tlačí na pilu) · null */
  function morale(c) {
    const e = ENEMIES[c.enemyId];
    if (!e.surrenderAt || c.enemyHp / c.enemyMax > e.surrenderAt) return null;
    return c.hp / c.hpMax >= TUNE.surrenderMinPlayerHp ? "surrender" : "desperate";
  }

  function chooseIntent(c, rng) {
    const e = ENEMIES[c.enemyId];
    const w = { ...e.tactics.weights };
    if (morale(c) === "desperate") w.heavy += TUNE.desperateHeavy;
    if (c.enemyHp / c.enemyMax < 0.35) w.guard += 0.25;
    if (c.hp / c.hpMax < 0.4) w.heavy += 0.2;
    const last = c.history.slice(-2);
    if (e.tactics.adapt && last.length === 2 && last[0].action === last[1].action && COUNTER[last[0].action]) {
      w[COUNTER[last[0].action]] += e.tactics.adapt;
    }
    return rng.weighted(w);
  }

  function rollIntent(c, rng) {
    c.trueIntent = chooseIntent(c, rng);
    const p = readChance(c);
    const right = rng.chance(p);
    const shown = right ? c.trueIntent : rng.pick(INTENTS.filter((i) => i !== c.trueIntent));
    c.readChance = p;
    c.hint = { id: shown, confidence: confidenceLabel(p), p };
    c.readBonus = 0;
    if (c.foresightTurns > 0) c.foresightTurns -= 1;
  }

  function availableActions(c) {
    const out = [];
    const add = (id, enabled, reason) => out.push({ id, enabled, reason: enabled ? null : reason, cost: COST[id] || 0, gain: GAIN[id] || 0 });
    for (const id of ["quick", "heavy", "special"]) {
      const cost = COST[id] || 0;
      add(id, c.res >= cost, "Málo zdroje.");
    }
    for (const id of ["guard", "evade", "observe"]) add(id, true);
    add("potion", c.items.heal > 0, "Nemáš odvar.");
    add("foresight", c.items.foresight > 0, "Nemáš odvar předtuchy.");
    add("flee", true);
    if (c.offer === "surrender") add("spare", true);
    return out;
  }

  function playerStrike(c, action, rng, events) {
    const e = ENEMIES[c.enemyId];
    const p = c.p;
    const intent = c.trueIntent;
    let hit = 1;
    let dmg;
    if (action === "special") {
      dmg = Math.round(specialPower(p) * TUNE.specialDmg);
    } else {
      hit = (action === "quick" ? TUNE.quickHit : TUNE.heavyHit) + p.dex * 0.01;
      dmg = action === "quick" ? Math.round(p.atk * TUNE.quickDmg) + TUNE.quickPlus : Math.round(p.atk * TUNE.heavyDmg) + TUNE.heavyPlus;
      if (action === "quick" && intent === "heavy") hit += 0.1;
      if (action === "heavy" && intent === "quick") hit += 0.15;
      if (action === "heavy" && intent === "guard") dmg += 4;
      if (action === "quick" && intent === "guard") dmg = Math.max(1, dmg - 3);
      dmg = Math.max(1, dmg - Math.floor(e.def * 0.5));
    }
    hit = clamp(hit, 0.05, 0.95);
    if (action === "special" || rng.chance(hit)) {
      c.enemyHp = Math.max(0, c.enemyHp - dmg);
      events.push({ t: "hit", action, dmg, intent });
    } else {
      events.push({ t: "miss", action, intent });
    }
  }

  function enemyStrike(c, action, events) {
    const e = ENEMIES[c.enemyId];
    const intent = c.trueIntent;
    let dmg = Math.round(e.dmg[intent] * TUNE.enemyDmg) - Math.floor(c.p.def * 0.35);
    const mult = (INCOMING[action] || {})[intent] ?? 1;
    dmg = Math.max(1, Math.round(dmg * mult));
    c.hp = Math.max(0, c.hp - dmg);
    events.push({ t: "enemy_hit", intent, dmg, reduced: mult < 1, action });
  }

  /**
   * Jeden tah hráče. Vrací { ok, reason?, events }. Neplatná akce tah nespotřebuje.
   * Konec boje nastaví c.over / c.result ('win' | 'lose' | 'flee' | 'spare').
   */
  function resolveTurn(c, action, rng) {
    const events = [];
    if (c.over) return { ok: false, reason: "Boj skončil.", events };
    const def = availableActions(c).find((a) => a.id === action);
    if (!def) return { ok: false, reason: "Neznámá akce.", events };
    if (!def.enabled) return { ok: false, reason: def.reason, events };

    if (action === "spare") {
      c.over = true;
      c.result = "spare";
      events.push({ t: "spare" });
      return { ok: true, events };
    }

    c.res = clamp(c.res - (COST[action] || 0) + (GAIN[action] || 0), 0, c.resMax);
    let playerMit = action;

    if (action === "flee") {
      const chance = clamp(0.35 + c.fleeBonus + c.weatherFlee + c.p.dex * 0.02, 0.05, 0.9);
      if (rng.chance(chance)) {
        c.over = true;
        c.result = "flee";
        events.push({ t: "flee_ok" });
        return { ok: true, events };
      }
      c.fleeBonus = 0;
      events.push({ t: "flee_fail" });
      playerMit = null;
    } else if (action === "potion") {
      c.items.heal -= 1;
      const heal = 14;
      const before = c.hp;
      c.hp = Math.min(c.hpMax, c.hp + heal);
      events.push({ t: "heal", amount: c.hp - before });
      playerMit = null;
    } else if (action === "foresight") {
      c.items.foresight -= 1;
      c.foresightTurns = 5;
      events.push({ t: "foresight" });
      playerMit = null;
    } else if (action === "evade") {
      c.fleeBonus = 0.3;
      events.push({ t: "evade" });
    } else if (action === "guard") {
      events.push({ t: "guard" });
    } else if (action === "observe") {
      c.readBonus = 0.5;
      events.push({ t: "observe" });
    } else {
      playerStrike(c, action, rng, events);
    }

    if (c.enemyHp <= 0) {
      c.over = true;
      c.result = "win";
      c.history.push({ action, intent: c.trueIntent });
      events.push({ t: "win" });
      return { ok: true, events };
    }

    const mor = morale(c);
    if (mor === "surrender" && !c.offer) {
      c.offer = "surrender";
      events.push({ t: "surrender_offer" });
    } else if (mor === "desperate" && !c.desperate) {
      c.desperate = true; // událost jen jednou za boj
      events.push({ t: "desperate" });
    }

    enemyStrike(c, playerMit, events);
    c.history.push({ action, intent: c.trueIntent });

    if (c.hp <= 0) {
      c.over = true;
      c.result = "lose";
      events.push({ t: "lose" });
      return { ok: true, events };
    }

    if ((action === "guard" && c.trueIntent === "heavy") || (action === "evade" && c.trueIntent === "quick")) {
      const dmg = Math.max(1, Math.round(c.p.atk * TUNE.riposte) - Math.floor(ENEMIES[c.enemyId].def * 0.5));
      c.enemyHp = Math.max(0, c.enemyHp - dmg);
      events.push({ t: "riposte", dmg });
      if (c.enemyHp <= 0) {
        c.over = true;
        c.result = "win";
        events.push({ t: "win" });
        return { ok: true, events };
      }
    }

    c.turn += 1;
    rollIntent(c, rng);
    events.push({ t: "next_intent", hint: c.hint, readChance: c.readChance });
    return { ok: true, events };
  }

  /** Přepadení: nepřítel udeří první (hráč se nebrání). Může hráče porazit. */
  function ambush(c, rng) {
    const events = [];
    enemyStrike(c, null, events);
    if (c.hp <= 0) {
      c.over = true;
      c.result = "lose";
      events.push({ t: "lose" });
      return events;
    }
    rollIntent(c, rng);
    events.push({ t: "next_intent", hint: c.hint, readChance: c.readChance });
    return events;
  }

  /** Odměna podle výsledku. spare = méně zlata/XP, bez kořisti. */
  function rewardsFor(c, rng) {
    const e = ENEMIES[c.enemyId];
    if (c.result !== "win" && c.result !== "spare") return { gold: 0, xp: 0, loot: [] };
    const [lo, hi] = e.reward.gold;
    const gold = lo + rng.int(hi - lo + 1);
    if (c.result === "spare") return { gold: Math.floor(gold / 2), xp: Math.floor(e.reward.xp * 0.7), loot: [] };
    const loot = e.reward.loot.filter((l) => rng.chance(l.p)).map((l) => l.id);
    return { gold, xp: e.reward.xp, loot };
  }

  return { TUNE, INCOMING, COUNTER, INTENTS, COST, GAIN, createCombat, resolveTurn, ambush, availableActions, rewardsFor, readChance };
});
