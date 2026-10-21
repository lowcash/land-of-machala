const test = require("node:test");
const assert = require("node:assert/strict");
const K = require("../systems/kauza.js");

const kauza = (variant, seed = 3) => Object.assign(K.newKauza(seed), { variant });

test("varianta ze seedu; varianta mění pravdu fám", () => {
  assert.deepEqual(new Set([0, 1, 2].map((s) => K.newKauza(s).variant)), new Set(["A", "B", "C"]));
  assert.equal(K.truthOf(kauza("A"), "c4"), "true");
  assert.equal(K.truthOf(kauza("C"), "c4"), "half");
  assert.equal(K.truthOf(kauza("C"), "c1"), "false");
  assert.equal(K.truthOf(kauza("A"), "c5"), "none");
});

test("první zaslechnutí spustí lhůtu; podruhé nic nového", () => {
  const k = kauza("A");
  assert.equal(K.started(k), false);
  assert.equal(K.deadline(k, { day: 1 }).started, false);
  assert.equal(K.hear(k, "c1", { day: 2 }).isNew, true);
  assert.equal(K.hear(k, "c1", { day: 3 }).isNew, false);
  assert.equal(k.startDay, 2);
  assert.equal(K.deadline(k, { day: 4 }).daysLeft, 3);
  assert.equal(k.events.filter((e) => e.type === "claim_heard").length, 1);
});

test("seed fáma (armDeadline:false): Zápisník ano, lhůta až při prvním hear s armDeadline", () => {
  const k = kauza("A");
  K.hear(k, "c6", { day: 1, armDeadline: false });
  assert.ok(K.hasClaims(k));
  assert.equal(K.started(k), false);
  assert.equal(k.startDay, null);
  /* posun o 3 dny, pak první „skutečné“ zaslechnutí → zbývá 5 dní, ne 2 */
  K.hear(k, "c1", { day: 4 });
  assert.equal(k.startDay, 4);
  assert.equal(K.deadline(k, { day: 4 }).daysLeft, 5);
  assert.equal(K.deadline(k, { day: 7 }).daysLeft, 2);
  /* stejná seed fáma podruhé s armDeadline taky spustí lhůtu */
  const k2 = kauza("A");
  K.hear(k2, "c6", { day: 1, armDeadline: false });
  K.hear(k2, "c6", { day: 5 });
  assert.equal(k2.startDay, 5);
  assert.equal(K.deadline(k2, { day: 5 }).daysLeft, 5);
});

test("ověření: true/half → ověřeno, false → vyvráceno, none → otevřené (nikdy nerozhodnuto)", () => {
  const k = kauza("C");
  ["c1", "c4", "c5"].forEach((c) => K.hear(k, c, { day: 1 }));
  assert.equal(K.verify(k, "c1", { via: "camp" }).status, "refuted");
  const half = K.verify(k, "c4", { via: "clerk" });
  assert.equal(half.status, "verified");
  assert.equal(half.truth, "half");
  const open = K.verify(k, "c5", { via: "night" });
  assert.equal(open.status, "open");
  assert.equal(K.verify(k, "c5", { via: "night" }).ok, true, "otevřenou jde zkoušet znovu");
  assert.equal(K.certainty(k, "c5").label, "nejasné");
  assert.equal(K.verify(k, "c1", { via: "camp" }).ok, false, "vyřešené podruhé ne");
});

test("ověřit jde jen zaslechnuté a správným způsobem", () => {
  const k = kauza("A");
  assert.equal(K.verify(k, "c4", { via: "clerk" }).ok, false);
  K.hear(k, "c4");
  assert.equal(K.verify(k, "c4", { via: "camp" }).ok, false);
  assert.equal(K.verify(k, "c4", { via: "clerk" }).ok, true);
});

