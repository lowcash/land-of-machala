const test = require("node:test");
const assert = require("node:assert/strict");
const { createRng } = require("../rng.js");
const W = require("../systems/world.js");

test("čas: 20 tiků = den, spánek vede na ráno, večer a noc jsou noc", () => {
  let c = W.newClock();
  assert.equal(W.phaseOf(c).label, "odpoledne");
  assert.equal(W.isNight(c), false);
  c = W.advanceClock(c, 4);
  assert.equal(W.phaseOf(c).label, "večer");
  assert.equal(W.isNight(c), true);
  c = W.advanceClock(c, 12);
  assert.deepEqual(c, { day: 2, tick: 4 });
  assert.deepEqual(W.toMorning(c), { day: 3, tick: 0 });
});

const terrainAt = (x, y) => (y >= 5 ? "forest" : y === 3 && x === 3 ? "town" : y === 2 ? "road" : "plains");

test("místa: stejné semínko = stejný svět; kolem města nic; les hustší než louky", () => {
  const a = W.buildSpots(7, terrainAt), b = W.buildSpots(7, terrainAt);
  assert.deepEqual(a, b);
  assert.ok(!a.some((s) => Math.abs(s.x - 3) <= W.SAFE_RADIUS && Math.abs(s.y - 3) <= W.SAFE_RADIUS));
  let forest = 0, plains = 0;
  for (let seed = 1; seed <= 200; seed++) for (const s of W.buildSpots(seed, terrainAt)) (s.terrain === "forest" ? forest++ : s.terrain === "plains" && plains++);
  assert.ok(Math.abs(forest / 200 - 14 * 0.55) < 0.6, `les ${forest / 200}`);
  assert.ok(forest > plains / 4);
});

test("místo: po vyčištění se obnoví další den; noční místa jen v noci; stopy jen ve dne", () => {
  const spot = { id: "2,5", x: 2, y: 5, enemyId: "wolf", when: "any", clearedDay: null };
  const night = { id: "2,6", x: 2, y: 6, enemyId: "bandit", when: "night", clearedDay: null };
  const day1 = { day: 1, tick: 5 }, evening = { day: 1, tick: 14 };
  assert.equal(W.spotAt([spot, night], 2, 5, day1), spot);
  assert.equal(W.spotAt([spot, night], 2, 6, day1), null);
  assert.equal(W.spotAt([spot, night], 2, 6, evening), night);
  spot.clearedDay = 1;
  assert.equal(W.spotAt([spot], 2, 5, evening), null);
  assert.equal(W.spotAt([spot], 2, 5, { day: 2, tick: 0 }), spot);
  assert.equal(W.spotSigns([spot], 2, 4, { day: 2, tick: 1 }).length, 1);
  assert.equal(W.spotSigns([spot], 2, 4, { day: 2, tick: 15 }).length, 0);
});

test("úroveň: XP přeteče do další úrovně, zbytek zůstane", () => {
  const p = { level: 1, xp: 40, xpNext: 50 };
  assert.equal(W.gainXp(p, 120), 2); // 160: -50 → L2 (xpNext 100) → -100 → L3 (150), zbytek 10
  assert.deepEqual(p, { level: 3, xp: 10, xpNext: 150 });
});

test("smrt: vše jde do corpse, základní výbava, banka mimo", () => {
  const { corpse, kit } = W.buildCorpse({ bag: ["axe", null, "potion"], equipped: { weapon: "ladle", head: null, body: "tunic" }, gold: 80, x: 2, y: 5, day: 1 });
  assert.deepEqual(corpse.items, ["axe", "potion"]);
  assert.deepEqual(corpse.equipped, { weapon: "ladle", body: "tunic" });
  assert.equal(corpse.gold, 80);
  assert.deepEqual(kit.equipped, { weapon: "stick", body: "tunic" });
});

test("respawn: 40 % max HP; Ošetření po smrti jednou zdarma", () => {
  assert.equal(W.RESPAWN_HP_FRAC, 0.4);
  assert.equal(W.respawnHp(50), 20);
  assert.equal(W.respawnHp(1), 1);
  assert.deepEqual(W.healPriceAfterDeath(true, 50), { price: 0, consumeFree: true });
  assert.deepEqual(W.healPriceAfterDeath(false, 50), { price: 50, consumeFree: false });
});

test("corpse: nasadí do prázdného slotu, jinak do batohu, co se nevejde zůstane; questové první", () => {
  const corpse = { x: 1, y: 1, day: 1, gold: 50, items: ["a", "q", "b"], equipped: { weapon: "ladle", head: "cap" } };
  const slots = { weapon: "stick" };
  let room = 2;
  const out = W.recoverCorpse(corpse, {
    isQuest: (id) => id === "q",
    tryEquip: (slot, id) => (slots[slot] ? false : ((slots[slot] = id), true)),
    tryPut: () => (room > 0 ? (room--, true) : false),
  });
  assert.equal(out.took.gold, 50);
  assert.equal(slots.head, "cap");
  assert.ok(out.took.items.includes("q"));
  assert.equal(out.left.gold, 0);
  assert.equal(out.left.items.length + Object.keys(out.left.equipped).length, 2); // 5 věcí - cap - 2 v batohu
});
