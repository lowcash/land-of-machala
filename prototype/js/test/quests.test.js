const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../systems/quests.js");

const bag = (items) => ({ count: (id) => items.filter((i) => i === id).length });

test("životní cyklus: available → active → ready → done, podruhé odevzdat nejde", () => {
  const log = Q.newLog();
  assert.equal(Q.statusOf(log, "wolves_outside"), "available");
  assert.equal(Q.accept(log, "wolves_outside").ok, true);
  assert.equal(Q.accept(log, "wolves_outside").ok, false);
  Q.onKill(log, { enemyId: "wolf", terrain: "forest" });
  Q.evaluate(log, bag([]));
  assert.equal(Q.statusOf(log, "wolves_outside"), "active");
  Q.onKill(log, { enemyId: "wolf", terrain: "forest" });
  assert.deepEqual(Q.evaluate(log, bag([])), ["wolves_outside"]);
  assert.equal(Q.statusOf(log, "wolves_outside"), "ready");
  assert.equal(Q.canTurnIn(log, "wolves_outside", { place: "tavern" }), false);
  const r = Q.turnIn(log, "wolves_outside", { place: "healer" });
  assert.equal(r.ok, true);
  assert.equal(r.reward.xp, 40);
  assert.equal(Q.statusOf(log, "wolves_outside"), "done");
  assert.equal(Q.turnIn(log, "wolves_outside", { place: "healer" }).ok, false);
});

test("kill mimo správný terén nebo jiný druh se nepočítá; víc než count nepřeteče", () => {
  const log = Q.newLog();
  Q.accept(log, "wolves_outside");
  assert.deepEqual(Q.onKill(log, { enemyId: "wolf", terrain: "plains" }), []);
  assert.deepEqual(Q.onKill(log, { enemyId: "boar", terrain: "forest" }), []);
  for (let i = 0; i < 5; i++) Q.onKill(log, { enemyId: "wolf", terrain: "forest" });
  assert.equal(Q.progressOf(log, "wolves_outside")[0].cur, 2);
});

test("have: ztráta věci vrátí quest z ready do active; volba odevzdání dá jiný následek", () => {
  const log = Q.newLog();
  Q.accept(log, "bread_for_uda");
  Q.evaluate(log, bag(["ration"]));
  assert.equal(Q.statusOf(log, "bread_for_uda"), "ready");
  Q.evaluate(log, bag([]));
  assert.equal(Q.statusOf(log, "bread_for_uda"), "active");
  Q.evaluate(log, bag(["ration"]));
  assert.equal(Q.turnIn(log, "bread_for_uda", { place: "tavern" }).ok, false); // chybí volba
  const r = Q.turnIn(log, "bread_for_uda", { place: "tavern" }, "sell");
  assert.equal(r.reward.gold, 15);
  assert.deepEqual(r.reward.flags, ["svatava_haggled"]);
  assert.deepEqual(r.consume, ["ration"]);
});

test("dopis: vydá se jednou, ztracený v corpse se znovu nevydá; odevzdání jen v Ladě", () => {
  const log = Q.newLog();
  assert.deepEqual(Q.accept(log, "letter_to_lada", { hasAnywhere: () => false }).give, ["letter"]);
  Q.onArrive(log, 3, 0);
  Q.evaluate(log, bag([]));
  assert.equal(Q.statusOf(log, "letter_to_lada"), "active"); // dopis chybí
  Q.evaluate(log, bag(["letter"]));
  assert.equal(Q.statusOf(log, "letter_to_lada"), "ready");
  assert.equal(Q.canTurnIn(log, "letter_to_lada", { cell: [3, 1] }), false);
  assert.equal(Q.canTurnIn(log, "letter_to_lada", { cell: [3, 0] }), true);
  Q.abandon(log, "letter_to_lada");
  assert.deepEqual(Q.accept(log, "letter_to_lada", { hasAnywhere: (i) => i === "letter" }).give, []);
});

test("značky na mapě: zadavatel, zóna lesa, ztracená věc v corpse", () => {
  const log = Q.newLog();
  Q.accept(log, "wolves_outside");
  Q.accept(log, "letter_to_lada");
  const ctx = {
    terrainAt: (x, y) => (y >= 5 && x >= 2 && x <= 3 ? "forest" : "plains"),
    mapMax: 6, townCell: [3, 3], count: () => 0,
    corpses: [{ x: 2, y: 5, items: ["letter"] }],
  };
  const m = Q.marks(log, ctx);
  assert.ok(m.some((x) => x.kind === "giver"));
  assert.equal(m.filter((x) => x.kind === "zone").length, 4);
  assert.ok(m.some((x) => x.kind === "lost" && x.x === 2 && x.y === 5));
  assert.ok(m.some((x) => x.kind === "target" && x.x === 3 && x.y === 0));
});
