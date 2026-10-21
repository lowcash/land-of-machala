/*
 * Mapa 7×7 — jediný zdroj pravdy (docs/reference/map.md se z něj generuje).
 * GRID: řádky y=6 … y=0 (sever nahoře). POI: město, Lada, kaple, tábor (kauza).
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
    town: { cell: [3, 3], label: "Machala" },
    village: { cell: [3, 0], label: "Lada" },
    chapel: { cell: [4, 4], label: "Kaple u cesty" },
    camp: { cell: [5, 6], label: "Tábor zbojníků" },
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

  function terrainAt(x, y) {
    if (x < 0 || y < 0 || x > MAP_MAX || y > MAP_MAX) return null;
    return GRID[MAP_MAX - y][x];
  }

  function cellLabel(x, y) {
    const t = terrainAt(x, y);
    if (t === "town") return POI.town.label;
    if (x === POI.village.cell[0] && y === POI.village.cell[1]) return POI.village.label;
    if (t === "chapel") return POI.chapel.label;
    return TERRAIN_CS[t] || "Kraj";
  }

  return { MAP_SIZE, MAP_MAX, GRID, POI, TERRAIN_CS, TERRAIN_BG, terrainAt, cellLabel };
});
