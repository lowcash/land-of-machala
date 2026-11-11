const test = require("node:test");
const assert = require("node:assert/strict");
const W = require("../systems/clock.js");

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
