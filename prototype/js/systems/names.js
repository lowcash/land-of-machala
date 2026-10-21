/*
 * Generátor jmen a vedlejších lidí. Čisté: bez DOMu, bez Math.random — náhoda jen přes `rng`.
 * makeName → { first, last, nick, full }; makeRegular → osobnost podle „Skládání z ničeho“.
 */
(function (root, factory) {
  const data = typeof require === "function"
    ? require("../data/names.js")
    : root.LOM;
  const api = factory(data);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Names: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function (data) {
  const {
    NAME_POOLS,
    POOL_WEIGHTS,
    SURNAMES,
    SURNAME_WEIGHTS,
    NICKNAMES,
    TICS,
    OBSESSIONS,
    SIGNALS,
    SIDES,
  } = data;

  function pickPool(rng, pool) {
    if (pool && NAME_POOLS[pool]) return pool;
    return rng.weighted(POOL_WEIGHTS);
  }

  function pickFirst(rng, poolId, gender) {
    const list = NAME_POOLS[poolId];
    const filtered = gender ? list.filter((n) => n.gender === gender) : list;
    const src = filtered.length ? filtered : list;
    return rng.pick(src);
  }

  /** České ženské tvary příjmení: Kolář → Kolářová, Tichý → Tichá, Bělohlávek → Bělohlávková. Místa (z Brodu) a otcovská (Matějů) beze změny. */
  function feminize(last) {
    if (/^(z|ze|ze\s|na|u)\s/.test(last) || /ů$/.test(last)) return last;
    if (/ý$/.test(last)) return last.slice(0, -1) + "á";
    if (/ek$/.test(last)) return last.slice(0, -2) + "ková";
    if (/ec$/.test(last)) return last.slice(0, -2) + "cová";
    if (/[aeiouyáéíóúě]$/.test(last)) return last.replace(/[aeiouyáéíóúě]$/, "") + "ová";
    return last + "ová";
  }

  function pickLast(rng) {
    const kind = rng.weighted(SURNAME_WEIGHTS);
    return rng.pick(SURNAMES[kind]);
  }

  /** Výjimka „bez -ová“: jen rodiny cizího původu (německá, jižní/východní jména), vzácně, aby šlo o zřetelný důvod. */
  const FOREIGN = { nemecka: 0.3, jizni: 0.5 };

  function formatFull(first, last, nick) {
    return nick ? `${first} „${nick}“ ${last}` : `${first} ${last}`;
  }

  /**
   * @param {object} rng createRng
   * @param {{ pool?: string, gender?: "m"|"f", used?: Set<string>, withNick?: boolean }} [opts]
   * @returns {{ first: string, last: string, nick: string, full: string, pool: string, gender: string }}
   */
  function makeName(rng, opts = {}) {
    const used = opts.used;
    const withNick = opts.withNick !== false;
    const maxTries = 80;
    for (let i = 0; i < maxTries; i++) {
      const pool = pickPool(rng, opts.pool);
      const entry = pickFirst(rng, pool, opts.gender);
      const baseLast = pickLast(rng);
      const keep = entry.gender === "f" && rng.chance(FOREIGN[pool] || 0);
      const last = entry.gender === "f" && !keep ? feminize(baseLast) : baseLast;
      const nick = withNick ? rng.pick(NICKNAMES) : "";
      const full = formatFull(entry.first, last, nick);
      if (used && used.has(full)) continue;
      if (used) used.add(full);
      return { first: entry.first, last, nick, full, pool, gender: entry.gender, foreignFamily: keep };
    }
    /* nouze: přidej číslo, ať full není prázdný ani duplicitní */
    const pool = pickPool(rng, opts.pool);
    const entry = pickFirst(rng, pool, opts.gender);
    const baseLast = pickLast(rng);
    const last = entry.gender === "f" ? feminize(baseLast) : baseLast;
    const nick = withNick ? rng.pick(NICKNAMES) : "";
    let full = formatFull(entry.first, last, nick);
    let n = 2;
    while (used && used.has(full)) {
      full = `${formatFull(entry.first, last, nick)} ${n++}`;
    }
    if (used) used.add(full);
    return { first: entry.first, last, nick, full, pool, gender: entry.gender, foreignFamily: false };
  }

  /**
   * Vedlejší postava: jméno + stálá osobnost.
   * @param {object} rng
   * @param {{ pool?: string, gender?: "m"|"f", used?: Set<string> }} [ctx]
   */
  function makeRegular(rng, ctx = {}) {
    const name = makeName(rng, ctx);
    const tic = rng.pick(TICS);
    const obsession = rng.pick(OBSESSIONS);
    const truthfulness = Math.round(rng.next() * 1000) / 1000; /* 0–1 */
    const signal = rng.pick(SIGNALS);
    const side = rng.pick(SIDES);
    const lean = rng.pick(["pos", "neg", "none"]);
    return {
      name,
      tic,
      obsession,
      truthfulness,
      signal,
      stance: { side, lean },
    };
  }

  return { makeName, makeRegular, feminize, formatFull, POOL_WEIGHTS, NAME_POOLS };
});
