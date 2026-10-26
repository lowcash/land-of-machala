const test = require("node:test");
const assert = require("node:assert/strict");
const { createRng } = require("../rng.js");
const { createCombat, resolveTurn, availableActions, rewardsFor, readChance } = require("../systems/combat.js");
const { PLAYERS, run } = require("../sim.js");

const mk = (enemyId = "wolf", seed = 1, over = {}) => {
  const rng = createRng(seed);
  const p = { ...PLAYERS.mercenary, hp: PLAYERS.mercenary.hpMax, res: PLAYERS.mercenary.resMax, ...over.player };
  return { rng, c: createCombat({ enemyId, player: p, items: { heal: 1, foresight: 1 }, familiarity: over.familiarity || 0, rng }) };
};

test("stejný seed a akce = stejný průběh", () => {
  const play = () => {
    const { rng, c } = mk("bandit", 7);
    const out = [];
    for (const a of ["quick", "guard", "heavy", "evade", "quick"]) out.push(resolveTurn(c, a, rng).events);
    return JSON.stringify([out, c.hp, c.enemyHp]);
  };
  assert.equal(play(), play());
});

test("těžký útok stojí zdroj, obrana ho vrací, bez zdroje je zamítnut a tah se nespotřebuje", () => {
  const { rng, c } = mk();
  c.res = 3;
  const r = resolveTurn(c, "heavy", rng);
  assert.equal(r.ok, false);
  assert.equal(c.turn, 1);
  assert.equal(c.res, 3);
  resolveTurn(c, "guard", rng);
  assert.equal(c.res, 5);
  const before = c.res;
  resolveTurn(c, "heavy", rng);
  assert.equal(c.res, before - 4 + (c.over ? 0 : 0));
});

test("čtení záměru roste s INT, zkušeností a odvarem; strop 90 %", () => {
  const base = mk("bandit").c;
  const smart = mk("bandit", 1, { player: { int: 10 }, familiarity: 0.15 }).c;
  assert.ok(readChance(smart) > readChance(base));
  smart.foresightTurns = 5;
  smart.readBonus = 0.5;
  assert.ok(readChance(smart) <= 0.9);
});

test("indicie odpovídá deklarované jistotě (kalibrace)", () => {
  const rng = createRng(99);
  let right = 0;
  const N = 4000;
  let p = 0;
  for (let i = 0; i < N; i++) {
    const c = createCombat({ enemyId: "bandit", player: { ...PLAYERS.mercenary, hp: 58, res: 14 }, rng });
    p = c.readChance;
    if (c.hint.id === c.trueIntent) right++;
  }
  assert.ok(Math.abs(right / N - p) < 0.03, `${right / N} vs ${p}`);
});

test("elitní protivník klame: jistota je nižší než u zvířete", () => {
  assert.ok(readChance(mk("brigand").c) < readChance(mk("wolf").c));
});

test("bandita nabídne kapitulaci a ušetření dá menší odměnu bez kořisti", () => {
  const { rng, c } = mk("bandit", 3);
  c.enemyHp = Math.floor(c.enemyMax * 0.2);
  c.hp = c.hpMax;
  resolveTurn(c, "guard", rng);
  assert.equal(c.offer, "surrender");
  assert.ok(availableActions(c).some((a) => a.id === "spare" && a.enabled));
  resolveTurn(c, "spare", rng);
  assert.equal(c.result, "spare");
  const rw = rewardsFor(c, rng);
  assert.deepEqual(rw.loot, []);
  assert.ok(rw.gold > 0 && rw.xp > 0);
});

test("předmět se spotřebuje a nelze použít podruhé", () => {
  const { rng, c } = mk();
  c.hp = 20;
  assert.equal(resolveTurn(c, "potion", rng).ok, true);
  assert.equal(c.items.heal, 0);
  assert.equal(resolveTurn(c, "potion", rng).ok, false);
});

