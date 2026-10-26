/*
 * Vykreslení částic prologu (pravidla a poloha částic: js/systems/particles.js). Jeden <canvas> uvnitř každého `.landing-bg`
 * s pečeným záběrem (`data-bg^="tavern-prolog-photoreal"`), takže se hýbe, zoomuje a mizí spolu s obrazem (peek, crossfade, letterbox).
 * Geometrie obrazu (cover, pozice) se čte z CSS elementu. 30 fps, pauza ve skryté kartě a při `prefers-reduced-motion`,
 * vypnutí: `?particles=0`. Bez závislosti na stavu hry: kontext dodá `setContext({ on, phase, weather, shot })`.
 */
(function () {
  const LOM = (window.LOM = window.LOM || {});
  const P = LOM.Particles;
  if (!P) return;
  const IW = P.FRAME.w, IH = P.FRAME.h;
  const STEP_MS = 1000 / 30;
  const q = new URLSearchParams(location.search);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let ctx = { on: false, phase: "evening", weather: "clear", shot: "s1" };
  let scene = null;
  let last = 0;
  const views = new Map();

  function setContext(c) {
    ctx = { ...ctx, ...c };
    scene = P.scene(ctx);
  }

  function ensure(el) {
    let v = views.get(el);
    if (v) return v;
    const cv = document.createElement("canvas");
    cv.className = "bg-particles";
    cv.setAttribute("aria-hidden", "true");
    el.appendChild(cv);
    v = { cv, g: cv.getContext("2d"), w: 0, h: 0, dpr: 1, geo: null };
    views.set(el, v);
    return v;
  }

  /** Obraz → CSS px elementu podle `background-size` a `background-position` (poslední vrstva = obraz). */
  function geometry(el, w, h) {
    const cs = getComputedStyle(el);
    const last = (s) => s.split(/,(?![^(]*\))/).pop().trim();
    const size = last(cs.backgroundSize), pos = last(cs.backgroundPosition).split(/\s+/);
    let s = Math.max(w / IW, h / IH);
    if (size === "contain") s = Math.min(w / IW, h / IH);
    else if (size !== "cover") {
      const [a, b] = size.split(/\s+/);
      const px = (t, ref) => (t.endsWith("%") ? (parseFloat(t) / 100) * ref : parseFloat(t));
      if (a && a !== "auto") s = px(a, w) / IW;
      else if (b && b !== "auto") s = px(b, h) / IH;
    }
    const off = (t, free) => (t.endsWith("%") ? (free * parseFloat(t)) / 100 : parseFloat(t) || 0);
    return { s, ox: off(pos[0] || "50%", w - IW * s), oy: off(pos[1] || "50%", h - IH * s) };
  }

  function resize(v, el) {
    const r = el.getBoundingClientRect();
    const w = Math.round(el.clientWidth || r.width), h = Math.round(el.clientHeight || r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (w !== v.w || h !== v.h || dpr !== v.dpr) {
      v.w = w; v.h = h; v.dpr = dpr;
      v.cv.width = Math.max(1, Math.round(w * dpr));
      v.cv.height = Math.max(1, Math.round(h * dpr));
      v.geo = null;
    }
    if (!v.geo && w > 0) v.geo = geometry(el, w, h);
  }

  const RGB = { spark: "255,170,70", ember: "255,110,40", sun: "255,214,150", moon: "170,200,255", day: "255,245,225" };

  function dot(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }

  function draw(v, t) {
    const { g, geo, dpr } = v;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, v.w, v.h);
    if (!geo || !scene) return;
    const s = geo.s, X = (x) => x * s + geo.ox, Y = (y) => y * s + geo.oy;
    g.globalCompositeOperation = "lighter";
    for (const f of scene.glow) { // kolísání plamene: měkká záře kolem knotu
      const k = P.flicker(t, 1, f.id);
      dot(g, X(f.at[0]), Y(f.at[1]), f.r * s * k, "255,170,80", f.a * k);
    }
    const ps = P.sample(scene, t, 1);
    for (const p of ps) {
      if (p.kind === "spark") dot(g, X(p.x), Y(p.y), Math.max(1.6, p.r * 3.4 * s), RGB.spark, Math.min(1, p.a * 1.25));
      else if (p.kind === "mote") dot(g, X(p.x), Y(p.y), Math.max(1.2, p.r * 3.4 * s), RGB[p.tone] || RGB.day, Math.min(1, p.a * 1.3));
    }
    g.globalCompositeOperation = "source-over";
    for (const p of ps) {
      if (p.kind === "smoke") dot(g, X(p.x), Y(p.y), Math.max(2, p.r * s), "120,100,90", p.a);
    }
    for (const p of ps) { // dešť a mlha jen v okně
      if (!p.clip) continue;
      g.save();
      g.beginPath(); g.rect(X(p.clip.x0), Y(p.clip.y0), (p.clip.x1 - p.clip.x0) * s, (p.clip.y1 - p.clip.y0) * s); g.clip();
      if (p.kind === "rain") {
        g.strokeStyle = `rgba(210,225,240,${p.a})`; g.lineWidth = Math.max(1, 1.1 * s); g.beginPath();
        g.moveTo(X(p.x), Y(p.y)); g.lineTo(X(p.x - p.len * 0.35), Y(p.y + p.len)); g.stroke();
      } else if (p.kind === "fog") dot(g, X(p.x), Y(p.y), p.r * s, "235,240,245", p.a);
      g.restore();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < STEP_MS) return;
    last = now;
    const on = ctx.on && !document.hidden && !reduced?.matches && q.get("particles") !== "0";
    const t = now / 1000;
    document.querySelectorAll('.landing-bg[data-bg^="tavern-prolog-photoreal"]').forEach((el) => {
      const v = ensure(el);
      if (!on || el.offsetParent === null) { if (v.w) { v.g.clearRect(0, 0, v.cv.width, v.cv.height); } return; }
      resize(v, el);
      draw(v, t);
    });
  }
  window.addEventListener("resize", () => views.forEach((v) => (v.geo = null)));
  document.addEventListener("transitionend", () => views.forEach((v) => (v.geo = null)), { passive: true });

  LOM.ParticlesView = { setContext };
  requestAnimationFrame(frame);
})();
