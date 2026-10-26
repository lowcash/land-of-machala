const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../systems/stash.js");

const quest = (id) => id === "bell" || id === "letter";
const at = (day, tick) => ({ day, tick });

test("úschovna: kapacita 6, poplatek 2 za započatý den", () => {
  const s = S.newStash();
  for (let i = 0; i < S.TUNE.stashCap; i++) assert.ok(S.stashPut(s, "axe", at(1, 4)).ok);
  assert.equal(S.stashPut(s, "axe", at(1, 4)).reason, "full");
  assert.equal(S.stashFee(s.items[0], at(1, 10)), 2);
  assert.equal(S.stashFee(s.items[0], at(4, 0)), 6);
});

test("úschovna: vyzvednutí vyžaduje zlato i místo, jinak nic nemění", () => {
  const s = S.newStash();
  S.stashPut(s, "mail", at(1, 4));
  assert.equal(S.stashTake(s, 0, at(3, 0), { gold: 1 }).reason, "gold");
  assert.equal(S.stashTake(s, 0, at(3, 0), { gold: 50, canFit: () => false }).reason, "fit");
  assert.equal(s.items.length, 1);
  const r = S.stashTake(s, 0, at(3, 0), { gold: 50, canFit: () => true });
  assert.deepEqual([r.ok, r.id, r.fee], [true, "mail", 4]);
  assert.equal(s.items.length, 0);
});

test("riziko: nula bez času, roste s časem, noc váží víc, zakopané je mnohem bezpečnější", () => {
  const a = S.absTick(at(1, 0));
  assert.equal(S.lossChance("open", a, a), 0);
  const day = S.lossChance("open", S.absTick(at(1, 0)), S.absTick(at(1, 12)));
  const night = S.lossChance("open", S.absTick(at(1, 12)), S.absTick(at(1, 20)));
  assert.ok(night > S.lossChance("open", S.absTick(at(1, 0)), S.absTick(at(1, 8))), "noc je horší než den stejné délky");
  assert.ok(day > 0 && day < 0.15);
  assert.ok(Math.abs(S.lossChance("open", S.absTick(at(1, 0)), S.absTick(at(2, 0))) - S.TUNE.openPerDay) < 1e-9);
  assert.ok(Math.abs(S.lossChance("buried", S.absTick(at(1, 0)), S.absTick(at(2, 0))) - S.TUNE.buriedPerDay) < 1e-9);
  const p3 = S.lossChance("open", a, S.absTick(at(4, 0)));
  assert.ok(p3 > S.TUNE.openPerDay && p3 < 1);
});

/* n samostatných hromádek po jedné věci (zloděj bere celou hromádku, tak jich potřebujeme hodně) */
function fill(kind, n) {
  const piles = [];
  for (let i = 0; i < n; i++) S.dropItem(piles, { x: i, y: 1, kind, itemId: "axe", clock: at(1, 0), uid: i });
  return piles;
}

test("rozkradení: deterministické, jen přibývá a odpovídá šanci", () => {
  const piles = fill("open", 2000);
  const a = S.settle(piles, at(2, 0), 77, quest);
  const b = S.settle(piles, at(2, 0), 77, quest);
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.lost.length / 2000 - 0.15) < 0.03, `ztraceno ${a.lost.length}`);
  const later = S.settle(piles, at(5, 0), 77, quest);
  assert.ok(later.lost.length >= a.lost.length);
  /* co zmizelo dřív, zmizelo i později (jeden pevný hod) */
  const after = S.settle(a.piles, at(5, 0), 77, quest);
  assert.equal(a.lost.length + after.lost.length, later.lost.length);
  const uids = (r) => r.piles.map((p) => p.items[0].uid).join();
  assert.notEqual(uids(S.settle(piles, at(2, 0), 78, quest)), uids(a), "jiný seed = jiný výsledek");
});

test("zakopané věci mizí málo (~2 % za den)", () => {
  const r = S.settle(fill("buried", 2000), at(2, 0), 5, quest);
  assert.ok(Math.abs(r.lost.length / 2000 - 0.02) < 0.015, `ztraceno ${r.lost.length}`);
});

