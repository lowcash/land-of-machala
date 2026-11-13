/*
 * Pure display sizing for the 2D scene compositor: devicePixelRatio cap, canvas backing-store
 * size (CSS × dpr × current zoom, no idle double-scale), and srcset-like texture width pick.
 * No DOM. Docs: reference/scene-compose.md (HD buffer).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { SceneDisplay: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DPR_CAP = 3;
  const ZOOM_CAP = 2;
  const MAX_EDGE = 3840;
  const FRAME_W = 1365;
  const FRAME_H = 768;
  const FRAME_AR = FRAME_W / FRAME_H;
  const LAYOUT_MIN_PX = 2;
  /** Common web bake / cast widths (largest first for fallbacks). */
  const TEXTURE_WIDTHS = [3840, 1920, 1280, 720];

  function heightForWidth(w, ar) {
    if (ar == null || ar === FRAME_AR) return Math.max(LAYOUT_MIN_PX, Math.round((w * FRAME_H) / FRAME_W));
    return Math.max(LAYOUT_MIN_PX, Math.round(w / ar));
  }

  /** Desktop / high: max edge × matching frame height. Mobile / low: ~2 MP. */
  const MAX_PIXELS_HIGH = MAX_EDGE * heightForWidth(MAX_EDGE, FRAME_AR);
  const MAX_PIXELS_LOW = 1920 * 1080;

  function pickDevicePixelRatio(rawDpr, cap) {
    const c = Number(cap);
    const lim = Number.isFinite(c) && c > 0 ? c : DPR_CAP;
    const r = Number(rawDpr);
    return Math.min(Math.max(Number.isFinite(r) && r > 0 ? r : 1, 1), lim);
  }

  /**
   * Backing-store size for a CSS stage box. Uses the *current* camera zoom only (not a standing
   * max-zoom budget): an always-on ×2 buffer was CSS-downscaled at rest and looked soft.
   * Never shrinks below CSS × dpr (1:1 device pixels for the stage box), even when maxPixels is
   * the mobile ~2 MP budget – that cap used to force a soft 1920 buffer on HiDPI desktop.
   * opts: { dpr, zoom, dprCap, zoomCap, maxEdge, maxPixels, frameAr, mobile }
   */
  function pickCanvasBufferSize(cssW, opts) {
    const o = opts || {};
    const dpr = pickDevicePixelRatio(o.dpr, o.dprCap != null ? o.dprCap : DPR_CAP);
    const zoomCap = o.zoomCap != null ? o.zoomCap : ZOOM_CAP;
    const zoom = Math.max(1, Math.min(zoomCap, Number(o.zoom) || 1));
    const maxEdge = o.maxEdge != null ? o.maxEdge : MAX_EDGE;
    const maxPixels =
      o.maxPixels != null ? o.maxPixels : o.mobile ? MAX_PIXELS_LOW : MAX_PIXELS_HIGH;
    const ar = o.frameAr != null && o.frameAr > 0 ? o.frameAr : FRAME_AR;
    const css = Math.max(0, Number(cssW) || 0);
    if (!(css >= LAYOUT_MIN_PX)) {
      return { width: LAYOUT_MIN_PX, height: LAYOUT_MIN_PX, dpr, zoom };
    }
    /* Floor: CSS × dpr (no zoom). Zoom/overscan may ask for more, up to maxEdge. */
    const floorW = Math.max(LAYOUT_MIN_PX, Math.min(maxEdge, Math.round(css * dpr)));
    let w = Math.round(css * dpr * zoom);
    w = Math.max(floorW, Math.min(maxEdge, w));
    let h = heightForWidth(w, ar);
    if (w * h > maxPixels) {
      const scale = Math.sqrt(maxPixels / (w * h));
      w = Math.max(floorW, Math.floor(w * scale));
      h = heightForWidth(w, ar);
      if (w * h > maxPixels && w > floorW) {
        h = Math.max(LAYOUT_MIN_PX, Math.floor(maxPixels / w));
      }
    }
    return { width: w, height: h, dpr, zoom };
  }

  /**
   * Srcset-like: smallest listed width that still covers displayCssWidth × dpr (90 % threshold),
   * else the largest. widths default to TEXTURE_WIDTHS ascending internally.
   */
  function pickTextureWidth(displayCssWidth, dpr, widths) {
    const list = (Array.isArray(widths) && widths.length ? widths.slice() : TEXTURE_WIDTHS.slice())
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
    if (!list.length) return 0;
    const need = (Number(displayCssWidth) || 0) * pickDevicePixelRatio(dpr, DPR_CAP);
    if (!(need > 0)) return list[list.length - 1];
    return list.find((w) => w >= need * 0.9) || list[list.length - 1];
  }

  /**
   * On-screen CSS width of the stage bitmap: stage box x camera zoom x parallax overscan. The source
   * tier must follow this (not the bare stage box), or a 1.6x prolog zoom shows a 1920 plate upscaled.
   */
  function displayedStageWidth(stageCssW, zoom, overscan) {
    const w = Number(stageCssW) || 0;
    const z = Math.max(1, Number(zoom) || 1);
    const o = Math.max(1, Number(overscan) || 1);
    return w * z * o;
  }

  /** Width token from a bake/plate URL (`…-1920.avif`), else 0. */
  function textureWidthOfUrl(url) {
    const m = /-(\d+)\.(?:avif|webp|jpe?g)(?:$|\?)/i.exec(String(url || ""));
    return m ? Number(m[1]) : 0;
  }

  function isPowerOfTwo(n) {
    const x = Math.floor(Number(n) || 0);
    return x > 0 && (x & (x - 1)) === 0;
  }

  /** Smallest power of two ≥ n (at least 1). */
  function nextPowerOfTwo(n) {
    let x = Math.max(1, Math.floor(Number(n) || 1));
    let p = 1;
    while (p < x) p *= 2;
    return p;
  }

  /**
   * Soft-upscale ratio for a sprite: (cssWidth × dpr) / naturalWidth. ≤ 1 means the bitmap
   * covers the on-screen device pixels; > 1 means the GPU/CSS must enlarge it.
   */
  function spriteUpscaleFactor(naturalWidth, cssWidth, dpr) {
    const nat = Number(naturalWidth) || 0;
    if (!(nat > 0)) return Infinity;
    const need = (Number(cssWidth) || 0) * pickDevicePixelRatio(dpr, DPR_CAP);
    if (!(need > 0)) return 0;
    return need / nat;
  }

  /** How many GL buffer pixels a frame-space bbox width covers. */
  function spriteBufferWidth(bboxW, frameW, bufferW) {
    const fw = Number(frameW) > 0 ? Number(frameW) : FRAME_W;
    const bw = Number(bufferW) || 0;
    const box = Number(bboxW) || 0;
    if (!(fw > 0 && bw > 0)) return 0;
    return (box / fw) * bw;
  }

  /**
   * In-place: dilate RGB of low-alpha texels from higher-alpha neighbours, then premultiply.
   * Fixes straight-alpha cutouts that store colour in transparent pixels (LINEAR fringe/halo).
   * `rgba` = Uint8ClampedArray length w*h*4.
   */
  function dilateThenPremultiplyRGBA(rgba, w, h) {
    const px = rgba;
    const width = Math.max(0, Math.floor(Number(w) || 0));
    const height = Math.max(0, Math.floor(Number(h) || 0));
    if (!(px && width > 0 && height > 0 && px.length >= width * height * 4)) return rgba;
    const src = new Uint8ClampedArray(px);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (src[i + 3] >= 250) continue;
        let bestA = src[i + 3];
        let br = src[i];
        let bg = src[i + 1];
        let bb = src[i + 2];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const j = (ny * width + nx) * 4;
            if (src[j + 3] > bestA) {
              bestA = src[j + 3];
              br = src[j];
              bg = src[j + 1];
              bb = src[j + 2];
            }
          }
        }
        if (bestA > src[i + 3]) {
          px[i] = br;
          px[i + 1] = bg;
          px[i + 2] = bb;
        }
      }
    }
    for (let i = 0; i < width * height * 4; i += 4) {
      const a = px[i + 3];
      if (a === 255) continue;
      if (a === 0) {
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
        continue;
      }
      px[i] = ((px[i] * a + 127) / 255) | 0;
      px[i + 1] = ((px[i + 1] * a + 127) / 255) | 0;
      px[i + 2] = ((px[i + 2] * a + 127) / 255) | 0;
    }
    return px;
  }

  /**
   * Mean |unpremultiplied-edge-lum − interior-lum| and white/black halo counts on alpha edges.
   * `rgba` straight or premultiplied (pass `premultiplied`); used by smokes and unit tests.
   */
  function measureAlphaEdgeFringe(rgba, w, h, opts) {
    const o = opts || {};
    const width = Math.max(0, Math.floor(Number(w) || 0));
    const height = Math.max(0, Math.floor(Number(h) || 0));
    const px = rgba;
    const premult = !!o.premultiplied;
    const step = Math.max(1, Math.floor(Number(o.step) || 2));
    const out = { samples: 0, whiteHalo: 0, blackHalo: 0, meanLumDiff: 0 };
    if (!(px && width > 2 && height > 2 && px.length >= width * height * 4)) return out;
    let sum = 0;
    for (let y = 1; y < height - 1; y += step) {
      for (let x = 1; x < width - 1; x += step) {
        const i = (y * width + x) * 4;
        const a = px[i + 3];
        if (a < 40 || a > 210) continue;
        let interior = -1;
        for (const [dx, dy] of [
          [3, 0],
          [-3, 0],
          [0, 3],
          [0, -3],
          [5, 0],
          [0, 5],
        ]) {
          const j = ((y + dy) * width + (x + dx)) * 4;
          if (j >= 0 && j + 3 < px.length && px[j + 3] > 230) {
            interior = j;
            break;
          }
        }
        if (interior < 0) continue;
        const edgeLum = premult
          ? (((px[i] + px[i + 1] + px[i + 2]) / 3) * 255) / Math.max(a, 1)
          : (px[i] + px[i + 1] + px[i + 2]) / 3;
        const intLum = (px[interior] + px[interior + 1] + px[interior + 2]) / 3;
        const diff = Math.abs(edgeLum - intLum);
        sum += diff;
        out.samples++;
        if (edgeLum > intLum + 45 && edgeLum > 180) out.whiteHalo++;
        if (edgeLum < intLum - 45 && edgeLum < 50) out.blackHalo++;
      }
    }
    out.meanLumDiff = out.samples ? sum / out.samples : 0;
    return out;
  }

  /** Snap a CSS px length to the device pixel grid (idle pans / stage box). */
  function snapCssToDevicePixel(cssPx, dpr) {
    const d = pickDevicePixelRatio(dpr, DPR_CAP);
    const v = Number(cssPx) || 0;
    return Math.round(v * d) / d;
  }

  /**
   * Peek CSS image: reuse the compositor plate when allowed (same pixels as the scene), else the
   * bake candidate that covers `needWidth` (same or sharper than a soft lower tier).
   * opts: { scenePlateUrl, reuseScenePlate, bakeUrl, bakeCandidates, needWidth }
   */
  function pickPeekImageSource(opts) {
    const o = opts || {};
    const scene = o.scenePlateUrl ? String(o.scenePlateUrl) : "";
    if (scene && o.reuseScenePlate) return { url: scene, via: "scene-plate" };
    const cands = (Array.isArray(o.bakeCandidates) ? o.bakeCandidates : []).map(String).filter(Boolean);
    const bake = o.bakeUrl ? String(o.bakeUrl) : "";
    if (!cands.length) return bake ? { url: bake, via: "bake" } : { url: null, via: "none" };
    const ranked = cands
      .map((url) => ({ url, w: textureWidthOfUrl(url) }))
      .sort((a, b) => a.w - b.w);
    const need = Number(o.needWidth) || 0;
    let pick =
      need > 0 ? ranked.find((x) => x.w >= need * 0.9) || ranked[ranked.length - 1] : ranked[ranked.length - 1];
    if (bake) {
      const b = ranked.find((x) => x.url === bake);
      if (b && b.w >= (pick ? pick.w : 0)) pick = b;
    }
    return { url: pick.url, via: "bake" };
  }

  /**
   * Where an image paints inside a box (contain / cover / auto 100% / 100% 100%).
   * `style` = { size, focus: { x, y } } with size like CSS background-size; focus 0–1.
   */
  function displayedImageRect(box, iw, ih, style) {
    const boxW = box && box.width;
    const boxH = box && box.height;
    const left = (box && box.left) || 0;
    const top = (box && box.top) || 0;
    if (!(boxW > 0 && boxH > 0 && iw > 0 && ih > 0)) {
      return { left, top, width: boxW || 0, height: boxH || 0 };
    }
    const size = String((style && style.size) || "cover")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const focus = (style && style.focus) || { x: 0.5, y: 0.5 };
    const fx = Number.isFinite(focus.x) ? focus.x : 0.5;
    const fy = Number.isFinite(focus.y) ? focus.y : 0.5;
    let dw;
    let dh;
    if (size === "contain") {
      const s = Math.min(boxW / iw, boxH / ih);
      dw = iw * s;
      dh = ih * s;
    } else if (size === "auto 100%" || /^auto\s/.test(size)) {
      dh = boxH;
      dw = boxH * (iw / ih);
    } else if (size === "100% 100%") {
      dw = boxW;
      dh = boxH;
    } else {
      const s = Math.max(boxW / iw, boxH / ih);
      dw = iw * s;
      dh = ih * s;
    }
    return {
      left: left + (boxW - dw) * fx,
      top: top + (boxH - dh) * fy,
      width: dw,
      height: dh,
    };
  }

  return {
    DPR_CAP,
    ZOOM_CAP,
    MAX_EDGE,
    MAX_PIXELS_HIGH,
    MAX_PIXELS_LOW,
    FRAME_AR,
    TEXTURE_WIDTHS,
    pickDevicePixelRatio,
    pickCanvasBufferSize,
    pickTextureWidth,
    displayedStageWidth,
    textureWidthOfUrl,
    isPowerOfTwo,
    nextPowerOfTwo,
    spriteUpscaleFactor,
    spriteBufferWidth,
    dilateThenPremultiplyRGBA,
    measureAlphaEdgeFringe,
    snapCssToDevicePixel,
    pickPeekImageSource,
    displayedImageRect,
  };
});
