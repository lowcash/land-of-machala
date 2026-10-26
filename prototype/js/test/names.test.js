const test = require("node:test");
const assert = require("node:assert/strict");
const { createRng } = require("../rng.js");
const { NAME_POOLS, POOL_WEIGHTS, NICKNAMES, TICS, OBSESSIONS } = require("../data/names.js");
const Names = require("../systems/names.js");
const { makeName, makeRegular } = Names;

test("names: fondy mají ~30 položek a váhy sedí", () => {
  for (const [id, list] of Object.entries(NAME_POOLS)) {
    assert.ok(list.length >= 30, `${id} má ${list.length}`);
    for (const n of list) {
      assert.ok(n.first && (n.gender === "m" || n.gender === "f"));
    }
  }
  assert.equal(POOL_WEIGHTS.staroceska, 50);
  const rest = Object.entries(POOL_WEIGHTS)
    .filter(([k]) => k !== "staroceska")
    .reduce((s, [, w]) => s + w, 0);
  assert.equal(rest, 50);
  assert.ok(NICKNAMES.length >= 15);
  assert.ok(TICS.length >= 10 && TICS.length <= 20);
  assert.ok(OBSESSIONS.length >= 10 && OBSESSIONS.length <= 20);
});

test("names: stejný seed = stejné jméno", () => {
  const a = makeName(createRng(42));
  const b = makeName(createRng(42));
  assert.deepEqual(a, b);
  const r1 = makeRegular(createRng(99));
  const r2 = makeRegular(createRng(99));
  assert.deepEqual(r1, r2);
});

test("names: žádné duplicity full při 200 generacích", () => {
  const rng = createRng(7);
  const used = new Set();
  for (let i = 0; i < 200; i++) {
    const n = makeName(rng, { used });
    assert.ok(n.full.length > 0);
    assert.ok(n.first.length > 0);
    assert.ok(n.last.length > 0);
  }
  assert.equal(used.size, 200);
});

test("names: staročeská ~50 % při velkém vzorku", () => {
  const rng = createRng(123);
  let staro = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    if (makeName(rng).pool === "staroceska") staro++;
  }
  const share = staro / N;
  assert.ok(share > 0.4 && share < 0.6, `podíl staročeská ${share}`);
});

test("names: makeRegular má truthfulness 0–1 a neprázdná pole", () => {
  const rng = createRng(3);
  for (let i = 0; i < 50; i++) {
    const p = makeRegular(rng);
    assert.ok(p.truthfulness >= 0 && p.truthfulness <= 1);
    assert.ok(p.name.full.length > 0);
    assert.ok(p.tic.length > 0);
    assert.ok(p.obsession.length > 0);
    assert.ok(p.signal.length > 0);
    assert.ok(["rada", "zastava", "farnost", "cech"].includes(p.stance.side));
    assert.ok(["pos", "neg", "none"].includes(p.stance.lean));
  }
});

test("names: gender filtr funguje", () => {
  const rng = createRng(5);
  for (let i = 0; i < 40; i++) {
    const f = makeName(rng, { gender: "f", pool: "staroceska" });
    assert.equal(f.gender, "f");
    const m = makeName(rng, { gender: "m", pool: "staroceska" });
    assert.equal(m.gender, "m");
  }
});

test("ženská příjmení mají -ová; výjimka jen u rodin cizího původu; místa a otcovská beze změny", () => {
  const { feminize } = Names;
  assert.equal(feminize("Kolář"), "Kolářová");
  assert.equal(feminize("Tichý"), "Tichá");
  assert.equal(feminize("Bělohlávek"), "Bělohlávková");
  assert.equal(feminize("z Brodu"), "z Brodu");
  assert.equal(feminize("Matějů"), "Matějů");
  const rng = createRng(11);
  for (let i = 0; i < 300; i++) {
    const n = Names.makeName(rng, { gender: "f" });
    if (!n.foreignFamily && !/^z |ů$/.test(n.last)) assert.match(n.last, /(ová|á)$/, n.full);
    if (n.foreignFamily) assert.ok(["nemecka", "jizni"].includes(n.pool), n.full);
  }
});
