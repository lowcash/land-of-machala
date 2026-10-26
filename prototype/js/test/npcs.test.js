const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { KAUZY } = require("../data/kauzy.js");
const { QUESTS } = require("../data/quests.js");

/** PLACE_NPC_ID z app.js (bez spouštění celého app). */
function placeNpcId() {
  const src = fs.readFileSync(path.join(__dirname, "../../app.js"), "utf8");
  const m = src.match(/const PLACE_NPC_ID = \{([^}]+)\}/s);
  assert.ok(m, "PLACE_NPC_ID");
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/(\w+)\s*:\s*"(\w+)"/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

test("kauza: by: a klíče npcs existují a jsou jedinečné", () => {
  for (const [kid, k] of Object.entries(KAUZY)) {
    const ids = Object.keys(k.npcs);
    assert.equal(new Set(ids).size, ids.length, kid);
    for (const c of Object.values(k.claims)) {
      assert.ok(k.npcs[c.by], `${kid}.${c.by}`);
    }
  }
});

test("PLACE_NPC_ID ukazuje na NPC kauzy Zvon (kde existuje) a platná místa", () => {
  const map = placeNpcId();
  const zvon = KAUZY.zvon;
  const places = ["healer", "tavern", "bank", "smith", "gate", "market", "townhall"];
  for (const p of places) assert.ok(map[p], p);
  assert.equal(map.healer, "lidmila");
  assert.equal(map.tavern, "svatava");
  assert.equal(map.bank, "gertruda");
  assert.equal(map.smith, "karel");
  assert.equal(map.gate, "petr");
  assert.equal(map.market, "hanus");
  assert.equal(map.townhall, "gustav");
  for (const id of ["lidmila", "svatava", "gertruda", "petr"]) {
    assert.ok(zvon.npcs[id], id);
  }
});

test("v datech kauz a questů nejsou stará jména jako celé slovo", () => {
  const blob = JSON.stringify(KAUZY) + JSON.stringify(QUESTS);
  assert.doesNotMatch(blob, /\bUda\b/);
  assert.doesNotMatch(blob, /\bBeneš\b/);
  assert.doesNotMatch(blob, /\bHana\b/);
  assert.doesNotMatch(blob, /\bBankéř\b/);
  assert.doesNotMatch(blob, /"uda"/);
  assert.doesNotMatch(blob, /"benes"/);
  assert.doesNotMatch(blob, /"banker"/);
  assert.doesNotMatch(blob, /"klerk"/);
});
