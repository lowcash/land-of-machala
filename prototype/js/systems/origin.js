/*
 * Původ: startovní patch postavy. Čisté - bez DOMu, bez Math.random.
 * apply(state, originId) vrátí patch (gold, bank, bag, standing, travel, start, intro, hearClaim…).
 * startKit(picks) = výbava a batoh z voleb prologu (živnost, reakce na zvon, původ).
 * null / neznámý id = žádné efekty (staré uložené hry).
 */
(function (root, factory) {
  const dep = typeof require === "function" ? { ORIGINS: require("../data/origins.js").ORIGINS } : root.LOM;
  const api = factory(dep.ORIGINS);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Origin: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function (ORIGINS) {
  const clampStanding = (n) => Math.max(-2, Math.min(2, n | 0));
  const EQUIP_SLOTS = ["weapon", "shield", "head", "shoulders", "body", "hands", "wrists", "legs", "feet", "neck", "trinket"];

  function cleanStanding(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = clampStanding(v);
    }
    return out;
  }

  /** Vloží id do prvního volného slotu batohu; při plném nic nedělá. */
  function putInBag(bag, itemId) {
    if (!itemId || !Array.isArray(bag)) return bag;
    const next = bag.slice();
    const i = next.findIndex((x) => x == null);
    if (i >= 0) next[i] = itemId;
    return next;
  }

  function emptyEquipped() {
    return Object.fromEntries(EQUIP_SLOTS.map((k) => [k, null]));
  }

  /**
   * Výchozí gear z prologu: co hráč zmíní / udělá, to má u sebe.
   * @param {{ classId?: string|null, originId?: string|null, react?: string|null, hasClass?: boolean }} opts
   * @returns {{ equipped: object, bagAdd: string[] }}
   */
  function startKit(opts = {}) {
    const classId = opts.classId || null;
    const originId = opts.originId || null;
    const react = opts.react || null;
    const hasClass = opts.hasClass !== false && !!classId;
    const equipped = emptyEquipped();
    const bagAdd = [];

    equipped.body = "tunic";
    if (!hasClass) {
      equipped.weapon = "stick";
    } else if (classId === "tracker") {
      equipped.weapon = "axe";
      bagAdd.push("ration");
    } else if (classId === "mercenary") {
      equipped.weapon = "wood_sword";
      equipped.wrists = "bracers";
    } else if (classId === "chanter") {
      equipped.weapon = "stick";
      bagAdd.push("herbs");
      bagAdd.push("potion");
    } else if (classId === "legist") {
      equipped.weapon = "stick";
      bagAdd.push("quill");
      bagAdd.push("ration");
    } else {
      equipped.weapon = "stick";
    }

    if (react === "ward") equipped.neck = "amulet";
    if (react === "fight") equipped.feet = "boots";
    if (react === "hide") bagAdd.push("ration");

    if (originId === "apprentice") equipped.hands = "gloves";
    if (originId === "exile") equipped.shoulders = "cloak";
    if (originId === "wayfarer") {
      if (!equipped.feet) equipped.feet = "boots";
      equipped.shoulders = equipped.shoulders || "cloak";
      bagAdd.push("ration");
    }
    if (originId === "watchman") {
      equipped.head = "cap";
      equipped.shield = "buckler";
    }
    if (originId === "native") bagAdd.push("ration");
    if (originId === "debtor") bagAdd.push("daisy");

    return { equipped, bagAdd };
  }

  /**
   * @returns {{ origin, standing, gold?, bank?, bag?, travel?, start?, intro?, hearClaim?, effectsLine? }}
   */
  function apply(state, originId) {
    const o = originId && ORIGINS[originId];
    if (!o) {
      return { origin: null, standing: cleanStanding(state && state.standing) };
    }
    const standing = cleanStanding(o.standing);
    /* věc z dat původu do batohu jen když není zároveň ve výbavě (startKit) */
    let bag = (state && state.bag) || [];
    if (o.item) bag = putInBag(bag, o.item);
    const energyMax = ((state && state.travel && state.travel.energyMax) || 14) + (o.energyBonus || 0);
    const energy = Math.min(energyMax, (state && state.travel && state.travel.energy) || energyMax);
    return {
      origin: o.id,
      standing,
      gold: o.gold,
      bank: o.bank,
      bag,
      travel: { energy, energyMax },
      start: o.start,
      intro: o.intro,
      hearClaim: o.hearClaim || null,
      effectsLine: o.effectsLine || "",
      greet: o.greet || {},
    };
  }

  function def(id) {
    return ORIGINS[id] || null;
  }

  /** Čitelný řádek efektů z dat (UI). */
  function effectsText(id) {
    const o = ORIGINS[id];
    return o ? o.effectsLine || o.blurb : "";
  }

  /**
   * Pool uvítání: z původu jen při první návštěvě (`visits === 0`), jinak běžný fallback.
   * `visits` = po inkrementu v goto-place (první vstup = 0).
   */
  function greetPool(placeKey, originId, visits, fallback) {
    const o = originId && ORIGINS[originId];
    if (visits === 0 && o && o.greet && o.greet[placeKey]) return o.greet[placeKey];
    return fallback || [];
  }

  return { apply, startKit, def, cleanStanding, effectsText, greetPool, ORIGINS };
});