test("jistota: INT a povolání ji zvedají, protiřečící se fáma od jiného snižuje; slova jako v boji", () => {
  const k = kauza("A");
  K.hear(k, "c1");
  const base = K.certainty(k, "c1", { int: 6 }).p;
  assert.ok(K.certainty(k, "c1", { int: 12 }).p > base);
  assert.ok(K.certainty(k, "c1", { int: 6, classId: "tracker" }).p > base, "stopy čte stopař");
  assert.equal(K.certainty(k, "c1", { int: 6, classId: "chanter" }).p, base);
  K.hear(k, "c6");
  assert.ok(K.certainty(k, "c1", { int: 6 }).p < base);
  K.hear(k, "c4");
  assert.equal(K.certainty(k, "c4", { int: 10 }).label, "jistě");
});

test("jistota: shoda rasy +0,05, s povoláním se sčítá, strop 0,9", () => {
  const k = kauza("A");
  K.hear(k, "c1"); /* tracks */
  const base = K.certainty(k, "c1", { int: 6 }).p;
  assert.equal(K.certainty(k, "c1", { int: 6, raceId: "local" }).p, base, "local čte paper");
  const withRace = K.certainty(k, "c1", { int: 6, raceId: "woodfolk" }).p;
  assert.ok(Math.abs(withRace - (base + K.RACE_TAG_BONUS)) < 1e-9);
  const both = K.certainty(k, "c1", { int: 6, classId: "tracker", raceId: "woodfolk" }).p;
  assert.ok(Math.abs(both - (base + K.CLASS_TAG_BONUS + K.RACE_TAG_BONUS)) < 1e-9);
  K.hear(k, "c4"); /* paper, bankéř rel 0.8 */
  const high = K.certainty(k, "c4", { int: 12, classId: "legist", raceId: "local" }).p;
  assert.equal(high, 0.9, "strop");
});

test("zákoník čte paper", () => {
  const k = kauza("A");
  K.hear(k, "c4");
  const base = K.certainty(k, "c4", { int: 6 }).p;
  assert.ok(K.certainty(k, "c4", { int: 6, classId: "legist" }).p > base);
  assert.equal(K.certainty(k, "c4", { int: 6, classId: "tracker" }).p, base);
});

test("signály jsou deterministické a nikdy u pravdy nebo u poctivého bankéře", () => {
  const a = kauza("A", 7);
  const b = kauza("A", 7);
  for (const c of Object.keys(K.def(a).claims)) assert.equal(K.signalFor(a, c), K.signalFor(b, c));
  assert.equal(K.signalFor(kauza("A"), "c4"), null);
  assert.equal(K.signalFor(kauza("C"), "c4"), null, "bankéř jen vynechává");
  const seen = new Set();
  for (let s = 0; s < 40; s++) seen.add(K.signalFor(kauza("A", s), "c1"));
  assert.ok(seen.has(null) && seen.size > 1, "někdy prozradí, někdy ne");
});

test("lhůta vynutí výchozí verdikt; nic se nezablokuje a verdikt je jen jeden", () => {
  const k = kauza("A");
  K.hear(k, "c1", { day: 1 });
  assert.equal(K.checkDeadline(k, { day: 5 }), null);
  const r = K.checkDeadline(k, { day: 6 });
  assert.equal(r.ok, true);
  assert.equal(k.verdict.id, "auction");
  assert.equal(k.verdict.auto, true);
  assert.equal(K.trustOf(k, "anicka"), -1);
  assert.equal(K.checkDeadline(k, { day: 9 }), null);
  assert.equal(K.chooseVerdict(k, "pay", { at: "townhall", gold: 500 }).ok, false);
});

