/* Seedovaná náhoda (mulberry32). Pravidla berou `rng` jako parametr - žádné Math.random v systems/. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createRng(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      chance: (p) => next() < p,
      int: (n) => Math.floor(next() * n),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      /** weights: { key: w } → key */
      weighted(weights) {
        const keys = Object.keys(weights);
        const total = keys.reduce((s, k) => s + weights[k], 0);
        let r = next() * total;
        for (const k of keys) {
          r -= weights[k];
          if (r < 0) return k;
        }
        return keys[keys.length - 1];
      },
    };
  }
  return { createRng };
});
