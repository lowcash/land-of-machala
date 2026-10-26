/*
 * Svět: herní čas, pevná místa setkání, postup úrovní, smrt a corpse. Čisté funkce bez DOMu; náhoda přes `rng`.
 * Čísla míst jsou výchozí odhad (docs/reference/world.md).
 */
(function (root, factory) {
  const createRng = (typeof require === "function" ? require("../rng.js") : root.LOM).createRng;
  const api = factory(createRng);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (createRng) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------- čas ---------- */
  const PHASES = [
    { id: "morning", label: "ráno", icon: "🌅" },
    { id: "noon", label: "poledne", icon: "☀" },
    { id: "afternoon", label: "odpoledne", icon: "🌤" },
    { id: "evening", label: "večer", icon: "🌇" },
    { id: "night", label: "noc", icon: "🌙" },
  ];
  const TICKS_PER_PHASE = 4;
  const TICKS_PER_DAY = PHASES.length * TICKS_PER_PHASE;
  /** Krok po mapě = 1 tik, boj = 2 tiky, spánek přeskočí na ráno. Večer a noc jsou „noc“. */
  const TIME_COST = { step: 1, fight: 2 };

  const newClock = () => ({ day: 1, tick: 2 * TICKS_PER_PHASE });
  function advanceClock(clock, ticks) {
    const t = clock.tick + ticks;
    return { day: clock.day + Math.floor(t / TICKS_PER_DAY), tick: t % TICKS_PER_DAY };
  }
  const toMorning = (clock) => ({ day: clock.day + 1, tick: 0 });
  const phaseOf = (clock) => PHASES[Math.floor(clock.tick / TICKS_PER_PHASE)];
  const isNight = (clock) => Math.floor(clock.tick / TICKS_PER_PHASE) >= 3;

  /* ---------- místa setkání ----------
   * Nic se nespawnuje za chůze: svět má pevná místa (doupě, tábor), určená semínkem. Po vyčištění se místo
   * obnoví další den. Ve dne vidíš stopy z vedlejšího políčka, v noci narazíš až na místě.
   */
  const POOLS = {
    wildlife: { wolf: 0.6, boar: 0.4 },
    bandits: { bandit: 0.9, brigand: 0.1 },
    uncanny: {}, // bez nepřátel
  };
  /* pro terén: šance na místo na jednom políčku podle doby */
  const SPOT_TABLE = {
    road: [{ p: 0.1, pool: "bandits", when: "any" }],
    plains: [{ p: 0.12, pool: "wildlife", when: "any" }],
    forest: [{ p: 0.55, pool: "wildlife", when: "any" }, { p: 0.2, pool: "uncanny", when: "night" }],
    hills: [{ p: 0.3, pool: "wildlife", when: "any" }, { p: 0.25, pool: "bandits", when: "night" }],
    chapel: [{ p: 0.6, pool: "uncanny", when: "night" }],
  };
  const SAFE_RADIUS = 1; // kolem města a vesnice nic nestojí
  const SAFE_CENTERS = [[3, 3], [3, 0]];
  const MAP_MAX = 6;

  const cellSeed = (seed, x, y) => ((seed ^ (x * 73856093) ^ (y * 19349663)) >>> 0) || 1;

  /** Postaví místa pro celou mapu. terrainAt(x,y) → terén nebo null. Stejné semínko = stejný svět. */
  function buildSpots(seed, terrainAt) {
    const out = [];
    for (let y = 0; y <= MAP_MAX; y++) {
      for (let x = 0; x <= MAP_MAX; x++) {
        const t = terrainAt(x, y);
        const rows = SPOT_TABLE[t];
        if (!rows || SAFE_CENTERS.some(([cx, cy]) => Math.abs(cx - x) <= SAFE_RADIUS && Math.abs(cy - y) <= SAFE_RADIUS)) continue;
        const rng = createRng(cellSeed(seed, x, y));
        for (const row of rows) {
          if (!rng.chance(row.p)) continue;
          const members = POOLS[row.pool];
          if (!members || !Object.keys(members).length) continue;
          out.push({ id: `${x},${y}`, x, y, terrain: t, pool: row.pool, enemyId: rng.weighted(members), when: row.when, clearedDay: null });
          break;
        }
      }
    }
    return out;
  }

  /** Je místo teď aktivní (správná doba a už se obnovilo)? */
  function spotActive(spot, clock) {
    if (spot.when === "night" && !isNight(clock)) return false;
    return spot.clearedDay == null || clock.day > spot.clearedDay;
  }
  const spotAt = (spots, x, y, clock) => spots.find((s) => s.x === x && s.y === y && spotActive(s, clock)) || null;

  /** Stopy na sousedních políčkách (jen ve dne). */
  function spotSigns(spots, x, y, clock) {
    if (isNight(clock)) return [];
    return [[0, 1], [0, -1], [1, 0], [-1, 0]]
      .map(([dx, dy]) => ({ dx, dy, spot: spotAt(spots, x + dx, y + dy, clock) }))
      .filter((s) => s.spot);
  }

  /** Semínko souboje na místě: stejné místo ve stejný den = stejný souboj. */
  const spotFightSeed = (seed, spot, day) => cellSeed(seed, spot.x * 7 + day, spot.y * 11 + 3);

  /** Šance, že obejdeš setkání (DEX). */
  const avoidChance = (dex) => clamp(0.45 + dex * 0.03, 0.1, 0.9);

  /* ---------- postup ---------- */
  const xpToNext = (level) => 50 * level;
  /* za úroveň: hlavní stat povolání +1 a VIT +1 */
  const LEVEL_GAIN = {
    mercenary: { str: 1, vit: 1 },
    tracker: { dex: 1, vit: 1 },
    chanter: { int: 1, vit: 1 },
    legist: { int: 1, vit: 1 },
  };
  /** Přičte XP, vrátí počet nových úrovní. Mění { level, xp, xpNext } na místě. */
  function gainXp(p, amount) {
    p.xp += amount;
    let gained = 0;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level += 1;
      p.xpNext = xpToNext(p.level);
      gained += 1;
    }
    return gained;
  }

  /* ---------- smrt ---------- */
  /** Základní výbava po probuzení. */
  const RESPAWN_KIT = { equipped: { weapon: "stick", body: "tunic" } };
  /** Podíl max. HP po smrti (bez slepé uličky: Dlužník s 0 zlatem). */
  const RESPAWN_HP_FRAC = 0.4;
  const respawnHp = (hpMax) => Math.max(1, Math.round((hpMax || 1) * RESPAWN_HP_FRAC));
  /**
   * Cena Ošetření: po smrti první zdarma (`freeHealAfterDeath`).
   * @returns {{ price: number, consumeFree: boolean }}
   */
  function healPriceAfterDeath(freeHealAfterDeath, basePrice) {
    if (freeHealAfterDeath) return { price: 0, consumeFree: true };
    return { price: basePrice, consumeFree: false };
  }

  /**
   * Smrt: vše, co hráč má (batoh, vybavení, měšec), jde do corpse na místě smrti.
   * Banka zůstává. Vrací { corpse, kit } - volající pak nahradí postavu základní výbavou.
   */
  function buildCorpse({ bag, equipped, gold, x, y, day }) {
    return {
      corpse: {
        x,
        y,
        day,
        gold,
        items: bag.filter(Boolean),
        equipped: Object.fromEntries(Object.entries(equipped).filter(([, id]) => id)),
      },
      kit: { equipped: { ...RESPAWN_KIT.equipped }, gold: 0 },
    };
  }

  /**
   * Vyzvednutí corpse. Zlato vždy; vybavení se nasadí do prázdného slotu, jinak do batohu; předměty do batohu.
   * Nejdřív předměty s `quest`. Co se nevejde, zůstane v corpse (vrací se `left` nebo null).
   * hooks: { tryEquip(slot,id) → bool, tryPut(id) → bool, isQuest(id) → bool }
   */
  function recoverCorpse(corpse, { tryEquip, tryPut, isQuest }) {
    const left = { ...corpse, gold: 0, items: [], equipped: {} };
    const took = { gold: corpse.gold, items: [] };
    const entries = [
      ...Object.entries(corpse.equipped).map(([slot, id]) => ({ id, slot })),
      ...corpse.items.map((id) => ({ id })),
    ].sort((a, b) => Number(!!isQuest(b.id)) - Number(!!isQuest(a.id)));
    for (const e of entries) {
      const ok = (e.slot && tryEquip(e.slot, e.id)) || tryPut(e.id);
      if (ok) took.items.push(e.id);
      else if (e.slot) left.equipped[e.slot] = e.id;
      else left.items.push(e.id);
    }
    const empty = !left.items.length && !Object.keys(left.equipped).length;
    return { took, left: empty ? null : left };
  }

  return {
    PHASES, TICKS_PER_PHASE, TICKS_PER_DAY, TIME_COST, newClock, advanceClock, toMorning, phaseOf, isNight,
    POOLS, SPOT_TABLE, SAFE_RADIUS, buildSpots, spotActive, spotAt, spotSigns, spotFightSeed, avoidChance,
    xpToNext, LEVEL_GAIN, gainXp,
    RESPAWN_KIT, RESPAWN_HP_FRAC, respawnHp, healPriceAfterDeath, buildCorpse, recoverCorpse,
  };
});
