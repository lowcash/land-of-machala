const test = require("node:test");
const assert = require("node:assert/strict");
const { KODEX } = require("../data/kodex.js");
const { annotate, markSeen, enabled } = require("../systems/kodex.js");

test("kodex: ~40 hesel s povinnými poli", () => {
  assert.ok(KODEX.length >= 35 && KODEX.length <= 55, `počet ${KODEX.length}`);
  const ids = new Set();
  for (const e of KODEX) {
    assert.ok(e.id && e.term && e.short && Array.isArray(e.forms) && e.forms.length);
    assert.ok(e.kind);
    assert.ok(!ids.has(e.id), `duplicitní id ${e.id}`);
    ids.add(e.id);
  }
});

test("kodex: první výskyt jen jednou, druhé stejné heslo neobalí", () => {
  const seen = new Set();
  const html = "Ve hvozdu je tma. Za hvozdem nic.";
  const once = annotate(html, seen);
  assert.match(once, /data-kodex="hvozd"/);
  assert.equal((once.match(/data-kodex="hvozd"/g) || []).length, 1);
  assert.ok(seen.has("hvozd"));
  const twice = annotate(once, seen);
  assert.equal(twice, once);
});

test("kodex: návrat na text znovu obalí i už viděné heslo", () => {
  const seen = new Set(["hvozd"]);
  const out = annotate("Ve hvozdu je tma.", seen);
  assert.match(out, /data-kodex="hvozd"/);
  assert.equal(seen.size, 1);
});

test("kodex: skloňování najde tvar z forms", () => {
  const seen = new Set();
  const out = annotate("Šel k zemanovi na tvrz.", seen);
  assert.match(out, /data-kodex="zeman"/);
  assert.match(out, /zemanovi/);
  assert.match(out, /data-kodex="tvrz"/);
});

test("kodex: vnořené HTML, obalí text, ne tagy", () => {
  const seen = new Set();
  const src = `<p class="line">Purkrabí hlídá <em>hrad</em>.</p>`;
  const out = annotate(src, seen);
  assert.match(out, /<abbr class="kodex" data-kodex="purkrabi">Purkrabí<\/abbr>/);
  assert.match(out, /<abbr class="kodex" data-kodex="hrad">hrad<\/abbr>/);
  assert.match(out, /<em>/);
  assert.ok(!out.includes('class="kodex" data-kodex="hrad"><em>'));
});

test("kodex: vypnuto = beze změny", () => {
  const src = "Hvozd a mýto a zeman.";
  assert.equal(annotate(src, new Set(), { prefs: { kodex: false } }), src);
  assert.equal(enabled({ kodex: false }), false);
  assert.equal(enabled({}), true);
  assert.equal(enabled(null), true);
});

test("kodex: žádné obalení uvnitř atributů", () => {
  const seen = new Set();
  const src = `<span title="hvozd a zeman" data-tip="mýto">Cesta vede hvozdem.</span>`;
  const out = annotate(src, seen);
  assert.ok(out.includes('title="hvozd a zeman"'));
  assert.ok(out.includes('data-tip="mýto"'));
  assert.match(out, /data-kodex="hvozd">hvozdem</);
  assert.equal((out.match(/data-kodex=/g) || []).length, 1);
});

test("kodex: už obalené heslo znovu neobalí", () => {
  const seen = new Set();
  const src = `Předtím <abbr class="kodex" data-kodex="hvozd">hvozd</abbr>, teď zase hvozd.`;
  markSeen(seen, "hvozd");
  const out = annotate(src, seen);
  assert.equal((out.match(/data-kodex="hvozd"/g) || []).length, 1);
  assert.ok(out.includes("teď zase hvozd"));
});

test("kodex: markSeen je idempotentní", () => {
  const set = new Set();
  markSeen(set, "myto");
  markSeen(set, "myto");
  assert.equal(set.size, 1);
});

test("kodex: dobová hesla z prologu (korbel, na sekeru)", () => {
  const seen = new Set();
  const out = annotate("Svatava postaví korbel. Na sekeru píšu jen známým.", seen);
  assert.match(out, /data-kodex="korbel"/);
  assert.match(out, /data-kodex="na-sekeru"/);
});
