const test = require("node:test");
const assert = require("node:assert/strict");
const { BASE, RACE_MOD, CLASS_INFO, RACE_INFO } = require("../data/characters.js");
const { LEVEL_GAIN } = require("../systems/world.js");
const { specialName } = require("../ui/combat-text.js");
const { KAUZY } = require("../data/kauzy.js");

const SPECIAL_NAME = {
  mercenary: "Úder štítem",
  tracker: "Přesná střela",
  chanter: "Zaříkání",
  legist: "Důrazná výtka",
};

test("každé povolání má LEVEL_GAIN, speciál a classTag ve všech kauzách", () => {
  for (const id of Object.keys(BASE)) {
    assert.ok(LEVEL_GAIN[id], `LEVEL_GAIN.${id}`);
    assert.ok(CLASS_INFO[id]?.label, `CLASS_INFO.${id}`);
    assert.equal(specialName(id), SPECIAL_NAME[id], `SPECIAL.${id}`);
    for (const [kid, k] of Object.entries(KAUZY)) {
      assert.ok(k.classTag[id], `${kid}.classTag.${id}`);
    }
  }
});

test("každá rasa má label, RACE_INFO a raceTag; součet odchylek = +1", () => {
  for (const [id, mod] of Object.entries(RACE_MOD)) {
    assert.equal(mod.label, RACE_INFO[id]?.label, id);
    assert.ok(RACE_INFO[id]?.blurb, `RACE_INFO.${id}`);
    const sum = (mod.str || 0) + (mod.dex || 0) + (mod.vit || 0) + (mod.int || 0);
    assert.equal(sum, 1, `${id} součet odchylek`);
    for (const [kid, k] of Object.entries(KAUZY)) {
      assert.ok(k.raceTag && k.raceTag[id], `${kid}.raceTag.${id}`);
    }
  }
});