/* Akceptace S2: žádná fixní akce nedominuje, znalost záměru se vyplatí. */
test("balans: bandita vs válečník", () => {
  const N = 600;
  const fixed = ["vždy-quick", "vždy-heavy", "vždy-guard", "vždy-evade", "vždy-special"].map((b) => run(b, "bandit", PLAYERS.mercenary, N).win);
  assert.ok(Math.max(...fixed) < 75, `nejlepší fixní ${Math.max(...fixed)}`);
  assert.ok(run("informovaný", "bandit", PLAYERS.mercenary, N).win >= 90);
  const smart = run("čtenář", "bandit", PLAYERS.mercenary, N, { player: { int: 10 }, familiarity: 0.15 }).win;
  const blind = run("čtenář", "bandit", PLAYERS.mercenary, N).win;
  assert.ok(smart - blind >= 10, `schopnost čtení +${(smart - blind).toFixed(0)} p. b.`);
});

test("morálka: slabý hráč = nepřítel nevzdá a zuří (jednou); zdravý hráč = nabídka", () => {
  const weak = mk("bandit", 3);
  weak.c.enemyHp = Math.round(weak.c.enemyMax * 0.24);
  weak.c.hp = 2;
  const ev = resolveTurn(weak.c, "guard", weak.rng).events;
  assert.equal(weak.c.offer, null);
  assert.equal(ev.filter((e) => e.t === "desperate").length, 1);
  assert.ok(!availableActions(weak.c).some((a) => a.id === "spare"));
  weak.c.hp = 5;
  const ev2 = resolveTurn(weak.c, "guard", weak.rng).events;
  assert.ok(!ev2.some((e) => e.t === "desperate"));

  const ok = mk("bandit", 3);
  ok.c.enemyHp = Math.round(ok.c.enemyMax * 0.24);
  ok.c.hp = Math.round(ok.c.hpMax * 0.6);
  const ev3 = resolveTurn(ok.c, "guard", ok.rng).events;
  assert.equal(ok.c.offer, "surrender");
  assert.ok(ev3.some((e) => e.t === "surrender_offer") && !ev3.some((e) => e.t === "desperate"));
});

test("morálka: po zvednutí HP se nabídka objeví; zvířata beze změny", () => {
  const { rng, c } = mk("bandit", 4);
  c.enemyHp = Math.round(c.enemyMax * 0.2);
  c.hp = 5;
  resolveTurn(c, "guard", rng);
  assert.equal(c.offer, null);
  c.hp = c.hpMax;
  resolveTurn(c, "guard", rng);
  assert.equal(c.offer, "surrender");
  const w = mk("wolf", 4);
  w.c.enemyHp = 1;
  w.c.hp = 2;
  const ev = resolveTurn(w.c, "guard", w.rng).events;
  assert.ok(!ev.some((e) => e.t === "desperate" || e.t === "surrender_offer"));
});

test("enemyCondition: slovní stav a dílky", () => {
  const { enemyCondition } = require("../ui/combat-text.js");
  const st = (hp) => enemyCondition({ enemyHp: hp, enemyMax: 100 });
  assert.deepEqual(
    [100, 76, 75, 51, 50, 26, 25, 1].map((hp) => st(hp).label),
    ["zdravý", "zdravý", "potlučený", "potlučený", "krvácí", "krvácí", "sotva stojí", "sotva stojí"],
  );
  assert.deepEqual([100, 60, 40, 10].map((hp) => st(hp).q), [4, 3, 2, 1]);
});

test("útěk: počasí mění šanci (déšť snižuje, mlha zvyšuje), jen o `weatherFlee`", () => {
  const chanceFor = (weatherFlee) => {
    const rng = createRng(3);
    const c = createCombat({ enemyId: "wolf", player: { ...PLAYERS.mercenary, hp: PLAYERS.mercenary.hpMax, res: PLAYERS.mercenary.resMax }, items: {}, rng, weatherFlee });
    let seen = null;
    const probe = Object.assign(Object.create(rng), { chance: (p) => { if (seen == null) seen = p; return false; } });
    resolveTurn(c, "flee", probe);
    return seen;
  };
  const base = chanceFor(0);
  assert.ok(Math.abs(chanceFor(-0.1) - (base - 0.1)) < 1e-9);
  assert.ok(Math.abs(chanceFor(0.1) - (base + 0.1)) < 1e-9);
  assert.equal(chanceFor(9) <= base + 0.3 + 1e-9, true); // strop ±0,3
});
