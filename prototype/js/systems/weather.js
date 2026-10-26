/*
 * Počasí a stavy `mokrý` / `prochladlý` (pravidla: docs/reference/weather.md).
 * Čisté funkce bez DOMu a bez Math.random; počasí dne je deterministické ze seedu. Žádné napojení na UI ani boj zatím
 * (modifikátory vrací `modifiers`, aplikuje je integrace). Čísla jsou ladicí, vše v `TUNE`.
 * Stav: { wet, chill } celá čísla 0..3. Výbava: kusy s volitelnými poli `warmth` (0–2), `rain` (0–2), `metal` (bool).
 * Zásada: žádný grind (stupeň se mění jen při kroku času/cesty), stav mění možnosti, ne zákazy, oheň a střecha vždy pomůžou.
 */
(function (root, factory) {
  const hash = (typeof require === "function" ? require("./variants.js") : root.LOM.Variants).hash;
  const api = factory(hash);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Weather: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function (hash) {
  const TUNE = {
    maxStage: 3,
    gearCap: 3, // strop součtu `warmth` a `rain` přes sloty
    weights: { clear: 4, overcast: 3, rain: 2, fog: 1 }, // váhy počasí dne (první počasí: déšť a mlha)
    cold: { clear: 0, overcast: 0, rain: 1, fog: 1 }, // základní chlad počasí (0–2)
    night: 1, // noc (tik ≥ nightStart) přidá chlad
    nightStart: 12,
    rainPower: 3, // kolik stupňů vlhka dá déšť bez výbavy (výbavové `rain` ho snižuje)
    fogPower: 1, // mlha: jen vlhko bez nepromokavé výbavy
    metalPieces: 2, // tolik kovových kusů navíc chladí za chladu nebo mokra
    wetChill: 1, // mokrý (≥ 2) přidá chlad
    maxWetStep: 2, // nejvýš tolik stupňů vlhka za jeden krok (úsek cesty)
    maxChillStep: 1, // chlad roste pomaleji než vlhko: nejvýš o stupeň za krok
    flee: { rain: -0.1, fog: 0.1 }, // úprava šance útěku v boji podle počasí
    travelMult: { 2: 1.25, 3: 1.25 }, // násobek délky úseku podle `chill`
    /* modifikátory podle stupně (sčítají se; strop −2 na veličinu) */
    chillMods: { 2: { dex: -1, perception: -1 }, 3: { dex: -1, perception: -1 } },
    /* v boji: ATK/DEF −1 by u slabších povolání zničilo výhry (sim.js: zaříkávač × vlk 88 % → 23 %), proto ztuhlost = −10 % max. HP na začátku boje (88 % → 75 %) */
    chillHpMalus: { 3: 0.1 },
    wetMods: { 2: { grip: -1 }, 3: { grip: -1 } }, // `grip`: činnosti na suché ruce
    modFloor: -2,
  };
  const LABELS = {
    wet: ["suchý", "vlhký", "mokrý", "promoklý"],
    chill: ["v pohodě", "chladno", "zima", "mrazí"],
  };
  /* věta o počasí pro UI: hráč počasí vidí VŽDY (autor 2026-10-26), v textu; v obraze přes okno */
  const TEXT = {
    clear: ["Venku je jasno.", "Venku je jasná noc."],
    overcast: ["Obloha je zatažená.", "Noc je zatažená a bez hvězd."],
    rain: ["Venku prší.", "V noci prší."],
    fog: ["Venku leží mlha.", "V noci leží mlha."],
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const newState = () => ({ wet: 0, chill: 0 });

  /** Počasí dne (deterministické): { kind }. */
  function weatherFor(seed, day) {
    const kinds = Object.keys(TUNE.weights);
    const total = kinds.reduce((s, k) => s + TUNE.weights[k], 0);
    let r = hash(seed >>> 0, "weather", day) % total;
    for (const k of kinds) {
      if ((r -= TUNE.weights[k]) < 0) return { kind: k };
    }
    return { kind: kinds[0] };
  }

  /** Chlad počasí v daném tiku (0–3). */
  function coldAt(kind, tick) {
    return (TUNE.cold[kind] || 0) + (tick >= TUNE.nightStart ? TUNE.night : 0);
  }

  /** Souhrn výbavy: { warmth, rain, metal } (součty s ohraničením, počet kovových kusů). */
  function gearScore(items) {
    let warmth = 0, rain = 0, metal = 0;
    for (const it of items || []) {
      if (!it) continue;
      warmth += it.warmth || 0;
      rain += it.rain || 0;
      if (it.metal) metal += 1;
    }
    return { warmth: Math.min(warmth, TUNE.gearCap), rain: Math.min(rain, TUNE.gearCap), metal };
  }

  /**
   * Jeden krok času (úsek cesty nebo blok tiků). ctx: { kind, tick, gear (z gearScore), where: "outside" | "roof" | "fire" }.
   * outside: déšť a mlha zvyšují `wet` (výbavové `rain` ho snižuje), chlad zvyšuje `chill` (výbavové `warmth` ho snižuje).
   * roof: schne (wet −1), chlad se jen zastaví. fire: wet −2, chill −2 (místo u ohně: odměna, ne trest).
   */
  function step(state, ctx) {
    const s = { wet: state.wet, chill: state.chill };
    const g = ctx.gear || { warmth: 0, rain: 0, metal: 0 };
    if (ctx.where === "fire") {
      s.wet -= 2;
      s.chill -= 2;
    } else if (ctx.where === "roof") {
      s.wet -= 1;
      const cold = coldAt(ctx.kind, ctx.tick) - 1; // pod střechou o stupeň tepleji
      if (cold - g.warmth <= 0) s.chill -= 1;
    } else {
      const power = ctx.kind === "rain" ? TUNE.rainPower : ctx.kind === "fog" ? TUNE.fogPower : 0;
      s.wet += clamp(power - g.rain, 0, TUNE.maxWetStep);
      const cold = coldAt(ctx.kind, ctx.tick);
      const metal = g.metal >= TUNE.metalPieces && (cold > 0 || s.wet >= 1) ? 1 : 0;
      const gain = cold + (s.wet >= 2 ? TUNE.wetChill : 0) + metal - g.warmth;
      s.chill += clamp(gain, 0, TUNE.maxChillStep);
    }
    return { wet: clamp(s.wet, 0, TUNE.maxStage), chill: clamp(s.chill, 0, TUNE.maxStage) };
  }

  /** Modifikátory ze stavu a počasí: { dex, perception, atk, def, grip, hpMalus, travelMult, flee, needsRelief }. */
  function modifiers(state, kind) {
    const m = { dex: 0, perception: 0, atk: 0, def: 0, grip: 0 };
    for (const tbl of [TUNE.chillMods[state.chill], TUNE.wetMods[state.wet]]) {
      for (const [k, v] of Object.entries(tbl || {})) m[k] += v;
    }
    for (const k of Object.keys(m)) m[k] = Math.max(TUNE.modFloor, m[k]);
    return Object.assign(m, {
      hpMalus: TUNE.chillHpMalus[state.chill] || 0, // podíl max. HP, o který boj začíná níž
      travelMult: TUNE.travelMult[state.chill] || 1,
      flee: TUNE.flee[kind] || 0,
      needsRelief: state.chill >= TUNE.maxStage, // nabídne se zimnice a cesta ven (oheň, hostinec, odvar)
    });
  }

  /** Věta o počasí pro daný tik (den / noc od `nightStart`). */
  const describe = (kind, tick) => (TEXT[kind] || TEXT.clear)[tick >= TUNE.nightStart ? 1 : 0];

  const label = (axis, stage) => LABELS[axis][clamp(stage, 0, TUNE.maxStage)];

  return { TUNE, LABELS, newState, weatherFor, coldAt, gearScore, step, modifiers, label, describe };
});
