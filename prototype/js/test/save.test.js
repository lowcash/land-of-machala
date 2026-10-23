const test = require("node:test");
const assert = require("node:assert/strict");
const Save = require("../systems/save.js");

function sampleState(extra) {
  const used = new Set(["Jana Nová", "Petr Kovář"]);
  return {
    name: "Mirek",
    gender: "m",
    literacy: 0,
    picks: { class: "tracker", race: "local", origin: null },
    guest: false,
    originReached: 2,
    prologDone: { class: true, race: true, origin: false },
    origin: null,
    standing: {},
    freeHealAfterDeath: false,
    level: 3,
    xp: 40,
    xpNext: 150,
    hp: 22,
    gold: 120,
    bank: 50,
    bag: ["axe", null, "potion", null, null, null, null, null, null, null, null, null, null, null, null, "ration"],
    equipped: {
      head: "cap",
      shoulders: null,
      neck: null,
      body: "tunic",
      hands: null,
      wrists: null,
      legs: null,
      feet: "boots",
      weapon: "axe",
      shield: null,
      trinket: null,
    },
    travel: { energy: 9, energyMax: 14 },
    mapX: 2,
    mapY: 4,
    prevX: 3,
    prevY: 4,
    discovered: { "3,3": true, "2,4": true, "2,3": true },
    clock: { day: 3, tick: 7 },
    seed: 424242,
    steps: 17,
    spots: [{ id: "s1", x: 1, y: 2, enemyId: "wolf", when: "day" }],
    encounter: null,
    corpseSkip: null,
    corpses: [{ x: 5, y: 5, items: ["mail"], gold: 10, equipped: {} }],
    stash: { items: [{ id: "shovel", day: 2 }] },
    piles: [{ id: 1, x: 1, y: 1, kind: "open", created: 10, items: [{ id: "stick", at: 10, uid: 1 }] }],
    pileSeq: 2,
    quests: { wolves_outside: { status: "active", progress: { wolves: 1 } } },
    kauza: {
      id: "zvon",
      variant: "A",
      seed: 424242,
      startDay: 2,
      claims: { c1: { status: "heard", belief: null, via: "svatava", heardDay: 2, outcome: null } },
      trust: { svatava: 1 },
      facts: {},
      verdict: null,
      events: [],
    },
    flags: { "spared:bandit": 1 },
    kills: { wolf: 2 },
    visits: { tavern: 3 },
    vc: { "greet:tavern:host": 2 },
    placeTalkDone: { tavern: { rumors: true } },
    regulars: { "tavern:regular": { name: "Jana Nová", tic: "kašle" } },
    usedNames: used,
    screen: "town",
    mode: "exits",
    place: null,
    placeView: "hub",
    placeWho: "host",
    /* UI - nesmí se dostat do uložených dat */
    panelStack: ["inventory"],
    placeThread: [{ you: "ahoj" }],
    cellThread: [{ sys: "x" }],
    log: "<p>log</p>",
    combat: { enemyId: "wolf", turns: [] },
    invDiscardIdx: 2,
    equipPickSlot: "weapon",
    flashStats: true,
    kodexSeen: new Set(["zlato"]),
    kodexCache: new Map([["a", "b"]]),
    dev: { reveal: true },
    activeScenario: "demo",
    audio: { muted: true },
    prefs: { lang: "cs" },
    kzReply: { cid: "c1" },
    notebookNew: true,
    cellMenu: "drop",
    weather: { label: "déšť" },
    ...extra,
  };
}

test("round-trip: stejný herní stav (bez UI polí)", () => {
  const src = sampleState();
  const text = Save.serialize(src, { now: 1_700_000_000_000 });
  const env = JSON.parse(text);
  assert.equal(env.v, 4);
  assert.equal(env.savedAt, 1_700_000_000_000);
  assert.ok(env.data);
  assert.equal(env.data.panelStack, undefined);
  assert.equal(env.data.combat, undefined);
  assert.equal(env.data.log, undefined);
  assert.equal(env.data.dev, undefined);

  const r = Save.deserialize(text);
  assert.equal(r.ok, true);
  const got = r.state;
  assert.ok(got.usedNames instanceof Set);
  assert.deepEqual(Array.from(got.usedNames).sort(), ["Jana Nová", "Petr Kovář"]);
  assert.equal(got.bag[0], "axe");
  assert.equal(got.bag[1], null);
  assert.equal(got.bag.length, 16);
  assert.equal(got.gold, 120);
  assert.equal(got.seed, 424242);
  assert.deepEqual(got.clock, { day: 3, tick: 7 });
  assert.equal(got.kauza.variant, "A");
  assert.equal(got.quests.wolves_outside.status, "active");

  const want = {};
  for (const k of Save.FIELD_KEYS) {
    if (k === "usedNames") want[k] = Array.from(src.usedNames).sort();
    else want[k] = src[k];
  }
  const gotCmp = {};
  for (const k of Save.FIELD_KEYS) {
    if (k === "usedNames") gotCmp[k] = Array.from(got.usedNames).sort();
    else gotCmp[k] = got[k];
  }
  assert.deepEqual(gotCmp, want);
});

