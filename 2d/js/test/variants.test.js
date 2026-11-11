const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../systems/variants.js");

test("varianty: řetězec a jedna položka se vrací beze změny", () => {
  assert.equal(V.pick("ahoj", 5, "k", 3), "ahoj");
  assert.equal(V.pick(["jediná"], 5, "k", 7), "jediná");
  assert.equal(V.pick([], 5, "k", 0), "");
});

test("varianty: nikdy stejná dvakrát po sobě (2, 3 i 5 variant, více seedů a klíčů)", () => {
  for (const len of [2, 3, 5]) {
    const list = Array.from({ length: len }, (_, i) => `v${i}`);
    for (const seed of [1, 7, 12345, 4000000000]) {
      for (const key of ["prose:tavern", "greet:gate", "ans:x"]) {
        let prev = null;
        for (let n = 0; n < 60; n++) {
          const cur = V.pick(list, seed, key, n);
          assert.notEqual(cur, prev, `len ${len} seed ${seed} ${key} n ${n}`);
          prev = cur;
        }
      }
    }
  }
});

test("varianty: deterministické (stejný vstup = stejný výstup) a seed mění začátek", () => {
  const list = ["a", "b", "c", "d"];
  assert.equal(V.pick(list, 9, "k", 4), V.pick(list, 9, "k", 4));
  const starts = new Set();
  for (let seed = 1; seed <= 40; seed++) starts.add(V.pick(list, seed, "k", 0));
  assert.ok(starts.size > 1);
});

test("varianty: všechny se dřív nebo později objeví", () => {
  const list = ["a", "b", "c"];
  const seen = new Set();
  for (let n = 0; n < 30; n++) seen.add(V.pick(list, 3, "k", n));
  assert.equal(seen.size, 3);
});
