/* Hesla Kodexu (prolog): hráč se učí slova při prvním výskytu (tooltip). Bez tajemství. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  /**
   * { id, term, forms[], short, more?, kind }
   * forms = skloňované tvary pro hledání v textu (včetně 1. pádu).
   * kind: place | title | office | trade | custom | lore
   */
  const KODEX = [
    {
      id: "pisar",
      term: "písař",
      forms: ["písař", "písaře", "písaři", "písařem", "písaři", "písařů"],
      short: "Píše, co se má. Odpoví jen na otázku, kterou jsi položil.",
      kind: "office",
    },
    {
      id: "zdejsi",
      term: "Zdejší",
      forms: ["Zdejší", "Zdejších", "Zdejším", "Zdejšími"],
      short: "Ves za hradbami. Klidnější než město, dokud nepřijdou vlci nebo fámy. Ves i lid.",
      kind: "place",
    },
    {
      id: "korbel",
      term: "korbel",
      forms: ["korbel", "korbelu", "korbellem", "korbely", "korbelů"],
      short: "Džbánek nebo hrnek na pití.",
      kind: "lore",
    },
    {
      id: "krcma",
      term: "krčma",
      forms: ["krčma", "krčmy", "krčmě", "krčmu", "krčmou"],
      short: "Menší hospoda: pivo, drby, lavice.",
      kind: "place",
    },
    {
      id: "pijan",
      term: "pijan",
      forms: ["pijan", "pijana", "pijanovi", "pijanem", "pijani", "pijanů"],
      short: "Kdo pije často a dlouho.",
      kind: "lore",
    },
    {
      id: "zanadri",
      term: "záňadří",
      forms: ["záňadří", "záňadřím"],
      short: "Místo za pásem / u pasu.",
      kind: "lore",
    },
    {
      id: "herdek",
      term: "herdek",
      forms: ["herdek", "Herdek"],
      short: "Staré zaklení (z německého Herr Gott); zhruba „proboha“ nebo „panebože“.",
      kind: "lore",
    },
    {
      id: "na-sekeru",
      term: "na sekeru",
      forms: ["na sekeru", "na\u00A0sekeru", "sekeru"],
      short: "Zápis na dluh (úvěr): platíš později, ne hned.",
      kind: "trade",
    },
    {
      id: "kamsi",
      term: "kamsi",
      forms: ["kamsi"],
      short: "Starší „někam“: směr neurčitý, oči bloudí, člověk neví přesně kam.",
      kind: "lore",
    },
  ];

  const KODEX_BY = Object.fromEntries(KODEX.map((e) => [e.id, e]));

  return { KODEX, KODEX_BY };
});