test("questové věci se nerozkradou nikdy, běžné ano", () => {
  const piles = [];
  for (let i = 0; i < 300; i++) {
    S.dropItem(piles, { x: i, y: 1, kind: "open", itemId: "bell", clock: at(1, 14), uid: i });
    S.dropItem(piles, { x: i, y: 1, kind: "open", itemId: "potion", clock: at(1, 14), uid: 1000 + i });
  }
  const r = S.settle(piles, at(60, 0), 9, quest);
  assert.equal(r.lost.filter((l) => l.id === "bell").length, 0);
  assert.equal(r.lost.length, 300, "po 60 dnech jsou pryč všechny běžné");
  assert.equal(r.piles.length, 300);
  assert.ok(r.piles.every((p) => p.items.length === 1 && p.items[0].id === "bell"));
});

test("settle: lze omezit na jedno políčko; prázdná hromádka zmizí; vzít věc z hromádky", () => {
  const piles = [];
  S.dropItem(piles, { x: 1, y: 1, kind: "open", itemId: "potion", clock: at(1, 0), uid: 1 });
  S.dropItem(piles, { x: 2, y: 2, kind: "open", itemId: "potion", clock: at(1, 0), uid: 2 });
  const r = S.settle(piles, at(90, 0), 3, quest, { x: 1, y: 1 });
  assert.equal(r.piles.length, 1);
  assert.equal(r.piles[0].x, 2);
  const p = S.pileAt(piles, 2, 2, "open");
  assert.equal(S.takeFromPile(piles, p, 0), "potion");
  assert.equal(S.pileAt(piles, 2, 2, "open"), null);
});

test("zloděj bere všechno, nebo nic: věci odložené spolu mizí společně (questové zůstanou)", () => {
  let allGone = 0;
  let noneGone = 0;
  for (let i = 0; i < 400; i++) {
    const piles = [];
    for (const [k, id] of ["axe", "mail", "potion", "bell"].entries()) S.dropItem(piles, { x: i, y: 2, kind: "open", itemId: id, clock: at(1, 14), uid: i * 10 + k });
    const r = S.settle(piles, at(2, 0), 21, quest);
    const normalLost = r.lost.length;
    assert.ok(normalLost === 0 || normalLost === 3, `ztraceno ${normalLost}`);
    if (normalLost === 3) allGone++;
    else noneGone++;
  }
  assert.ok(allGone > 0 && noneGone > 0);
});

test("terén: odložená věc na těžko dostupném místě mizí méně, zakopané beze změny, deterministicky", () => {
  const piles = fill("open", 3000);
  const lostOn = (terrain) => S.settle(piles, at(2, 0), 33, quest, undefined, () => terrain).lost.length;
  const road = lostOn("road");
  const plains = lostOn("plains");
  const hills = lostOn("hills");
  assert.ok(Math.abs(road / 3000 - 0.15 * S.TUNE.terrainMult.road) < 0.03, `road ${road}`);
  assert.ok(Math.abs(plains / 3000 - 0.15) < 0.03, `plains ${plains}`);
  assert.ok(hills < road / 3, `hills ${hills} vs road ${road}`);
  assert.ok(lostOn("town") > road);
  assert.equal(lostOn("hills"), hills, "stejný vstup = stejný výsledek");
  assert.equal(lostOn("neznámý"), S.settle(piles, at(2, 0), 33, quest).lost.length, "neznámý terén = ×1");
  const buried = fill("buried", 2000);
  assert.equal(S.settle(buried, at(2, 0), 5, quest, undefined, () => "town").lost.length, S.settle(buried, at(2, 0), 5, quest).lost.length);
});

test("terén: násobič mění jen šanci hromádky na zemi a šance nikdy nedosáhne 100 %", () => {
  const a = S.absTick(at(1, 0));
  const b = S.absTick(at(2, 0));
  assert.ok(Math.abs(S.lossChance("open", a, b, S.TUNE.terrainMult.hills) - 0.15 * 0.3) < 1e-9);
  assert.ok(S.lossChance("open", a, b, 100) < 1);
  assert.equal(S.lossChance("buried", a, b, 5), S.lossChance("buried", a, b));
});
