/*
 * Původ: startovní patch postavy. Čisté - bez DOMu, bez Math.random.
 * apply(state, originId) vrátí patch (gold, bank, bag, standing, travel, start, intro, hearClaim…).
 * null / neznámý id = žádné efekty (staré uložené hry).
 */
(function (root, factory) {
  const dep = typeof require === "function" ? { ORIGINS: require("../data/origins.js").ORIGINS } : root.LOM;
  const api = factory(dep.ORIGINS);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Origin: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function (ORIGINS) {
  const clampStanding = (n) => Math.max(-2, Math.min(2, n | 0));

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

  /**
   * @returns {{ origin, standing, gold?, bank?, bag?, travel?, start?, intro?, hearClaim?, effectsLine? }}
   */
  function apply(state, originId) {
    const o = originId && ORIGINS[originId];
    if (!o) {
      return { origin: null, standing: cleanStanding(state && state.standing) };
    }
    const standing = cleanStanding(o.standing);
    const bag = putInBag((state && state.bag) || [], o.item);
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

  return { apply, def, cleanStanding, effectsText, greetPool, ORIGINS };
});
