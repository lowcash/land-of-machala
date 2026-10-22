/*
 * Serializace uložené hry (prototyp, localStorage). Čisté - bez DOMu, bez Math.random.
 * Obálka: { v, savedAt, data }. Jen whitelist herních polí; UI (panely, vlákna logu, dev, cache) ne.
 * Set/Map → pole / objekt; bag smí mít null. Nikdy nevyhodí výjimku ven.
 * Klíč úložiště (pro integraci): STORAGE_KEY. Samotné čtení/zápis localStorage dělá app.js.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Save: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SAVE_VERSION = 4;
  const STORAGE_KEY = "lom.save";

  /**
   * Pole, která se ukládají. Komentář = proč ano.
   * Neukládat: panely, log/vlákna, flash, potvrzení, auth UI, weather maketa,
   * audio/prefs (lom.prefs), kodexSeen/kodexCache (jen paměť), combat (reload = konec boje),
   * placeTalkPath / kzReply / notebookNew / cellMenu (přechodný UI),
   * dev / activeScenario.
   */
  const FIELDS = {
    /* postava a postup */
    name: "jméno hráče",
    picks: "povolání, rasa a původ",
    guest: "host vs. účet (maketa)",
    originReached: "jak daleko v prologu",
    prologDone: "dokončené větve prologu",
    origin: "id původu (nebo null)",
    standing: "trvalé vztahy z původu (−2…+2)",
    freeHealAfterDeath: "první Ošetření po smrti zdarma",
    level: "úroveň",
    xp: "XP",
    xpNext: "práh další úrovně",
    hp: "trvalé HP (null = plné)",
    gold: "měšec",
    bank: "banka",
    bag: "batoh (16 slotů, id | null)",
    equipped: "výbava na sobě",
    travel: "výdrž na mapě",
    /* svět */
    mapX: "poloha X",
    mapY: "poloha Y",
    prevX: "předchozí políčko (ústup)",
    prevY: "předchozí políčko (ústup)",
    discovered: "objevená mapa",
    clock: "herní čas",
    seed: "semínko světa",
    steps: "počet hodů (worldRng)",
    spots: "pevná místa setkání (nebo null = postavit ze seedu)",
    encounter: "čekající setkání na políčku",
    corpseSkip: "vědomě nechaté tělo",
    corpses: "těla po smrti",
    stash: "úschovna",
    piles: "hromádky na mapě",
    pileSeq: "číselník uid hromádek",
    /* příběh */
    quests: "log questů",
    kauza: "stav kauzy (nebo null)",
    flags: "příznaky voleb",
    kills: "porážky podle druhu",
    /* dialog a lidé (herní, ne UI) */
    visits: "návštěvy míst (varianty vět)",
    vc: "čítače variant vět",
    placeTalkDone: "zodpovězené uzly dialogu",
    regulars: "vygenerovaní štamgasti",
    usedNames: "unikátnost jmen (Set → pole)",
    /* kontext polohy (ne panely) */
    screen: "obrazovka (combat se při načtení znormalizuje)",
    mode: "town | place | exits",
    place: "aktuální místo nebo null",
    placeView: "hub | talk | services | …",
    placeWho: "s kým mluvíš",
  };

  const FIELD_KEYS = Object.keys(FIELDS);

  /** Výchozí hodnoty chybějících polí po načtení (doplní se, nic se nevyhodí). */
  const DEFAULTS = {
    name: "",
    picks: { class: "mercenary", race: "local", origin: null },
    guest: false,
    originReached: 0,
    prologDone: { class: false, race: false, origin: false },
    origin: null,
    standing: {},
    freeHealAfterDeath: false,
    level: 1,
    xp: 0,
    xpNext: 50,
    hp: null,
    gold: 0,
    bank: 0,
    bag: Array(16).fill(null),
    equipped: {
      head: null,
      shoulders: null,
      neck: null,
      body: null,
      hands: null,
      wrists: null,
      legs: null,
      feet: null,
      weapon: null,
      shield: null,
      trinket: null,
    },
    travel: { energy: 14, energyMax: 14 },
    mapX: 3,
    mapY: 3,
    prevX: null,
    prevY: null,
    discovered: { "3,3": true },
    clock: { day: 1, tick: 4 },
    seed: 1,
    steps: 0,
    spots: null,
    encounter: null,
    corpseSkip: null,
    corpses: [],
    stash: { items: [] },
    piles: [],
    pileSeq: 0,
    quests: {},
    kauza: null,
    flags: {},
    kills: {},
    visits: {},
    vc: {},
    placeTalkDone: {},
    regulars: {},
    usedNames: [],
    screen: "town",
    mode: "town",
    place: null,
    placeView: "hub",
    placeWho: "host",
  };

  const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

  /** Hluboká kopie JSON-schopných hodnot; Set → pole; Map se neukládá (není ve whitelistu). */
  function cloneValue(v) {
    if (v === null || typeof v !== "object") return v;
    if (v instanceof Set) return Array.from(v);
    if (v instanceof Map) return Object.fromEntries(v);
    if (Array.isArray(v)) return v.map((x) => (x === null || typeof x !== "object" ? x : cloneValue(x)));
    const out = {};
    for (const k of Object.keys(v)) out[k] = cloneValue(v[k]);
    return out;
  }

  function pickData(state) {
    const data = {};
    for (const key of FIELD_KEYS) {
      if (state && Object.prototype.hasOwnProperty.call(state, key)) {
        data[key] = cloneValue(state[key]);
      }
    }
    return data;
  }

  function fillDefaults(data) {
    const out = {};
    for (const key of FIELD_KEYS) {
      if (data && data[key] !== undefined) out[key] = data[key];
      else out[key] = cloneValue(DEFAULTS[key]);
    }
    /* bag: vždy 16 slotů, chybějící = null */
    if (!Array.isArray(out.bag)) out.bag = cloneValue(DEFAULTS.bag);
    else {
      const bag = out.bag.slice(0, 16);
      while (bag.length < 16) bag.push(null);
      out.bag = bag;
    }
    return out;
  }

  /** Po načtení: usedNames pole → Set; combat obrazovka → town (combat se neukládá). */
  function revive(data) {
    const state = fillDefaults(data);
    if (Array.isArray(state.usedNames)) state.usedNames = new Set(state.usedNames);
    else if (!(state.usedNames instanceof Set)) state.usedNames = new Set();
    if (state.screen === "combat") {
      state.screen = "town";
      state.mode = state.mode === "place" ? "place" : "town";
    }
    return state;
  }

  /**
   * Validace obálky / dat. Nikdy neháže. reason: shape | version | data | bag | …
   */
  function validate(obj) {
    if (!isPlainObject(obj)) return { ok: false, reason: "shape" };
    if (typeof obj.v !== "number" || !Number.isFinite(obj.v)) return { ok: false, reason: "version" };
    if (obj.v !== SAVE_VERSION) return { ok: false, reason: "version" };
    if (!isPlainObject(obj.data)) return { ok: false, reason: "data" };
    const d = obj.data;
    if (d.bag !== undefined && !Array.isArray(d.bag)) return { ok: false, reason: "bag" };
    if (d.picks !== undefined && !isPlainObject(d.picks)) return { ok: false, reason: "picks" };
    if (d.equipped !== undefined && !isPlainObject(d.equipped)) return { ok: false, reason: "equipped" };
    if (d.clock !== undefined && !isPlainObject(d.clock)) return { ok: false, reason: "clock" };
    if (d.discovered !== undefined && !isPlainObject(d.discovered)) return { ok: false, reason: "discovered" };
    if (d.quests !== undefined && !isPlainObject(d.quests)) return { ok: false, reason: "quests" };
    if (d.flags !== undefined && !isPlainObject(d.flags)) return { ok: false, reason: "flags" };
    if (d.kills !== undefined && !isPlainObject(d.kills)) return { ok: false, reason: "kills" };
    if (d.corpses !== undefined && !Array.isArray(d.corpses)) return { ok: false, reason: "corpses" };
    if (d.piles !== undefined && !Array.isArray(d.piles)) return { ok: false, reason: "piles" };
    if (d.stash !== undefined && !isPlainObject(d.stash)) return { ok: false, reason: "stash" };
    if (d.seed !== undefined && (typeof d.seed !== "number" || !Number.isFinite(d.seed))) return { ok: false, reason: "seed" };
    if (d.mapX !== undefined && typeof d.mapX !== "number") return { ok: false, reason: "map" };
    if (d.mapY !== undefined && typeof d.mapY !== "number") return { ok: false, reason: "map" };
    return { ok: true };
  }

  /** state → JSON řetězec. opts.now = ms (testy); výchozí Date.now(). */
  function serialize(state, opts) {
    const now = opts && typeof opts.now === "number" ? opts.now : Date.now();
    const envelope = { v: SAVE_VERSION, savedAt: now, data: pickData(state) };
    return JSON.stringify(envelope);
  }

  /** text → { ok, state } | { ok: false, reason }. Nikdy neháže. */
  function deserialize(text) {
    try {
      if (typeof text !== "string" || !text) return { ok: false, reason: "json" };
      let raw;
      try {
        raw = JSON.parse(text);
      } catch (_) {
        return { ok: false, reason: "json" };
      }
      const val = validate(raw);
      if (!val.ok) return { ok: false, reason: val.reason };
      return { ok: true, state: revive(raw.data) };
    } catch (_) {
      return { ok: false, reason: "error" };
    }
  }

  return {
    SAVE_VERSION,
    STORAGE_KEY,
    FIELDS,
    FIELD_KEYS,
    DEFAULTS,
    serialize,
    deserialize,
    validate,
    pickData,
    revive,
  };
});
