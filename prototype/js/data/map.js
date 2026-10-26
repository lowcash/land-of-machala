/*
 * Mapa 7×7 - jediný zdroj pravdy (docs/reference/map.md se z něj generuje).
 * GRID: řádky y=6 … y=0 (sever nahoře). POI: město, Zdejší, kaple, hutě, vůz (kauza Zvon).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MAP_SIZE = 7;
  const MAP_MAX = MAP_SIZE - 1;

  /* řádky y=6 (sever) … y=0 (jih); sloupec = x */
  const GRID = [
    /* y=6 */ ["hills", "hills", "forest", "forest", "plains", "hills", "hills"],
    /* y=5 */ ["plains", "plains", "forest", "forest", "road", "plains", "plains"],
    /* y=4 */ ["plains", "road", "road", "road", "chapel", "plains", "plains"],
    /* y=3 */ ["plains", "road", "road", "town", "road", "road", "plains"],
    /* y=2 */ ["plains", "road", "road", "road", "road", "road", "plains"],
    /* y=1 */ ["plains", "road", "road", "road", "road", "plains", "plains"],
    /* y=0 */ ["hills", "plains", "plains", "village", "plains", "plains", "hills"],
  ];

  const POI = {
    /* Machala = oblast (záhada jména); Ostrožná = městečko; Zdejší = ves i lid. */
    town: { cell: [3, 3], label: "Ostrožná" },
    village: { cell: [3, 0], label: "Zdejší" },
    chapel: { cell: [4, 4], label: "Kaple u cesty" },
    forge: { cell: [5, 6], label: "Hutě u Jezírka" },
    cart: { cell: [4, 5], label: "Vůz na cestě" },
  };

  const TERRAIN_CS = {
    town: "Město",
    village: "Vesnice",
    road: "Cesta",
    plains: "Louky",
    forest: "Les",
    hills: "Kopce",
    chapel: "Kaple",
  };

  const TERRAIN_BG = {
    town: "city",
    village: "village",
    road: "road",
    plains: "plains",
    forest: "forest",
    hills: "hills",
    chapel: "chapel",
  };

  /* zóny: safe = žádná bojová místa, neutral = cesty a dílny (vzácné lapky), danger = divočina */
  const ZONE_BY_TERRAIN = { town: "safe", village: "safe", chapel: "safe", road: "neutral", plains: "danger", forest: "danger", hills: "danger" };
  const ZONE_CS = { safe: "bezpečná", neutral: "neutrální", danger: "nebezpečná" };
  const ZONE_POI = { forge: "neutral", cart: "neutral" };

  function terrainAt(x, y) {
    if (x < 0 || y < 0 || x > MAP_MAX || y > MAP_MAX) return null;
    return GRID[MAP_MAX - y][x];
  }

  function zoneAt(x, y) {
    const t = terrainAt(x, y);
    if (!t) return null;
    for (const [id, zone] of Object.entries(ZONE_POI)) {
      if (POI[id].cell[0] === x && POI[id].cell[1] === y) return zone;
    }
    return ZONE_BY_TERRAIN[t];
  }

  function cellLabel(x, y) {
    const t = terrainAt(x, y);
    if (t === "town") return POI.town.label;
    if (x === POI.village.cell[0] && y === POI.village.cell[1]) return POI.village.label;
    if (t === "chapel") return POI.chapel.label;
    if (x === POI.forge.cell[0] && y === POI.forge.cell[1]) return POI.forge.label;
    if (x === POI.cart.cell[0] && y === POI.cart.cell[1]) return POI.cart.label;
    return TERRAIN_CS[t] || "Kraj";
  }

  return { MAP_SIZE, MAP_MAX, GRID, POI, TERRAIN_CS, TERRAIN_BG, ZONE_CS, terrainAt, zoneAt, cellLabel };
});
