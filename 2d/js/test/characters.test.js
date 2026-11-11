const test = require("node:test");
const assert = require("node:assert/strict");
const { BASE, RACE_MOD, CLASS_INFO, RACE_INFO } = require("../data/characters.js");

test("každé povolání má label v CLASS_INFO", () => {
  for (const id of Object.keys(BASE)) assert.ok(CLASS_INFO[id]?.label, `CLASS_INFO.${id}`);
});

test("každá rasa má label a RACE_INFO; součet odchylek = +1", () => {
  for (const [id, mod] of Object.entries(RACE_MOD)) {
    assert.equal(mod.label, RACE_INFO[id]?.label, id);
    assert.ok(RACE_INFO[id]?.blurb, `RACE_INFO.${id}`);
    const sum = (mod.str || 0) + (mod.dex || 0) + (mod.vit || 0) + (mod.int || 0);
    assert.equal(sum, 1, `${id} součet odchylek`);
  }
});
