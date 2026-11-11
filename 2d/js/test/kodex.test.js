const test = require("node:test");
const assert = require("node:assert/strict");
const { KODEX } = require("../data/kodex.js");
const { annotate, markSeen, enabled } = require("../systems/kodex.js");

/* Obecná hesla pro testy mechaniky (annotate běží nad `entries`, ne nad celým seznamem). */
const FIX = [
  { id: "stezka", term: "stezka", forms: ["stezka", "stezky", "stezce", "stezku", "stezkou"], short: "Úzká cesta.", kind: "place" },
  { id: "brana", term: "brána", forms: ["brána", "brány", "bráně", "bránou"], short: "Vjezd do dvora.", kind: "place" },
  { id: "dluh", term: "dluh", forms: ["dluh", "dluhu", "dluhem"], short: "Co se má vrátit.", kind: "trade" },
];
const fix = (html, seen, opts = {}) => annotate(html, seen, { entries: FIX, ...opts });

test("kodex: prolog hesla s povinnými poli a unikátním id", () => {
  assert.ok(KODEX.length >= 1, `počet ${KODEX.length}`);
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
  const html = "Na stezce je tma. Po stezce nic.";
  const once = fix(html, seen);
  assert.match(once, /data-kodex="stezka"/);
  assert.equal((once.match(/data-kodex="stezka"/g) || []).length, 1);
  assert.ok(seen.has("stezka"));
  assert.equal(fix(once, seen), once);
});

test("kodex: návrat na text znovu obalí i už viděné heslo", () => {
  const seen = new Set(["stezka"]);
  const out = fix("Na stezce je tma.", seen);
  assert.match(out, /data-kodex="stezka"/);
  assert.equal(seen.size, 1);
});

test("kodex: skloňování najde tvar z forms", () => {
  const out = fix("Šel po stezce k bráně.", new Set());
  assert.match(out, /data-kodex="stezka">stezce</);
  assert.match(out, /data-kodex="brana">bráně</);
});

test("kodex: vnořené HTML, obalí text, ne tagy", () => {
  const src = `<p class="line">Brána hlídá <em>stezku</em>.</p>`;
  const out = fix(src, new Set());
  assert.match(out, /<abbr class="kodex" data-kodex="brana">Brána<\/abbr>/);
  assert.match(out, /<abbr class="kodex" data-kodex="stezka">stezku<\/abbr>/);
  assert.match(out, /<em>/);
  assert.ok(!out.includes('class="kodex" data-kodex="stezka"><em>'));
});

test("kodex: vypnuto = beze změny", () => {
  const src = "Stezka a dluh.";
  assert.equal(fix(src, new Set(), { prefs: { kodex: false } }), src);
  assert.equal(enabled({ kodex: false }), false);
  assert.equal(enabled({}), true);
  assert.equal(enabled(null), true);
});

test("kodex: žádné obalení uvnitř atributů", () => {
  const src = `<span title="stezka a dluh" data-tip="brána">Cesta vede stezkou.</span>`;
  const out = fix(src, new Set());
  assert.ok(out.includes('title="stezka a dluh"'));
  assert.ok(out.includes('data-tip="brána"'));
  assert.match(out, /data-kodex="stezka">stezkou</);
  assert.equal((out.match(/data-kodex=/g) || []).length, 1);
});

test("kodex: už obalené heslo znovu neobalí", () => {
  const src = `Předtím <abbr class="kodex" data-kodex="stezka">stezka</abbr>, teď zase stezka.`;
  const seen = markSeen(new Set(), "stezka");
  const out = fix(src, seen);
  assert.equal((out.match(/data-kodex="stezka"/g) || []).length, 1);
  assert.ok(out.includes("teď zase stezka"));
});

test("kodex: markSeen je idempotentní", () => {
  const set = new Set();
  markSeen(set, "dluh");
  markSeen(set, "dluh");
  assert.equal(set.size, 1);
});

test("kodex: prolog hesla (korbel, na sekeru) z výchozího seznamu", () => {
  const out = annotate("Svatava postaví korbel. Na sekeru píšu jen známým.", new Set());
  assert.match(out, /data-kodex="korbel"/);
  assert.match(out, /data-kodex="na-sekeru"/);
});
