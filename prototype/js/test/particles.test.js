const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../systems/particles.js");

const PHASES = ["morning", "noon", "evening", "night"];
const count = (sc, t = 3.3) => P.sample(sc, t).length;

test("částice: deterministické a bezstavové (stejný čas = stejný výsledek, nezávisí na pořadí volání)", () => {
  const sc = P.scene({ phase: "evening", weather: "clear", shot: "s1" });
  const a = JSON.stringify(P.sample(sc, 7.25, 3));
  P.sample(sc, 1.0, 3);
  assert.equal(JSON.stringify(P.sample(sc, 7.25, 3)), a);
  assert.notEqual(JSON.stringify(P.sample(sc, 7.25, 4)), a);
});

test("částice: strop počtu ve všech kombinacích a nikdy mimo rám obrazu (±40 px)", () => {
  for (const phase of PHASES) for (const weather of ["clear", "overcast", "rain", "fog"]) for (const shot of ["s1", "s2"]) {
    const sc = P.scene({ phase, weather, shot });
    for (let t = 0; t < 20; t += 0.7) {
      const ps = P.sample(sc, t, 5);
      assert.ok(ps.length <= P.CAP, `${phase}/${weather}/${shot}: ${ps.length}`);
      for (const q of ps) {
        assert.ok(q.x > -40 && q.x < P.FRAME.w + 40 && q.y > -40 && q.y < P.FRAME.h + 40, `${phase} ${q.kind} ${q.x},${q.y}`);
        assert.ok(q.a >= 0 && q.a <= 1);
      }
    }
  }
});

test("částice: jiskry jen když hoří oheň, prach ve slunci jen večer a za jasna, déšť jen v dešti", () => {
  const kinds = (o) => new Set(P.scene(o).emitters.map((e) => e.kind + (e.tone ? ":" + e.tone : "")));
  assert.ok(kinds({ phase: "evening" }).has("spark") && kinds({ phase: "night" }).has("spark"));
  assert.ok(!kinds({ phase: "noon" }).has("spark") && !kinds({ phase: "morning" }).has("spark"));
  assert.ok(kinds({ phase: "morning" }).has("ember"));
  assert.ok(kinds({ phase: "evening", weather: "clear" }).has("mote:sun"));
  assert.ok(!kinds({ phase: "evening", weather: "rain" }).has("mote:sun") && kinds({ phase: "evening", weather: "rain" }).has("rain"));
  assert.ok(!kinds({ phase: "noon", weather: "clear" }).has("rain") && kinds({ phase: "noon", weather: "fog" }).has("fog"));
});

test("částice: žádná (kromě oříznutých do okna) se nekreslí přes postavy", () => {
  for (const shot of ["s1", "s2"]) {
    const sc = P.scene({ phase: "evening", weather: "clear", shot });
    for (let t = 0; t < 30; t += 0.9) for (const q of P.sample(sc, t, 2)) {
      if (q.clip) continue;
      const inside = sc.avoid.some(([x0, y0, x1, y1]) => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1);
      assert.equal(inside, false, `${shot} ${q.kind} ${q.x},${q.y}`);
    }
  }
});

test("částice: záře svíček kolísá v rozumných mezích a jen když hoří", () => {
  for (let t = 0; t < 10; t += 0.3) { const f = P.flicker(t, 1, "near"); assert.ok(f > 0.7 && f < 1.3, String(f)); }
  assert.equal(P.scene({ phase: "noon" }).glow.length, 0);
  assert.equal(P.scene({ phase: "night" }).glow.length, 5);
  assert.ok(count(P.scene({ phase: "evening" })) > 5);
});
