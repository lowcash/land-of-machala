const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../data/map.js");
const { KAUZY } = require("../data/kauzy.js");
const { QUESTS } = require("../data/quests.js");
const W = require("../systems/world.js");

/* Referenční tabulka z původního terrainAt v app.js (jednorázově zafixovaná). */
const REF = [
  /* y=0 */ ["hills", "plains", "plains", "village", "plains", "plains", "hills"],
  /* y=1 */ ["plains", "road", "road", "road", "road", "plains", "plains"],
  /* y=2 */ ["plains", "road", "road", "road", "road", "road", "plains"],
  /* y=3 */ ["plains", "road", "road", "town", "road", "road", "plains"],
  /* y=4 */ ["plains", "road", "road", "road", "chapel", "plains", "plains"],
  /* y=5 */ ["plains", "plains", "forest", "forest", "road", "plains", "plains"],
  /* y=6 */ ["hills", "hills", "forest", "forest", "plains", "hills", "hills"],
];

test("mapa: 7×7 bez děr; terrainAt bit po bitu jako REF", () => {
  assert.equal(M.MAP_SIZE, 7);
  assert.equal(M.MAP_MAX, 6);
  assert.equal(M.terrainAt(-1, 0), null);
  assert.equal(M.terrainAt(0, 7), null);
  for (let y = 0; y <= M.MAP_MAX; y++) {
    for (let x = 0; x <= M.MAP_MAX; x++) {
      const t = M.terrainAt(x, y);
      assert.ok(t, `díra na (${x},${y})`);
      assert.equal(t, REF[y][x], `(${x},${y})`);
    }
  }
});

test("mapa: každý terén má TERRAIN_CS a TERRAIN_BG", () => {
  const used = new Set();
  for (let y = 0; y <= M.MAP_MAX; y++) for (let x = 0; x <= M.MAP_MAX; x++) used.add(M.terrainAt(x, y));
  for (const t of used) {
    assert.ok(M.TERRAIN_CS[t], `chybí TERRAIN_CS.${t}`);
    assert.ok(M.TERRAIN_BG[t], `chybí TERRAIN_BG.${t}`);
  }
});

test("mapa: POI leží na očekávaném terénu; cellLabel", () => {
  const [tx, ty] = M.POI.town.cell;
  const [vx, vy] = M.POI.village.cell;
  const [cx, cy] = M.POI.chapel.cell;
  assert.equal(M.terrainAt(tx, ty), "town");
  assert.equal(M.terrainAt(vx, vy), "village");
  assert.equal(M.terrainAt(cx, cy), "chapel");
  assert.equal(M.cellLabel(tx, ty), "Ostrožná");
  assert.equal(M.cellLabel(vx, vy), "Zdejší");
  assert.equal(M.cellLabel(cx, cy), "Kaple u cesty");
});

test("mapa: souřadnice v kauzy.js a quests.js odpovídají POI", () => {
  const z = KAUZY.zvon;
  assert.deepEqual(z.forge.cell, M.POI.forge.cell);
  assert.deepEqual(z.cart.cell, M.POI.cart.cell);
  assert.deepEqual(z.chapel.cell, M.POI.chapel.cell);
  assert.equal(M.cellLabel(...M.POI.forge.cell), "Hutě u Jezírka");
  assert.equal(M.cellLabel(...M.POI.cart.cell), "Vůz na cestě");
  const letter = QUESTS.find((q) => q.id === "letter_to_lada");
  assert.deepEqual(letter.turnIn.cell, M.POI.village.cell);
  assert.ok(letter.objectives.some((o) => o.type === "arrive" && o.cell[0] === M.POI.village.cell[0] && o.cell[1] === M.POI.village.cell[1]));
});

test("mapa: klíče SPOT_TABLE mají terén v mapě", () => {
  const onMap = new Set();
  for (let y = 0; y <= M.MAP_MAX; y++) for (let x = 0; x <= M.MAP_MAX; x++) onMap.add(M.terrainAt(x, y));
  for (const t of Object.keys(W.SPOT_TABLE)) {
    assert.ok(onMap.has(t), `SPOT_TABLE.${t} není na mapě`);
  }
});

test("zóny: každé políčko má zónu; v bezpečné zóně nejsou bojová místa", () => {
  for (let y = 0; y <= M.MAP_MAX; y++) {
    for (let x = 0; x <= M.MAP_MAX; x++) assert.ok(M.ZONE_CS[M.zoneAt(x, y)], `zóna (${x},${y})`);
  }
  assert.equal(M.zoneAt(3, 3), "safe");
  assert.equal(M.zoneAt(3, 0), "safe");
  assert.equal(M.zoneAt(5, 6), "neutral");
  assert.equal(M.zoneAt(-1, 0), null);
  for (const seed of [1, 7, 42, 1234, 99999]) {
    for (const s of W.buildSpots(seed, M.terrainAt)) assert.notEqual(M.zoneAt(s.x, s.y), "safe", `seed ${seed}: místo v bezpečné zóně (${s.x},${s.y})`);
  }
});
