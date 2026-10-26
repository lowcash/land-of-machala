/*
 * Částice a drobný pohyb scény prologu (přehled: docs/reference/particles.md). Čisté funkce bez DOMu a bez Math.random:
 * poloha částice je BEZSTAVOVÁ funkce času t (s), seedu a indexu, takže je deterministická a testovatelná.
 * Souřadnice jsou v pixelech obrazu 1365 × 768 (rám pečených obrazů prologu); vykresluje je js/ui/particles-view.js.
 * Pravidla: celkem nejvýš CAP částic, žádná přes postavy (`avoid`), efekty jen tam, kde to dává smysl (oheň hoří = jiskry, slunce = prach v kuželu).
 */
(function (root, factory) {
  const hash = (typeof require === "function" ? require("./variants.js") : root.LOM.Variants).hash;
  const api = factory(hash);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Particles: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function (hash) {
  const FRAME = { w: 1365, h: 768 };
  const CAP = 36; // částic celkem (dotů a pruhů), bez záře; mobil a baterie
  /* místa v obrazu (změřeno na photoreal r3) */
  const SPOT = {
    hearth: { x0: 945, x1: 1045, y: 338 }, // otvor krbu; jiskry stoupají odtud
    flames: { near: [594, 508], far: [1114, 372], wall: [88, 78], torch: [1176, 150] },
    window: { x0: 300, y0: 174, x1: 482, y1: 306 }, // čtyři tabulky okna
    beam: [[300, 250], [472, 250], [650, 560], [180, 560]], // sluneční kužel z okna ke stolu (večer)
  };
  /* oblasti postav (nekreslit částice přes ně) */
  const AVOID = {
    s1: [[535, 112, 632, 240], [440, 236, 730, 505], [1095, 245, 1275, 425]],
    s2: [[1095, 245, 1275, 425]],
  };

  const unit = (seed, key, i) => hash(seed >>> 0, key, i) / 4294967296; // 0..1
  const frac = (x) => x - Math.floor(x);

  /**
   * Co se v daném záběru děje: seznam vysílačů { kind, n, … }.
   * Čas dne a počasí rozhodují o zdrojích. Volitelné přepisy z kompozitoru:
   * `candleFlame` / `candleSmoke` / `fireSparks` (bool|string|null) — když je klíč přítomen, přebije fázi u svíčky/krbu.
   */
  function scene({
    phase = "evening",
    weather = "clear",
    shot = "s1",
    candleFlame,
    candleSmoke,
    fireSparks,
  } = {}) {
    const lit = phase === "evening" || phase === "night";
    const useCandle = candleFlame != null ? !!candleFlame : lit;
    const useSparks = fireSparks != null ? !!fireSparks : lit;
    const smokeMode = candleSmoke !== undefined ? candleSmoke : lit ? "ambient" : null;
    const e = [];
    if (useSparks) e.push({ kind: "spark", n: 9 });
    if (!useSparks && phase === "morning") e.push({ kind: "ember", n: 3 });
    if (smokeMode === "smouldering") e.push({ kind: "smoke", n: 4, at: [SPOT.flames.near] });
    else if (smokeMode === "embers") e.push({ kind: "smoke", n: 2, at: [[995, 335]] });
    else if (smokeMode === "ambient" || (smokeMode == null && lit && candleFlame == null)) {
      e.push({ kind: "smoke", n: 3, at: ["near", "far", "wall"].map((k) => SPOT.flames[k]) });
    }
    if (phase === "evening" && weather === "clear") e.push({ kind: "mote", n: 12, tone: "sun" });
    else if (phase === "night" && weather === "clear") e.push({ kind: "mote", n: 6, tone: "moon" });
    else if ((phase === "morning" || phase === "noon") && weather === "clear") e.push({ kind: "mote", n: 5, tone: "day" });
    if (weather === "rain") e.push({ kind: "rain", n: 16 });
    if (weather === "fog") e.push({ kind: "fog", n: 5 });
    /* záře kolem plamenů a krbu (r = poloměr px v obraze, a = síla); kolísá podle `flicker` */
    const GLOW = { near: [42, 0.2], far: [30, 0.16], wall: [34, 0.17], torch: [46, 0.2] };
    const glow = useCandle
      ? [...Object.entries(SPOT.flames).map(([k, p]) => ({ kind: "glow", id: k, at: p, r: GLOW[k][0], a: GLOW[k][1] })),
         ...(useSparks ? [{ kind: "glow", id: "hearth", at: [995, 335], r: 120, a: 0.09 }] : [])]
      : useSparks
        ? [{ kind: "glow", id: "hearth", at: [995, 335], r: 120, a: 0.09 }]
        : [];
    const total = e.reduce((s, x) => s + x.n, 0);
    if (total > CAP) {
      const k = CAP / total; // zmenšit poměrně (déšť a jiskry se nesečtou přes strop)
      e.forEach((x) => (x.n = Math.max(1, Math.floor(x.n * k))));
    }
    return { emitters: e, glow, avoid: AVOID[shot] || AVOID.s1, window: SPOT.window };
  }

  const inRects = (x, y, rects) => rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  function inPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  /** Částice v čase t (s): pole { kind, x, y, r, a, tone?, len? } (a = průhlednost 0..1). Bezstavové a deterministické. */
  function sample(sc, t, seed = 1) {
    const out = [];
    for (const em of sc.emitters) {
      for (let i = 0; i < em.n; i++) {
        const k = `${em.kind}${em.tone || ""}`;
        const p = 2.4 + unit(seed, k + "p", i) * 2.6; // perioda životního cyklu (s)
        const u = frac(t / p + unit(seed, k + "o", i));
        const r1 = unit(seed, k + "x", i), r2 = unit(seed, k + "y", i), r3 = unit(seed, k + "s", i);
        if (em.kind === "spark" || em.kind === "ember") {
          const H = SPOT.hearth, rise = 55 + r3 * 90, w = em.kind === "ember" ? 0.35 : 1;
          out.push({
            kind: "spark",
            x: H.x0 + r1 * (H.x1 - H.x0) + Math.sin(u * 6 + r2 * 6) * (6 + 6 * r3),
            y: H.y - u * rise,
            r: 0.9 + r3 * 1.6,
            a: Math.pow(1 - u, 1.6) * (0.55 + 0.45 * Math.sin(t * 9 + i)) * w,
          });
        } else if (em.kind === "smoke") {
          const [cx, cy] = em.at[i % em.at.length];
          out.push({ kind: "smoke", x: cx + Math.sin(u * 5 + i) * 7 * u, y: cy - 4 - u * 58, r: 3 + u * 8, a: 0.17 * Math.sin(Math.PI * u) });
        } else if (em.kind === "mote") {
          const B = SPOT.beam, x = 190 + r1 * 440, y = 255 + r2 * 300;
          if (!inPoly(x, y, B) && em.tone !== "day") continue;
          const day = em.tone === "day"; // denní prach u okna
          const px = (day ? SPOT.window.x0 + r1 * 200 : x) + Math.sin(t * 0.4 + i * 1.7) * 14;
          const py = (day ? SPOT.window.y0 + 20 + r2 * 150 : y) + Math.sin(t * 0.33 + i) * 9 + u * 10;
          out.push({ kind: "mote", tone: em.tone, x: px, y: py, r: 0.9 + r3 * 1.1, a: Math.sin(Math.PI * u) * (day ? 0.28 : 0.5) });
        } else if (em.kind === "rain") {
          const W = SPOT.window, spd = 520 + r3 * 160, len = 12 + r3 * 8;
          const tt = frac(t * (spd / (W.y1 - W.y0 + 30)) + r2);
          out.push({ kind: "rain", x: W.x0 + 25 + r1 * (W.x1 - W.x0) + (1 - tt) * 30, y: W.y0 - 15 + tt * (W.y1 - W.y0 + 30), len, a: 0.34, clip: W });
        } else if (em.kind === "fog") {
          const W = SPOT.window;
          out.push({ kind: "fog", x: W.x0 + frac(r1 + t * (0.01 + 0.02 * r3)) * (W.x1 - W.x0), y: W.y0 + 20 + r2 * (W.y1 - W.y0 - 20), r: 30 + r3 * 40, a: 0.10, clip: W });
        }
      }
    }
    return out.filter((q) => q.clip || !inRects(q.x, q.y, sc.avoid));
  }

  /** Kolísání plamene (záře kolem knotu): násobek 0.8..1.2, součet pomalých sinusů, deterministické. */
  function flicker(t, seed, id) {
    const o = unit(seed, "fl" + id, 0) * 10;
    return 1 + 0.12 * Math.sin(t * 7.3 + o) + 0.08 * Math.sin(t * 13.1 + o * 2) + 0.05 * Math.sin(t * 2.1 + o * 3);
  }

  return { FRAME, CAP, SPOT, AVOID, scene, sample, flicker };
});
