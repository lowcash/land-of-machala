/*
 * Prolog camera: framing and whole-scene fit for the baked prolog picture. Pure UMD: no DOM, no Math.random, no Date.
 * app.js (applyPrologCamera, peekFitSize) only reads the numbers from here. Docs: docs/reference/scene-compose.md ("Kamera prologu").
 *
 *   BAKE_AR                    aspect of the baked prolog picture (1365 × 768)
 *   frameZoom(shotZoom, mode)  effective zoom: 1 + (zoom − 1) × damp; mode "portrait" 0.4, "short" 0.7, else 1
 *   coverSize(W, H, ar)        picture size when it covers the box (the CSS background-size: cover of the bake)
 *   sceneFit(iw, ih, vw, vh)   whole-scene canvas on the viewport: cover, or contain when the viewport is wider than the picture
 *   framePan(opts)             translate (x, y) that puts the attention point on the target point, clamped so the zoomed picture still covers the box (opts.cover: exact cover clamp)
 *   focusScreen(opts)          where the attention point lands on screen after a pan (x, y) and zoom s
 *   frameInView(opts)          framePan, but the zoom eases towards 1 until the attention point is inside the box; at zoom 1 the picture slides across its cover overflow: { x, y, s }
 *   portraitCropX(W, H, fx)    horizontal background-position (0–1) of the portrait crop that centres focus fx, or null (no crop)
 *   poseRect(rect, box, pose)  screen rect of a picture rect after the camera pose (translate + scale about the box origin)
 *   prologNeedsSceneFade(a, b) fade only when place, style or time of day of two bake keys differ (shot change = camera only)
 *   prologSnapshot(state) / prologRestore(raw, steps)  prolog fields of the player state for sessionStorage, validated on restore
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { PrologCamera: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  /* The bake is authored at 1365 × 768 (see docs/reference/particles.md). */
  const BAKE_AR = 1365 / 768;

  function zoomDamp(mode) {
    if (mode === "portrait") return 0.4; /* phones are small: temper the zoom so faces are not cropped */
    if (mode === "short") return 0.7;
    return 1;
  }

  function frameZoom(shotZoom, mode) {
    const z = Number(shotZoom) || 1;
    return 1 + Math.max(0, z - 1) * zoomDamp(mode);
  }

  /** Cover size of a picture with aspect `ar` in a W × H box: the larger of the two fits, the other side overflows. */
  function coverSize(W, H, ar = BAKE_AR) {
    const ih = Math.max(W / ar, H);
    return { iw: ih * ar, ih };
  }

  /**
   * Whole scene on the viewport. Cover when the viewport is narrower than the picture (sides are cropped and can be
   * panned); contain when it is wider (the picture is letterboxed left and right, nothing to pan).
   */
  function sceneFit(iw, ih, vw, vh) {
    if (!(iw > 0 && ih > 0 && vw > 0 && vh > 0)) return { ew: vw, eh: vh, letterbox: false };
    const wider = vw / vh > iw / ih;
    const k = wider ? Math.min(vw / iw, vh / ih) : Math.max(vw / iw, vh / ih);
    return { ew: iw * k, eh: ih * k, letterbox: wider };
  }

  /**
   * Pan (px) for a background element scaled by `s` about its centre. `focus` is the attention point in picture
   * coordinates (0–1), `bgPos` the CSS background-position of the picture (0–1 per axis), (targetX, targetY) the
   * screen point it should land on. The pan is clamped to ±(s − 1)·W/2, ±(s − 1)·H/2, so the box is never empty.
   * opts.cover: clamp to the exact cover range instead (the picture's left/top edge stays outside the box and its
   * right/bottom edge outside too), so at zoom 1 a cover picture can still slide across its own overflow.
   */
  function framePan(opts) {
    const { W, H, s, focus, bgPos, targetX, targetY, ar = BAKE_AR, cover = false } = opts;
    if (!(W > 0 && H > 0)) return { x: 0, y: 0 };
    const { iw, ih } = coverSize(W, H, ar);
    const px = (W - iw) * bgPos.x + focus.x * iw;
    const py = (H - ih) * bgPos.y + focus.y * ih;
    const cx = W / 2;
    const cy = H / 2;
    let x = targetX - cx - s * (px - cx);
    let y = targetY - cy - s * (py - cy);
    if (cover) {
      const x0 = (W - iw) * bgPos.x; /* picture left edge at s = 1 */
      const y0 = (H - ih) * bgPos.y;
      x = Math.max(W - iw * s - cx - s * (x0 - cx), Math.min(-cx - s * (x0 - cx), x));
      y = Math.max(H - ih * s - cy - s * (y0 - cy), Math.min(-cy - s * (y0 - cy), y));
      return { x, y };
    }
    const maxX = ((s - 1) * W) / 2;
    const maxY = ((s - 1) * H) / 2;
    x = Math.max(-maxX, Math.min(maxX, x));
    y = Math.max(-maxY, Math.min(maxY, y));
    return { x, y };
  }

  /** Screen point (px in the box) of the attention point after a pan (x, y) at zoom s; same maths as framePan. */
  function focusScreen(opts) {
    const { W, H, s, focus, bgPos, x, y, ar = BAKE_AR } = opts;
    const { iw, ih } = coverSize(W, H, ar);
    const px = (W - iw) * bgPos.x + focus.x * iw;
    const py = (H - ih) * bgPos.y + focus.y * ih;
    return { x: W / 2 + x + s * (px - W / 2), y: H / 2 + y + s * (py - H / 2) };
  }

  /**
   * Camera pose that keeps the attention point visible. framePan first; if even the clamped pan leaves the point
   * outside the box, the zoom shrinks towards 1 (the picture is then shown wider, the point comes back into view).
   * At zoom 1 the zoomed-pan clamp is zero, so a point off the centred slice needs the cover clamp: the picture slides
   * across its own overflow (like background-position). Centring at zoom 1 here was the "camera stays centred" bug.
   */
  function frameInView(opts) {
    const { W, H } = opts;
    let s = Math.max(1, Number(opts.s) || 1);
    for (let i = 0; i < 48; i++) {
      const pan = framePan({ ...opts, s });
      const p = focusScreen({ ...opts, s, x: pan.x, y: pan.y });
      if (p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) return { x: pan.x, y: pan.y, s };
      if (s <= 1) break;
      s = 1 + (s - 1) * 0.9;
    }
    const pan = framePan({ ...opts, s: 1, cover: true });
    return { x: pan.x, y: pan.y, s: 1 };
  }

  /**
   * Portrait crop: the bake is cropped to the card-free top band, so the crop slides to centre the subject (fx, 0–1 of
   * the picture). Returns the rounded position, or null when the picture fits the box without a crop.
   */
  function portraitCropX(W, H, fx, ar = BAKE_AR) {
    if (!(W > 0 && H > 0)) return null;
    const iw = Math.max(W / ar, H) * ar;
    if (!(iw > W + 1)) return null;
    return Math.round(Math.max(0, Math.min(1, (W / 2 - fx * iw) / (W - iw))) * 1000) / 1000;
  }

  /**
   * Screen rect `rect` after the prolog camera pose `{ x, y, scale, origin }` is applied to its box (`box` = the
   * untransformed in-flow box). CSS `translate(x, y) scale(s)` about the origin: "center top" (portrait), "center bottom"
   * or "center center". Used to aim a canvas tween at the camera the prolog step will settle on.
   */
  function poseRect(rect, box, pose) {
    const ox = box.left + box.width / 2;
    const oy = pose.origin === "center bottom" ? box.top + box.height : pose.origin === "center top" ? box.top : box.top + box.height / 2;
    const s = Number(pose.scale) || 1;
    const x = Number(pose.x) || 0;
    const y = Number(pose.y) || 0;
    return {
      left: ox + x + s * (rect.left - ox),
      top: oy + y + s * (rect.top - oy),
      width: rect.width * s,
      height: rect.height * s,
    };
  }

  /**
   * Scene of a prolog bake key `<place>-prolog-<style>-<s1|s2>-<phase>[-<weather>]`: place, style and time of day.
   * The shot (s1/s2) and the weather are not part of the scene (the camera moves between shots). Null = not a prolog key.
   */
  function prologSceneOf(key) {
    const m = /^([^-]+)-prolog-([^-]+)-s[12]-([^-]+)(?:-[^-]+)?$/.exec(String(key || ""));
    return m ? `${m[1]}|${m[2]}|${m[3]}` : null;
  }

  /**
   * Fade only when the scene or the time of day changes. Same scene, other shot: camera tween alone (no crossfade,
   * no layer fade over it). Unknown keys (null, first paint) fade.
   */
  function prologNeedsSceneFade(prevKey, nextKey) {
    const a = prologSceneOf(prevKey);
    const b = prologSceneOf(nextKey);
    return a == null || b == null || a !== b;
  }

  /* Player state kept for the tab (sessionStorage) so leaving to Admin and back resumes the same prolog step. */
  const PROLOG_SESSION_FIELDS = [
    "originStep",
    "originReached",
    "prologShot",
    "picks",
    "prologDone",
    "prologBridges",
    "prologStory",
    "prologReact",
    "prologReply",
    "prologCheek",
    "clock",
    "seed",
  ];

  /** Plain JSON-safe copy of the prolog fields of the app state (no DOM, no storage). */
  function prologSnapshot(state) {
    const out = {};
    for (const k of PROLOG_SESSION_FIELDS) out[k] = state[k];
    return out;
  }

  /**
   * Validate a stored prolog snapshot. Returns only the fields that are valid (the caller keeps its defaults for the
   * rest), or null when the step is missing or out of range. `stepCount` = number of prolog steps.
   */
  function prologRestore(raw, stepCount) {
    if (!raw || typeof raw !== "object") return null;
    const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
    const str = (v) => (typeof v === "string" && v.length <= 80 ? v : null);
    const bool = (v) => (typeof v === "boolean" ? v : null);
    const last = Math.max(0, (Number(stepCount) || 1) - 1);
    const originStep = int(raw.originStep, 0, last);
    if (originStep == null) return null;
    const out = { originStep };
    const reached = int(raw.originReached, 0, last);
    out.originReached = Math.max(reached ?? 0, originStep);
    if (raw.prologShot === "s1" || raw.prologShot === "s2") out.prologShot = raw.prologShot;
    if (raw.picks && typeof raw.picks === "object") {
      out.picks = {};
      for (const k of ["class", "race", "origin"]) {
        const v = raw.picks[k];
        if (v === null || str(v) != null) out.picks[k] = v;
      }
    }
    if (raw.prologDone && typeof raw.prologDone === "object") {
      out.prologDone = {};
      for (const k of ["class", "race", "origin"]) {
        const v = bool(raw.prologDone[k]);
        if (v != null) out.prologDone[k] = v;
      }
    }
    if (raw.prologBridges && typeof raw.prologBridges === "object" && !Array.isArray(raw.prologBridges)) {
      out.prologBridges = {};
      for (const [k, v] of Object.entries(raw.prologBridges)) {
        if (/^\d+$/.test(k) && typeof v === "string" && v.length <= 400) out.prologBridges[k] = v;
      }
    }
    const story = bool(raw.prologStory);
    if (story != null) out.prologStory = story;
    if (raw.prologReact === null || str(raw.prologReact) != null) out.prologReact = raw.prologReact;
    if (raw.prologReply === null || str(raw.prologReply) != null) out.prologReply = raw.prologReply;
    const cheek = int(raw.prologCheek, 0, 1e6);
    if (cheek != null) out.prologCheek = cheek;
    const c = raw.clock;
    if (c && int(c.day, 1, 1e9) != null && int(c.tick, 0, 1e9) != null) out.clock = { day: c.day, tick: c.tick };
    const seed = int(raw.seed, 0, 0xffffffff);
    if (seed != null) out.seed = seed;
    return out;
  }

  return {
    BAKE_AR,
    frameZoom,
    coverSize,
    sceneFit,
    framePan,
    focusScreen,
    frameInView,
    portraitCropX,
    poseRect,
    prologSceneOf,
    prologNeedsSceneFade,
    prologSnapshot,
    prologRestore,
  };
});
