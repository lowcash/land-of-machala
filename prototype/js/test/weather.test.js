const test = require("node:test");
const assert = require("node:assert/strict");
const W = require("../systems/weather.js");
const items = require("../data/items.js");

const byId = (id) => items.INVENTORY.find((i) => i.id === id);
const kit = (...ids) => W.gearScore(ids.map(byId));
const run = (state, ctx, n) => { let s = state; for (let i = 0; i < n; i++) s = W.step(s, ctx); return s; };

test("počasí: deterministické ze seedu a dne, všechny druhy se vyskytnou, váhy se drží", () => {
  assert.deepEqual(W.weatherFor(7, 3), W.weatherFor(7, 3));
  const count = {};
  for (let d = 1; d <= 400; d++) { const k = W.weatherFor(11, d).kind; count[k] = (count[k] || 0) + 1; }
  assert.deepEqual(Object.keys(count).sort(), Object.keys(W.TUNE.weights).sort());
  assert.ok(count.clear > count.rain && count.rain > count.fog, JSON.stringify(count));
});

test("výbava: položky v katalogu mají odolnost, součty mají strop, kov se počítá", () => {
  assert.ok(byId("cloak").rain >= 1 && byId("cloak").warmth >= 1);
  assert.equal(byId("mail").metal, true);
  const all = kit("cap", "cloak", "gloves", "pants", "boots");
  assert.equal(all.warmth, W.TUNE.gearCap);
  assert.equal(kit("mail", "helm", "sabatons").metal, 3);
  assert.deepEqual(W.gearScore([]), { warmth: 0, rain: 0, metal: 0 });
});

test("déšť: bez výbavy promokne rychleji než s pláštěm a obuví; stupně zůstávají 0..3", () => {
  const rain = { kind: "rain", tick: 4, where: "outside" };
  const bare = run(W.newState(), { ...rain, gear: kit() }, 1);
  const dressed = run(W.newState(), { ...rain, gear: kit("cloak", "boots") }, 1);
  assert.ok(bare.wet > dressed.wet, `${bare.wet} × ${dressed.wet}`);
  const long = run(W.newState(), { ...rain, gear: kit() }, 20);
  assert.ok(long.wet <= 3 && long.chill <= 3 && long.wet >= 0 && long.chill >= 0);
  assert.equal(long.wet, 3);
});

test("chlad: závisí na oblečení, mokrý chladne víc, kov za mokra přidá chlad, noc je chladnější", () => {
  const dayClear = { kind: "clear", tick: 4, where: "outside", gear: kit() };
  assert.equal(run(W.newState(), dayClear, 5).chill, 0); // jasný den: žádný chlad
  const night = { kind: "clear", tick: 14, where: "outside" };
  assert.ok(run(W.newState(), { ...night, gear: kit() }, 1).chill > run(W.newState(), { ...night, gear: kit("cloak", "gloves", "cap") }, 1).chill);
  const rain = { kind: "rain", tick: 4, where: "outside" };
  const wool = run(W.newState(), { ...rain, gear: kit("cloak", "gloves") }, 3);
  const steel = run(W.newState(), { ...rain, gear: kit("mail", "helm", "gauntlets", "cloak") }, 3);
  assert.ok(steel.chill >= wool.chill, `${steel.chill} × ${wool.chill}`);
  const metalOnly = W.step({ wet: 1, chill: 0 }, { kind: "clear", tick: 4, where: "outside", gear: kit("mail", "helm") });
  assert.ok(metalOnly.chill >= 1, "kov za vlhka chladí");
});

test("úkryt: střecha schne, oheň schne a hřeje o dva stupně, nikdy nezhorší stav", () => {
  const soaked = { wet: 3, chill: 3 };
  const roof = W.step(soaked, { kind: "rain", tick: 14, where: "roof", gear: kit() });
  assert.ok(roof.wet < soaked.wet && roof.chill <= soaked.chill);
  const fire = W.step(soaked, { kind: "rain", tick: 14, where: "fire", gear: kit() });
  assert.deepEqual(fire, { wet: 1, chill: 1 });
  assert.deepEqual(run(soaked, { kind: "rain", tick: 14, where: "fire", gear: kit() }, 2), { wet: 0, chill: 0 });
});

test("modifikátory: nic v pohodě, chlad 2 zpomalí cestu a zhorší DEX a postřeh, chlad 3 i začátek boje a nabídne cestu ven", () => {
  const ok = W.modifiers({ wet: 0, chill: 0 }, "clear");
  assert.deepEqual([ok.dex, ok.perception, ok.hpMalus, ok.grip, ok.travelMult, ok.needsRelief], [0, 0, 0, 0, 1, false]);
  const cold = W.modifiers({ wet: 0, chill: 2 }, "clear");
  assert.deepEqual([cold.dex, cold.perception, cold.hpMalus, cold.travelMult], [-1, -1, 0, 1.25]);
  const frozen = W.modifiers({ wet: 3, chill: 3 }, "rain");
  assert.deepEqual([frozen.hpMalus, frozen.grip, frozen.needsRelief], [0.1, -1, true]);
  assert.ok(frozen.dex >= W.TUNE.modFloor && frozen.perception >= W.TUNE.modFloor);
});

test("vyvážení: zima (chill 3, −10 % HP na začátku boje, DEX −1) nesmí zničit slabší povolání (sim.js)", () => {
  const { PLAYERS, run } = require("../sim.js");
  const cold = W.modifiers({ wet: 0, chill: 3 }, "clear");
  for (const cls of Object.keys(PLAYERS)) {
    const base = PLAYERS[cls];
    const a = run("informovaný", "wolf", base, 300).win;
    const b = run("informovaný", "wolf", { ...base, dex: Math.max(0, base.dex + cold.dex) }, 300, {
      player: { hp: Math.round(base.hpMax * (1 - cold.hpMalus)), hpMax: Math.round(base.hpMax * (1 - cold.hpMalus)) },
    }).win;
    assert.ok(a - b <= 20, `${cls}: výhra ${a} → ${b}`); // a bez nulového poklesu naopak nesmí vyjít lépe o víc než šum
    assert.ok(b <= a + 3, `${cls}: ${a} → ${b}`);
  }
});

test("počasí a útěk: déšť snižuje šanci, mlha ji zvyšuje, jinak beze změny", () => {
  const f = (k) => W.modifiers({ wet: 0, chill: 0 }, k).flee;
  assert.ok(f("rain") < 0 && f("fog") > 0 && f("clear") === 0);
});

test("popisky stupňů pro UI", () => {
  assert.equal(W.label("wet", 0), "suchý");
  assert.equal(W.label("wet", 9), "promoklý");
  assert.equal(W.label("chill", 2), "zima");
});

test("počasí vidí hráč vždy: každý druh má větu pro den i noc", () => {
  for (const kind of Object.keys(W.TUNE.weights)) {
    assert.ok(W.describe(kind, 4).length > 5 && W.describe(kind, 14).length > 5);
    assert.notEqual(W.describe(kind, 4), W.describe(kind, 14));
  }
});