test("verdikty: podmínky místa, zvonu a zlata; důsledek přes důvěru → ceny a poplatek", () => {
  let k = kauza("A");
  assert.equal(K.canVerdict(k, "return", { at: "chapel", hasBell: false }), false);
  assert.equal(K.canVerdict(k, "return", { at: "bank", hasBell: true }), false);
  assert.equal(K.canVerdict(k, "pay", { at: "townhall", gold: 149 }), false);
  assert.equal(K.canVerdict(k, "auction", { at: "chapel", hasBell: true }), false, "výchozí verdikt si hráč nevybere");
  const r = K.chooseVerdict(k, "return", { at: "chapel", hasBell: true }, 3);
  assert.equal(r.effects.consumeBell, true);
  assert.ok(K.priceMod(k, "anicka") < 1);
  assert.ok(K.priceMod(k, "lidmila") < 1);
  assert.equal(K.bankFee(k), 5, "banka dražší");

  k = kauza("A");
  const b = K.chooseVerdict(k, "bank", { at: "bank", hasBell: true });
  assert.equal(b.effects.gold, 40);
  assert.equal(K.bankFee(k), 0);
  assert.ok(K.priceMod(k, "gertruda") < 1);

  k = kauza("A");
  const p = K.chooseVerdict(k, "pay", { at: "townhall", gold: 150 });
  assert.equal(p.effects.gold, -150);
  assert.equal(p.effects.consumeBell, false);

  k = kauza("A");
  K.chooseVerdict(k, "keep", { at: "notebook", hasBell: true });
  assert.ok(["anicka", "gertruda", "lidmila", "svatava"].every((n) => K.priceMod(k, n) > 1));
});

test("důvěra se ořízne na −2…+2 a ceny na ×0,7…×1,3", () => {
  const k = kauza("A");
  k.trust.anicka = 2;
  K.chooseVerdict(k, "return", { at: "chapel", hasBell: true });
  assert.equal(K.trustOf(k, "anicka"), 2);
  assert.ok(Math.abs(K.priceMod(k, "anicka") - 0.7) < 1e-9);
  const low = kauza("A");
  low.trust.svatava = -2;
  K.chooseVerdict(low, "keep", { at: "notebook", hasBell: true });
  assert.equal(K.trustOf(low, "svatava"), -2);
  assert.ok(Math.abs(K.priceMod(low, "svatava") - 1.3) < 1e-9);
});

test("epilog podle varianty, otevřená otázka zůstává", () => {
  assert.notEqual(K.epilog(kauza("A")).story, K.epilog(kauza("C")).story);
  assert.ok(K.epilog(kauza("B")).open.length > 10);
});

test("zkušenost Čtení: správný odhad při rozuzlení zvedá jistotu dalších fám, špatný ne", () => {
  const k = kauza("A");
  ["c1", "c2", "c4", "c3"].forEach((c) => K.hear(k, c));
  const before = K.certainty(k, "c1", { int: 6 }).p; /* c1 s ničím nekoliduje */
  K.answer(k, "c2", "doubt"); /* c2 je v A nepravda → správně */
  K.answer(k, "c4", "doubt"); /* c4 je v A pravda → špatně */
  K.verify(k, "c2", { via: "clerk" });
  K.verify(k, "c4", { via: "clerk" });
  assert.equal(K.readingExp(k), 1);
  assert.ok(Math.abs(K.certainty(k, "c1", { int: 6 }).p - (before + 0.02)) < 1e-9);
  const noBelief = kauza("A");
  ["c2", "c3"].forEach((c) => K.hear(noBelief, c));
  K.verify(noBelief, "c2", { via: "clerk" });
  assert.equal(K.readingExp(noBelief), 0, "bez názoru se nic neučíš");
});

test("odpověď na fámu: názor se zapíše, neutrální nic, fáma ani lhůta se nezdvojí", () => {
  const k = kauza("A");
  assert.equal(K.answer(k, "c1", "believe", 1).ok, false); /* nezaslechnuto */
  K.hear(k, "c1", { day: 2 });
  const neu = K.answer(k, "c1", "neutral", 2);
  assert.deepEqual([neu.ok, neu.changed, neu.pool], [true, false, null]);
  assert.equal(k.claims.c1.belief, null);
  const dbt = K.answer(k, "c1", "doubt", 2);
  assert.equal(dbt.changed, true);
  assert.equal(k.claims.c1.belief, "doubt");
  assert.ok(dbt.pool.length >= 1);
  assert.equal(K.answer(k, "c1", "doubt", 2).changed, false); /* nepřepíná zpět */
  assert.equal(k.claims.c1.belief, "doubt");
  K.answer(k, "c1", "believe", 3);
  assert.equal(k.events.filter((e) => e.type === "belief_changed").length, 1);
  assert.equal(k.events.filter((e) => e.type === "claim_heard").length, 1);
  assert.equal(k.startDay, 2);
});

