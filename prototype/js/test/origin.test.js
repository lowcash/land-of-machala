const test = require("node:test");
const assert = require("node:assert/strict");
const { ORIGINS } = require("../data/origins.js");
const Origin = require("../systems/origin.js");
const K = require("../systems/kauza.js");
const { INVENTORY } = require("../data/items.js");
const Save = require("../systems/save.js");

const PLACE_KEYS = new Set(["healer", "smith", "bank", "tavern", "gate", "townhall", "market"]);
const ITEM_IDS = new Set(INVENTORY.map((i) => i.id));

test("každý původ: povinná pole, start, standing, item, zlato", () => {
  for (const [id, o] of Object.entries(ORIGINS)) {
    assert.equal(o.id, id);
    assert.ok(o.label && o.blurb && o.icon && o.intro && o.effectsLine);
    assert.ok(o.gold >= 0 && o.bank >= 0);
    assert.ok(o.start.place || (Array.isArray(o.start.cell) && o.start.cell.length === 2));
    if (o.start.place) assert.ok(PLACE_KEYS.has(o.start.place), o.start.place);
    if (o.start.cell) {
      const [x, y] = o.start.cell;
      assert.ok(x >= 0 && x <= 6 && y >= 0 && y <= 6);
    }
    for (const [npc, v] of Object.entries(o.standing || {})) {
      assert.ok(v >= -2 && v <= 2, `${id}.${npc}`);
    }
    if (o.item) assert.ok(ITEM_IDS.has(o.item), o.item);
    for (const pk of Object.keys(o.greet || {})) assert.ok(PLACE_KEYS.has(pk), `${id} greet ${pk}`);
  }
});

test("apply: deterministický; null/neznámý nic nemění; plný batoh nespadne", () => {
  const base = {
    bag: Array(16).fill("ration"),
    gold: 0,
    bank: 0,
    travel: { energy: 14, energyMax: 14 },
    standing: {},
  };
  const a = Origin.apply(base, "apprentice");
  const b = Origin.apply(base, "apprentice");
  assert.deepEqual(a, b);
  assert.equal(a.bag.filter((x) => x === "gloves").length, 0, "plný batoh, věc se nevešla");
  const none = Origin.apply(base, null);
  assert.equal(none.origin, null);
  assert.equal(none.gold, undefined);
  const unk = Origin.apply(base, "nope");
  assert.equal(unk.origin, null);
});

test("trustOf/priceMod/bankFee se standing bez kauzy i s ní", () => {
  const st = { gertruda: -1, karel: 2 };
  assert.equal(K.trustOf(null, "gertruda", st), -1);
  assert.equal(K.bankFee(null, st), 5);
  assert.ok(K.priceMod(null, "karel", st) < 1);
  const k = K.newKauza(1);
  k.trust.gertruda = -1;
  assert.equal(K.trustOf(k, "gertruda", st), -2);
  assert.equal(K.bankFee(k, st), 5);
  k.trust.karel = 1;
  assert.equal(K.trustOf(k, "karel", { karel: 2 }), 2, "strop");
});

test("učeň platí u kováře méně; dlužník má poplatek v bance", () => {
  const app = Origin.apply({ bag: Array(16).fill(null), travel: { energy: 14, energyMax: 14 } }, "apprentice");
  const way = Origin.apply({ bag: Array(16).fill(null), travel: { energy: 14, energyMax: 14 } }, "wayfarer");
  assert.ok(K.priceMod(null, "karel", app.standing) < K.priceMod(null, "karel", way.standing));
  const deb = Origin.apply({ bag: Array(16).fill(null), travel: { energy: 14, energyMax: 14 } }, "debtor");
  assert.equal(K.bankFee(null, deb.standing), 5);
  assert.equal(K.bankFee(null, way.standing), 0);
});

test("startKit: gear z živnosti, reakce a původu", () => {
  const axe = Origin.startKit({ classId: "tracker", originId: "exile", react: "ward", hasClass: true });
  assert.equal(axe.equipped.weapon, "axe");
  assert.equal(axe.equipped.neck, "amulet");
  assert.equal(axe.equipped.shoulders, "cloak");
  assert.equal(axe.equipped.body, "tunic");
  const herbs = Origin.startKit({ classId: "chanter", originId: "native", react: "hide", hasClass: true });
  assert.ok(herbs.bagAdd.includes("herbs"));
  assert.ok(herbs.bagAdd.includes("potion"));
  assert.ok(herbs.bagAdd.includes("ration"));
  assert.equal(herbs.equipped.neck, null);
  const out = Origin.startKit({ classId: "mercenary", originId: "wayfarer", react: "fight", hasClass: true });
  assert.equal(out.equipped.weapon, "wood_sword");
  assert.equal(out.equipped.wrists, "bracers");
  assert.equal(out.equipped.feet, "boots");
  const none = Origin.startKit({ classId: null, originId: "debtor", react: null, hasClass: false });
  assert.equal(none.equipped.weapon, "stick");
  assert.equal(none.equipped.hands, null);
  assert.ok(none.bagAdd.includes("daisy"));
  const app = Origin.startKit({ classId: "legist", originId: "apprentice", react: null, hasClass: true });
  assert.equal(app.equipped.hands, "gloves");
  assert.ok(app.bagAdd.includes("quill"));
  const watch = Origin.startKit({ classId: "mercenary", originId: "watchman", react: null, hasClass: true });
  assert.equal(watch.equipped.head, "cap");
  assert.equal(watch.equipped.shield, "buckler");
});

test("greetPool: původ jen při visits===0, jinak fallback", () => {
  const fb = ["běžný"];
  const first = Origin.greetPool("smith", "apprentice", 0, fb);
  assert.ok(first[0].includes("se zavřenýma"));
  assert.deepEqual(Origin.greetPool("smith", "apprentice", 1, fb), fb);
  assert.deepEqual(Origin.greetPool("smith", null, 0, fb), fb);
  assert.deepEqual(Origin.greetPool("bank", "apprentice", 0, fb), fb, "učeň nemá greet bank");
});

test("round-trip origin a standing", () => {
  const text = Save.serialize({ ...Save.DEFAULTS, name: "A", origin: "exile", standing: { petr: -1 } }, { now: 1 });
  assert.equal(JSON.parse(text).v, Save.SAVE_VERSION);
  const r = Save.deserialize(text);
  assert.equal(r.ok, true);
  assert.equal(r.state.origin, "exile");
  assert.equal(r.state.standing.petr, -1);
});
