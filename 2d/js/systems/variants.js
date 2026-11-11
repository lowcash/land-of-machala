/*
 * Varianty vět: kdekoli je text, smí být místo řetězce pole řetězců. Výběr je čistá funkce (seed, klíč, pořadí),
 * bez Math.random a bez DOMu. Varianta se nikdy neopakuje dvakrát po sobě; jedna položka nebo řetězec se vrátí beze změny.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Variants: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  /** Hash (seed, klíč, n) → uint32. */
  function hash(seed, key, n) {
    let h = (seed ^ 0x9e3779b9) >>> 0;
    const s = `${key}|${n}`;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d) >>> 0;
    h ^= h >>> 12;
    return h >>> 0;
  }

  /** Index varianty při n-tém použití (n od 0): první podle seedu, každá další se liší od předchozí. */
  function indexFor(len, seed, key, n) {
    if (len <= 1) return 0;
    let idx = hash(seed, key, 0) % len;
    for (let i = 1; i <= n; i++) idx = (idx + 1 + (hash(seed, key, i) % (len - 1))) % len;
    return idx;
  }

  /** text: řetězec | pole řetězců. Vrací jeden řetězec. */
  function pick(text, seed, key, n = 0) {
    if (!Array.isArray(text)) return text;
    if (!text.length) return "";
    return text[indexFor(text.length, seed >>> 0, key, Math.max(0, n | 0))];
  }

  return { pick, indexFor, hash };
});