test("freeHealAfterDeath: round-trip a výchozí false u starého uložení", () => {
  const text = Save.serialize(sampleState({ freeHealAfterDeath: true }), { now: 1 });
  const r = Save.deserialize(text);
  assert.equal(r.ok, true);
  assert.equal(r.state.freeHealAfterDeath, true);
  const old = Save.deserialize(JSON.stringify({ v: 4, savedAt: 1, data: { name: "X", seed: 1 } }));
  assert.equal(old.ok, true);
  assert.equal(old.state.freeHealAfterDeath, false);
});

test("poškozený JSON a neobjekt", () => {
  assert.deepEqual(Save.deserialize("{"), { ok: false, reason: "json" });
  assert.deepEqual(Save.deserialize(""), { ok: false, reason: "json" });
  assert.deepEqual(Save.deserialize(null), { ok: false, reason: "json" });
  assert.equal(Save.deserialize('"jen řetězec"').ok, false);
});

test("chybějící pole se doplní výchozím", () => {
  const text = JSON.stringify({ v: Save.SAVE_VERSION, savedAt: 1, data: { name: "A", seed: 9, gold: 5 } });
  const r = Save.deserialize(text);
  assert.equal(r.ok, true);
  assert.equal(r.state.name, "A");
  assert.equal(r.state.seed, 9);
  assert.equal(r.state.gold, 5);
  assert.equal(r.state.level, Save.DEFAULTS.level);
  assert.equal(r.state.bag.length, 16);
  assert.equal(r.state.bag[0], null);
  assert.deepEqual(r.state.picks, Save.DEFAULTS.picks);
  assert.ok(r.state.usedNames instanceof Set);
  assert.equal(r.state.usedNames.size, 0);
});

test("neznámá verze se odmítne", () => {
  assert.deepEqual(Save.deserialize(JSON.stringify({ v: 99, savedAt: 1, data: {} })), {
    ok: false,
    reason: "version",
  });
  for (const v of [0, 1, 2, 3]) {
    assert.deepEqual(Save.deserialize(JSON.stringify({ v, savedAt: 1, data: {} })), { ok: false, reason: "version" }, `starší v${v} se tváří jako žádné`);
  }
});

test("validate odmítne poškozená data, nevyhodí", () => {
  assert.equal(Save.validate(null).ok, false);
  assert.equal(Save.validate({ v: Save.SAVE_VERSION, data: { bag: "x" } }).reason, "bag");
  assert.equal(Save.validate({ v: Save.SAVE_VERSION, data: { seed: "x" } }).reason, "seed");
  assert.equal(Save.validate({ v: Save.SAVE_VERSION, data: {} }).ok, true);
  assert.doesNotThrow(() => Save.validate(undefined));
  assert.doesNotThrow(() => Save.deserialize("not json"));
});

test("žádná UI pole v uložených datech", () => {
  const text = Save.serialize(sampleState());
  const data = JSON.parse(text).data;
  const ui = [
    "panelStack",
    "panelTab",
    "placeThread",
    "cellThread",
    "log",
    "combat",
    "invDiscardIdx",
    "equipPickSlot",
    "equipConfirm",
    "flashStats",
    "flashGear",
    "flashKeys",
    "kodexSeen",
    "kodexCache",
    "dev",
    "activeScenario",
    "audio",
    "prefs",
    "kzReply",
    "notebookNew",
    "cellMenu",
    "weather",
    "auth",
    "confirmDelete",
    "lootLeaveConfirm",
  ];
  for (const k of ui) assert.equal(data[k], undefined, k);
  for (const k of Object.keys(data)) assert.ok(Save.FIELD_KEYS.includes(k), `navíc: ${k}`);
});

test("velikost typického stavu < 100 kB", () => {
  const text = Save.serialize(sampleState());
  assert.ok(Buffer.byteLength(text, "utf8") < 100 * 1024, `bytes=${Buffer.byteLength(text)}`);
});

test("round-trip verze 4; neznámá verze odmítnutá", () => {
  const text = Save.serialize(sampleState(), { now: 2 });
  assert.equal(JSON.parse(text).v, 4);
  assert.equal(Save.deserialize(text).ok, true);
});

test("STORAGE_KEY a verze jsou exportované", () => {
  assert.equal(Save.STORAGE_KEY, "lom.save");
  assert.equal(Save.SAVE_VERSION, 4);
});