test("odpovědi a reakce: 3 volby s podtextem, každé NPC reaguje na věřím i pochybuju, pravda se nemění", () => {
  const k = kauza("B");
  const rs = K.replies(k);
  assert.deepEqual(rs.map((r) => r.id), ["believe", "doubt", "neutral"]);
  assert.ok(rs.every((r) => r.you.length && r.hint));
  for (const npc of Object.values(K.def(k).npcs)) {
    for (const s of ["believe", "doubt"]) assert.ok(npc.react[s].every((t) => typeof t === "string" && t.length));
  }
  const ids = ["c1", "c2", "c3", "c4", "c5", "c6"];
  const before = ids.map((c) => K.truthOf(k, c));
  for (const c of ["c1", "c3"]) {
    K.hear(k, c, { day: 1 });
    K.answer(k, c, "believe", 1);
  }
  assert.deepEqual(ids.map((c) => K.truthOf(k, c)), before);
});

test("názor z odpovědi se počítá do Čtení při rozuzlení", () => {
  const k = kauza("C"); /* c1 = nepravda */
  K.hear(k, "c1", { day: 1 });
  K.answer(k, "c1", "doubt", 1);
  K.verify(k, "c1", { via: "camp" });
  assert.equal(K.readingExp(k), 1);
});

test("návrat k věci: varianta podle názoru a dopadu, jen po rozuzlení a jen jednou", () => {
  const k = kauza("A"); /* A: c2 nepravda, c4 pravda, c3 napůl */
  ["c2", "c3", "c4", "c1"].forEach((c) => K.hear(k, c));
  K.answer(k, "c2", "believe");
  K.answer(k, "c4", "doubt");
  assert.equal(K.follow(k, "c2").available, false, "dokud není rozuzleno");
  assert.equal(K.followUp(k, "c2").ok, false);
  ["c2", "c3", "c4"].forEach((c) => K.verify(k, c, { via: "clerk" }));
  assert.deepEqual(["c2", "c3", "c4"].map((c) => K.follow(k, c).key), ["believe_false", "neutral", "doubt_true"]);
  const f = K.follow(k, "c2");
  assert.ok(f.you.length && f.hint && f.pool.length);
  assert.equal(f.pool, K.def(k).npcs.petr.after.believe_false, "NPC má vlastní odpověď");
  const trust = JSON.stringify(k.trust);
  const r = K.followUp(k, "c2", 3);
  assert.deepEqual([r.ok, r.key], [true, "believe_false"]);
  assert.equal(K.follow(k, "c2").available, false, "podruhé ne");
  assert.equal(K.followUp(k, "c2").ok, false);
  assert.equal(JSON.stringify(k.trust), trust, "žádný mechanický trest");
  assert.equal(k.events.filter((e) => e.type === "claim_followed").length, 1);
});

test("návrat k věci: pokrývá všechny kombinace názoru a pravdy a texty jsou vyplněné", () => {
  const d = K.def(kauza("A"));
  for (const key of ["believe", "doubt"].flatMap((s) => ["true", "half", "false"].map((t) => `${s}_${t}`)).concat("neutral")) {
    assert.ok(d.follow[key].you.length && d.follow[key].hint, key);
    assert.ok(d.afterDefault[key].length, key);
    for (const n of Object.values(d.npcs)) if (n.after) assert.ok(n.after[key].every((t) => t.length), `${n.name} ${key}`);
  }
});

test("Zápisník po kauze: nerozuzlené první, rozuzlené zvlášť", () => {
  const k = kauza("A");
  ["c1", "c2", "c3"].forEach((c) => K.hear(k, c));
  K.verify(k, "c2", { via: "clerk" });
  const nb = K.notebook(k);
  assert.deepEqual([nb.pending, nb.resolved], [["c1", "c3"], ["c2"]]);
});
