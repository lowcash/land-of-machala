/** Visible viewport box (visualViewport when present). */
function peekViewport() {
  const vv = window.visualViewport;
  return {
    vw: vv?.width ?? window.innerWidth,
    vh: vv?.height ?? window.innerHeight,
    top: vv?.offsetTop ?? 0,
    left: vv?.offsetLeft ?? 0,
  };
}

/** Shared scene timing (peek, bake crossfade, scroll-hint) – keep transitions consistent. */
const SCENE_FADE_MS = 420;
/** Same curve as `--scene-fade-ease` in styles.css (melt / stage / letterbox / peek). */
const SCENE_FADE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Prolog peek: full image as a canvas (≥ viewport) so pan never shows empty bars. */
const PEEK_HINT_KEY = "lom.peekHint";
const PEEK_EXPAND_MS = SCENE_FADE_MS;
/** Shared enter/exit (same effect, reversed). */
const PEEK_BLUR = "8px";
const PEEK_DIM = "0.88";
let peekPan = { x: 0, y: 0, scale: 1 };
let peekLayout = { ew: 0, eh: 0, vw: 0, vh: 0 };
/* Pan the eye inherited from the GUI pose: the compositor parallax keeps that offset while the player looks around. */
let peekParallaxBias = { x: 0, y: 0 };
let peekImgCache = { url: "", w: 0, h: 0 };
/** Focus from CSS background-position (0–1); peek entry must match that crop. */
let peekFocus = { x: 0.5, y: 0.5 };
/** Cancels in-flight peek enter/exit (fast re-tap). */
let peekEnterGen = 0;

function peekReduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function peekIsPortrait() {
  return window.matchMedia("(max-aspect-ratio: 1/1)").matches;
}

function peekIsShortLandscape() {
  return window.matchMedia("(min-aspect-ratio: 1/1) and (max-height: 520px)").matches;
}

/**
 * Peek always cover-fills the viewport (no letterbox/pillarbox bars).
 * Player pans/zooms to see the rest – equalizes awkward viewports (landscape, 4:3).
 * Unknown image size → bake aspect (never the viewport box: that squeezed 16:9 into the window).
 */
function peekFitSize(iw, ih, vw, vh) {
  let pw = iw;
  let ph = ih;
  if (!(pw > 0 && ph > 0)) {
    const ar = (typeof LOM !== "undefined" && LOM.PrologCamera?.BAKE_AR) || 1365 / 768;
    pw = ar * 1000;
    ph = 1000;
  }
  const { ew, eh } = LOM.PrologCamera.sceneFit(pw, ph, vw, vh);
  return { ew, eh };
}

/** Resting bake box in screen coords (must match styles.css stage / half / split). */
function peekRestingBox(vw, vh, left, top) {
  if (peekIsPortrait()) {
    return { left, top, width: vw, height: Math.round(vh * 0.46) };
  }
  /* Scene fills the whole screen (no 16:9 letterbox in the resting view). */
  return { left, top, width: vw, height: vh };
}

function peekRestingBgSize() {
  if (peekIsShortLandscape()) return "auto 100%";
  return "cover";
}

/**
 * Where the bake image paints inside a box (contain / cover / auto 100%).
 * `src` = element (live CSS) or `{ size, focus }`.
 */
function peekDisplayedImageRect(box, iw, ih, src) {
  let size;
  let focus;
  if (src && src.nodeType) {
    size = (getComputedStyle(src).backgroundSize || "cover").split(",")[0].trim().toLowerCase();
    focus = readBgFocus(src);
  } else {
    size = String(src?.size || "cover").split(",")[0].trim().toLowerCase();
    focus = src?.focus || { x: 0.5, y: 0.5 };
  }
  const SD = typeof LOM !== "undefined" ? LOM.SceneDisplay : null;
  if (SD && typeof SD.displayedImageRect === "function") {
    return SD.displayedImageRect(box, iw, ih, { size, focus });
  }
  const boxW = box.width;
  const boxH = box.height;
  if (!(boxW > 0 && boxH > 0 && iw > 0 && ih > 0)) {
    return { left: box.left, top: box.top, width: boxW, height: boxH };
  }
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
    left: box.left + (boxW - dw) * focus.x,
    top: box.top + (boxH - dh) * focus.y,
    width: dw,
    height: dh,
  };
}

function peekFlipSignificant(flip) {
  return Math.abs(flip.scale - 1) > 0.02 || Math.abs(flip.dx) > 2 || Math.abs(flip.dy) > 2;
}

/** Pan/scale on the cover canvas so its frame matches `target` rect. */
function peekPanScaleToRect(target, ew, eh, vw, vh, left, top) {
  const scale = Math.min(target.width / Math.max(ew, 1), target.height / Math.max(eh, 1));
  const elCx = left + vw / 2;
  const elCy = top + vh / 2;
  const tCx = target.left + target.width / 2;
  const tCy = target.top + target.height / 2;
  return { x: tCx - elCx, y: tCy - elCy, scale };
}

function peekTransformTransition() {
  return [
    `transform ${PEEK_EXPAND_MS}ms ${SCENE_FADE_EASE}`,
    `filter ${PEEK_EXPAND_MS}ms ${SCENE_FADE_EASE}`,
    `opacity ${PEEK_EXPAND_MS}ms ${SCENE_FADE_EASE}`,
  ].join(", ");
}

/** Short landscape: no transform FLIP (left-fit → cover slides sideways). Fade only. */
function peekFadeTransition() {
  return [
    `filter ${PEEK_EXPAND_MS}ms ${SCENE_FADE_EASE}`,
    `opacity ${PEEK_EXPAND_MS}ms ${SCENE_FADE_EASE}`,
  ].join(", ");
}

/** opts.keepPan: seeded peekPan / peekFocus (boot restore or prolog-pose entry) – do not snap to focus rest. */
function applyPeekCanvas(bg, ew, eh, vw, vh, _offset = {}, opts = {}) {
  peekLayout = { ew, eh, vw, vh };
  if (!opts.keepPan) {
    const p = peekPanForFocus(ew, eh, vw, vh, peekFocus);
    peekPan = { x: p.x, y: p.y, scale: 1 };
  }
  clampPeekPan();
  bg.style.transition = "none";
  /*
   * Absolute inside .origins-stage (translateZ contain + z-index 0 under melt).
   * Fixed-to-viewport painted above the action box → melt fade looked like a jump.
   */
  bg.style.position = "absolute";
  bg.style.zIndex = "0";
  bg.style.width = `${ew}px`;
  bg.style.height = `${eh}px`;
  bg.style.left = `${(vw - ew) / 2}px`;
  bg.style.top = `${(vh - eh) / 2}px`;
  bg.style.right = "auto";
  bg.style.bottom = "auto";
  bg.style.backgroundSize = "100% 100%";
  /* Peek stretches the bake to the cover canvas; prefer high-quality resampling over default. */
  bg.style.imageRendering = "high-quality";
  bg.style.backgroundPosition = "center";
  bg.style.filter = "";
  bg.style.opacity = "";
  bg.style.transform = `translate(${peekPan.x}px, ${peekPan.y}px) scale(${peekPan.scale})`;
  /* The canvas pans/zooms about its centre; a prolog pose left "center bottom" (portrait) behind otherwise. */
  bg.style.transformOrigin = "center center";
  /* Boot restore: strip any leftover soft-crossfade so the cover never stacks two bakes. */
  if (bootPoseSnap) bg.querySelectorAll(":scope > .bg-crossfade").forEach((n) => n.remove());
}

/** Account id for per-user peek prefs (mirrors ClientState / uiPrefKey). */
function peekAccountId() {
  if (typeof ClientState !== "undefined" && ClientState.accountId) return ClientState.accountId();
  try {
    let a = document.documentElement.getAttribute("data-account") || "";
    if (!a) {
      const m = /(?:^|;\s*)lom_account=([^;]*)/.exec(document.cookie || "");
      if (m) a = decodeURIComponent(m[1] || "");
    }
    return a || "anon";
  } catch (_) {
    return "anon";
  }
}

/** Persist eye open + pan/focus to storybook session and per-user localStorage. */
function persistPeekEyeState(open) {
  const snap = {
    open: !!open,
    pan: { x: peekPan.x, y: peekPan.y, scale: peekPan.scale },
    focus: { x: peekFocus.x, y: peekFocus.y },
  };
  const BH = typeof BootHold !== "undefined" ? BootHold : null;
  try {
    const key = "lom.storybook";
    const raw = sessionStorage.getItem(key);
    const cur = raw ? JSON.parse(raw) : null;
    const merged = BH && BH.mergePeekIntoSession ? BH.mergePeekIntoSession(cur, snap) : Object.assign({}, cur || {}, {
      peek: snap.open,
      peekPan: snap.pan,
      peekFocus: snap.focus,
    });
    sessionStorage.setItem(key, JSON.stringify(merged));
  } catch (_) {}
  try {
    const prefKey = BH && BH.peekUiKey ? BH.peekUiKey(peekAccountId()) : `lom.ui.${peekAccountId()}.lom.peek`;
    const body = BH && BH.serializePeekSnap ? BH.serializePeekSnap(snap) : snap;
    if (open) localStorage.setItem(prefKey, JSON.stringify(body));
    else localStorage.removeItem(prefKey);
  } catch (_) {}
}

/** Cover-canvas pan/scale matching the current prologue camera crop; null = not representable (zoom out smoothly). */
function peekCoverPanForProlog(iw, ih, ew, eh, vw, vh, left, top) {
  if (!LOM.PrologCamera?.poseRect) return null;
  const box = peekRestingBox(vw, vh, left, top);
  if (!(box.width > 0 && box.height > 0 && ew > 0 && eh > 0)) return null;
  const pose = prologCameraPose(prologShotNow(), { W: box.width, H: box.height });
  if (!pose || !(pose.scale > 0)) return null;
  /* Scale-1 bg-position slide is not a pure cover pan – keep the smooth zoom-out path. */
  if (pose.bgX != null && pose.scale <= 1.001) return null;
  const target = LOM.PrologCamera.poseRect(
    peekDisplayedImageRect(box, iw, ih, { size: peekRestingBgSize(), focus: pose.focus }),
    box,
    pose
  );
  const pan = peekPanScaleToRect(target, ew, eh, vw, vh, left, top);
  if (!Number.isFinite(pan.scale) || pan.scale <= 0) return null;
  return pan;
}

function peekCoverCanvasActive(bg) {
  const pos = bg?.style?.position;
  return pos === "absolute" || pos === "fixed";
}

function afterPeekTransition(bg, gen, done, ms = PEEK_EXPAND_MS) {
  let finished = false;
  const finish = () => {
    if (finished || gen !== peekEnterGen) return;
    finished = true;
    done();
  };
  const onEnd = (e) => {
    if (e.target !== bg) return;
    /* Transform FLIP or fade-only (filter/opacity) – either ends the beat. */
    if (e.propertyName !== "transform" && e.propertyName !== "opacity" && e.propertyName !== "filter") {
      return;
    }
    bg.removeEventListener("transitionend", onEnd);
    finish();
  };
  bg.addEventListener("transitionend", onEnd);
  setTimeout(finish, ms + 60);
}

/** FLIP invert: final canvas already laid out; make it look like `from`, then animate to center. */
function peekFlipFromRect(bg, from) {
  const to = bg.getBoundingClientRect();
  const fromCx = from.left + from.width / 2;
  const fromCy = from.top + from.height / 2;
  const toCx = to.left + to.width / 2;
  const toCy = to.top + to.height / 2;
  const scale = Math.max(from.width / Math.max(to.width, 1), from.height / Math.max(to.height, 1));
  return {
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
    dx: fromCx - toCx,
    dy: fromCy - toCy,
  };
}

function originsPeekBg() {
  return document.querySelector('[data-screen="origins"] .landing-bg');
}

function peekBgUrl(bg) {
  /* Prefer live style; while compose is mounted the bake URL lives in dataset.bakeBg. */
  const raw = bg?.style?.backgroundImage || bg?.dataset?.bakeBg || getComputedStyle(bg).backgroundImage || "";
  const m = String(raw).match(/url\((['"]?)(.*?)\1\)/);
  return m ? m[2] : "";
}

/** True while eye keeps the live compositor as the picture (no CSS bake swap). */
let peekKeptCompose = false;

/** Compositor plate URL already decoded for the scene (same pixels as the resting view). */
function peekScenePlateUrl() {
  if (typeof scenePlateSrcApplied === "string" && scenePlateSrcApplied) return scenePlateSrcApplied;
  return "";
}

/**
 * Eye mode owns .landing-bg. When the scene compositor is painting, keep it visible so the eye
 * reuses the same bitmap/framing (hiding it and restoring CSS bakeBg was the HD jump). Otherwise
 * fall back to an interactive CSS bake (hide compose if present; restore bakeBg).
 */
function peekSuspendSceneLayer() {
  const bg = originsPeekBg();
  if (!bg) {
    peekKeptCompose = false;
    return;
  }
  const compose = bg.querySelector(":scope > .scene-compose");
  const keepCompose = !!(
    compose &&
    !compose.hidden &&
    typeof LOM !== "undefined" &&
    LOM.SceneView?.enabled &&
    typeof LOM.SceneView.getPlan === "function" &&
    LOM.SceneView.getPlan()
  );
  peekKeptCompose = keepCompose;
  if (keepCompose) {
    LOM.SceneView.pauseBreathForUi?.();
    /* No CSS bake under the plate – a second full background was a different crop/quality. */
    if (bg.style.backgroundImage && bg.style.backgroundImage !== "none") {
      bg.dataset.bakeBg = bg.style.backgroundImage;
      bg.style.backgroundImage = "none";
    }
    return;
  }
  bg.querySelectorAll(":scope > .scene-compose, :scope > .bg-particles").forEach((n) => {
    n.hidden = true;
  });
  if (bg.dataset.bakeBg && (!bg.style.backgroundImage || bg.style.backgroundImage === "none")) {
    bg.style.backgroundImage = bg.dataset.bakeBg;
  }
}

/**
 * The eye opened on the CSS bake before the compositor existed (boot restore). Once the compositor
 * mounts, the eye adopts it: same layers, parallax and particles as the resting view, no flat bake.
 * The bake stays under until the first compositor layer is decoded, so there is no empty frame.
 */
function peekAdoptSceneCompose() {
  const bg = originsPeekBg();
  if (!bg || peekKeptCompose) return;
  const compose = bg.querySelector(":scope > .scene-compose");
  if (!compose || !LOM.SceneView?.getPlan?.()) return;
  peekKeptCompose = true;
  compose.hidden = false;
  bg.querySelectorAll(":scope > .bg-particles").forEach((n) => {
    n.hidden = false;
  });
  LOM.SceneView.pauseBreathForUi?.();
  LOM.SceneView.relayout?.();
  const t0 = performance.now();
  const dropBake = () => {
    if (!peekKeptCompose || !bg.isConnected) return;
    const ready = (LOM.SceneView.getDebugInfo?.().entries || []).some((e) => e.ready);
    if (!ready && performance.now() - t0 < 4000) {
      requestAnimationFrame(dropBake);
      return;
    }
    if (bg.style.backgroundImage && bg.style.backgroundImage !== "none") {
      bg.dataset.bakeBg = bg.style.backgroundImage;
      bg.style.backgroundImage = "none";
    }
  };
  requestAnimationFrame(dropBake);
}

/**
 * Reveal the compositor after / under the eye. opts.underPeek: remount while is-peek is still
 * on, so the first post-exit paint is never an empty frame.
 */
function peekResumeSceneLayer(opts) {
  const underPeek = !!(opts && opts.underPeek);
  const bg = originsPeekBg();
  const kept = peekKeptCompose;
  peekKeptCompose = false;
  if (bg) {
    bg.querySelectorAll(":scope > .scene-compose, :scope > .bg-particles").forEach((n) => {
      n.hidden = false;
    });
    /* Compose owns the plate again: drop the peek bake duplicate when the host is present. */
    if (bg.querySelector(":scope > .scene-compose") && bg.style.backgroundImage && bg.style.backgroundImage !== "none") {
      bg.dataset.bakeBg = bg.style.backgroundImage;
      bg.style.backgroundImage = "none";
    }
  }
  if (kept) LOM.SceneView?.resumeBreathForUi?.();
  if (typeof syncSceneCompose === "function") {
    syncSceneCompose(underPeek ? { underPeek: true } : undefined);
  } else if (typeof setPrologBg === "function") {
    setPrologBg();
  }
}

/**
 * CSS-bake peek only: pick same-or-higher resolution URL, decode, then set backgroundImage
 * before the cover canvas mounts (avoids a soft / differently cropped first paint).
 */
function peekPrepareBakeSource(bg) {
  if (!bg || peekKeptCompose) return Promise.resolve();
  const SD = typeof LOM !== "undefined" ? LOM.SceneDisplay : null;
  const plate = peekScenePlateUrl();
  const reusePlate = !!(plate && typeof scenePlateHasCastApplied !== "undefined" && scenePlateHasCastApplied);
  const bakeUrl = peekBgUrl(bg);
  const key = typeof prologBgKey === "function" ? prologBgKey() : null;
  const cands =
    typeof bakeCandidateUrls === "function" && key ? bakeCandidateUrls(key) : bakeUrl ? [bakeUrl] : [];
  const vw = window.visualViewport?.width || window.innerWidth || 0;
  const dpr = Math.min(window.devicePixelRatio || 1, (SD && SD.DPR_CAP) || 3);
  /* Cover peek stretches the bake; match compositor zoom so HiDPI does not keep a soft tier. */
  const zoom = Math.max(1, Number(peekPan?.scale) || 1);
  const needWidth =
    SD && typeof SD.displayedStageWidth === "function"
      ? SD.displayedStageWidth(vw, zoom, 1) * dpr
      : vw * dpr * zoom;
  const picked =
    SD && typeof SD.pickPeekImageSource === "function"
      ? SD.pickPeekImageSource({
          scenePlateUrl: plate,
          reuseScenePlate: reusePlate,
          bakeUrl,
          bakeCandidates: cands,
          needWidth,
        })
      : { url: reusePlate ? plate : bakeUrl || (cands[0] || null), via: reusePlate ? "scene-plate" : "bake" };
  if (!picked || !picked.url) return Promise.resolve();
  const url = picked.url;
  const apply = () => {
    if (!bg.isConnected) return;
    bg.style.backgroundImage = `url("${url}")`;
    if (bg.dataset) bg.dataset.bakeBg = `url("${url}")`;
  };
  if (typeof decodeBakeUrl === "function") {
    return decodeBakeUrl(url).then(apply, apply);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      apply();
      resolve();
    };
    img.onerror = () => {
      apply();
      resolve();
    };
    img.src = url;
    if (img.complete && img.naturalWidth) {
      apply();
      resolve();
    }
  });
}

/** Parsuje background-position na podíl 0–1 (center/left/… i %). */
function parseBgPosPart(part, axis) {
  const p = String(part || "").trim().toLowerCase();
  if (!p || p === "center") return 0.5;
  if (p === "left" || p === "top") return 0;
  if (p === "right" || p === "bottom") return 1;
  if (p.endsWith("%")) {
    const n = parseFloat(p);
    return Number.isFinite(n) ? n / 100 : 0.5;
  }
  /* délky (px) neřešíme – u pečeného BG je vždy % / keyword */
  return axis === "x" ? 0.5 : 0.5;
}

function readBgFocus(bg) {
  const raw = getComputedStyle(bg).backgroundPosition || "center";
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) {
    const v = parseBgPosPart(parts[0], "x");
    return { x: v, y: v };
  }
  return {
    x: parseBgPosPart(parts[0], "x"),
    y: parseBgPosPart(parts[1], "y"),
  };
}

/** Pan tak, aby výřez seděl na CSS background-position (ne na geometrický střed). */
function peekPanForFocus(ew, eh, vw, vh, focus) {
  return {
    x: (vw - ew) * (focus.x - 0.5),
    y: (vh - eh) * (focus.y - 0.5),
  };
}

/** Snap pan translation to the device-pixel grid (idle only; avoids sub-pixel CSS resampling of the scene). */
function snapPeekPanToDevicePixels() {
  const SD = typeof LOM !== "undefined" ? LOM.SceneDisplay : null;
  const dpr = Math.min(window.devicePixelRatio || 1, (SD && SD.DPR_CAP) || 3);
  if (SD && typeof SD.snapCssToDevicePixel === "function") {
    peekPan.x = SD.snapCssToDevicePixel(peekPan.x, dpr);
    peekPan.y = SD.snapCssToDevicePixel(peekPan.y, dpr);
  } else {
    peekPan.x = Math.round(peekPan.x * dpr) / dpr;
    peekPan.y = Math.round(peekPan.y * dpr) / dpr;
  }
}

function applyPeekTransform(opts) {
  const bg = originsPeekBg();
  if (!bg) return;
  if (opts && opts.snapPixels) snapPeekPanToDevicePixels();
  bg.style.transform = `translate(${peekPan.x}px, ${peekPan.y}px) scale(${peekPan.scale})`;
  LOM.SceneView?.setCamera?.(peekSceneCamera(), { snap: bootPoseSnap });
}

/** Camera the compositor parallax reads: the peek pan plus the bias the eye took over from the GUI pose. */
function peekSceneCamera() {
  return { x: peekPan.x + peekParallaxBias.x, y: peekPan.y + peekParallaxBias.y, scale: peekPan.scale };
}

/** A manual pan / zoom: the camera matches no preset any more, the dropdown shows "---" (and the saved view is left). */
function markSceneShotCustom() {
  if (!sceneDemo || (sceneDemo.shot === "custom" && sceneDemo.shotSel === LOM.SceneControls?.NONE)) return;
  sceneDemo.shot = "custom";
  sceneDemo.shotSel = LOM.SceneControls?.NONE || "---";
  const host = $("dev-scene-camera");
  if (host && LOM.SceneControls) host.innerHTML = sceneShotHtml();
  updateSceneComposeReadout();
  if (!storybookBooting) writeStorybookSession();
}

function clearPeekLayoutStyles(bg) {
  if (!bg) return;
  bg.style.transition = "";
  bg.style.transform = "";
  bg.style.position = "";
  bg.style.zIndex = "";
  bg.style.width = "";
  bg.style.height = "";
  bg.style.left = "";
  bg.style.top = "";
  bg.style.right = "";
  bg.style.bottom = "";
  bg.style.backgroundSize = "";
  bg.style.backgroundPosition = "";
  bg.style.imageRendering = "";
  bg.style.filter = "";
  bg.style.opacity = "";
  bg.classList.remove("is-dragging");
}

/** camera "instant": the prolog pose is set at once (the caller already animated the picture to it). */
function resetPeekTransform(camera = "ease") {
  peekPan = { x: 0, y: 0, scale: 1 };
  peekParallaxBias = { x: 0, y: 0 };
  peekLayout = { ew: 0, eh: 0, vw: 0, vh: 0 };
  clearPeekLayoutStyles(originsPeekBg());
  prologCamKey = "";
  if (camera === "instant") {
    applyPrologCamera(false);
    return;
  }
  /* Back to the resting crop: let the camera ease in from there instead of snapping. */
  requestAnimationFrame(() => requestAnimationFrame(() => applyPrologCamera(true)));
}

/** Cover peek ended on the prolog camera: drop the canvas and set the in-flow pose (already on screen). */
function finishPeekCoverExit(scr, bg) {
  /* Scene under the still-visible peek frame first – no empty paint between cover and in-flow. */
  peekResumeSceneLayer({ underPeek: true });
  peekParallaxBias = { x: 0, y: 0 };
  scr.classList.remove("is-peek", "is-peek-expanding", "is-peek-closing", "is-peek-cover", "is-peek-layout");
  peekPan = { x: 0, y: 0, scale: 1 };
  peekLayout = { ew: 0, eh: 0, vw: 0, vh: 0 };
  prologCamKey = "";
  bg.style.transition = "none";
  bg.style.filter = "";
  bg.style.opacity = "";
  clearPeekLayoutStyles(bg);
  applyPrologCamera(false);
  persistPeekEyeState(false);
  writeStorybookSession();
}

function withPeekImageSize(bg, done) {
  /* Compose-kept peek has no CSS bake; measure the live plate (same aspect as the scene). */
  const url = peekBgUrl(bg) || peekScenePlateUrl();
  if (!url) {
    done(0, 0);
    return;
  }
  if (peekImgCache.url === url && peekImgCache.w > 0) {
    done(peekImgCache.w, peekImgCache.h);
    return;
  }
  const img = new Image();
  img.onload = () => {
    peekImgCache = { url, w: img.naturalWidth, h: img.naturalHeight };
    done(peekImgCache.w, peekImgCache.h);
  };
  img.onerror = () => done(0, 0);
  img.src = url;
}

/** Stage box in screen coords (letterbox/pillarbox peek stays inside). */
function peekStageBox() {
  const stage = document.querySelector('[data-screen="origins"] .origins-stage');
  if (!stage) return null;
  const r = stage.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/**
 * Cover: celý obrázek jako větší plátno; viewport je výřez, pan nesmí ukázat mimo.
 * Stage peek: layout = stage size (letterbox stays); zoom/pan inside.
 * opts.resetPan – nový vstup do peeka (sedí na CSS ohnisko); resize ponechá pan.
 */
function layoutPeekFullImage(done, opts = {}) {
  const scr = document.querySelector('[data-screen="origins"]');
  const bg = originsPeekBg();
  if (!scr || !bg || !scr.classList.contains("is-peek")) {
    done?.();
    return;
  }
  /* Letterbox/pillarbox: keep stage, only remeasure clamps. */
  if (!scr.classList.contains("is-peek-cover")) {
    const box = peekStageBox();
    if (box) {
      peekLayout = { ew: box.width, eh: box.height, vw: box.width, vh: box.height };
      if (opts.resetPan) peekPan = { x: 0, y: 0, scale: 1 };
      clampPeekPan();
      applyPeekTransform();
    }
    done?.();
    return;
  }
  const applySize = (iw, ih) => {
    if (!scr.classList.contains("is-peek")) {
      done?.();
      return;
    }
    const { vw, vh } = peekViewport();
    if (!(vw > 0 && vh > 0)) {
      requestAnimationFrame(() => withPeekImageSize(bg, applySize));
      return;
    }
    const { ew, eh } = peekFitSize(iw, ih, vw, vh);
    const keepPan = !opts.resetPan ? { ...peekPan } : null;
    applyPeekCanvas(bg, ew, eh, vw, vh, {}, { keepPan: !!keepPan });
    if (keepPan) {
      peekPan = keepPan;
      clampPeekPan();
      applyPeekTransform();
    }
    done?.();
  };
  withPeekImageSize(bg, applySize);
}

function clampPeekPan() {
  const { ew, eh, vw, vh } = peekLayout;
  if (!ew || !eh || !vw || !vh) {
    peekPan.x = 0;
    peekPan.y = 0;
    return;
  }
  const s = peekPan.scale;
  /* meze vůči středu elementu; ohniskový offset je uvnitř (ew-vw)/2 */
  const maxX = Math.max(0, (ew * s - vw) / 2);
  const maxY = Math.max(0, (eh * s - vh) / 2);
  peekPan.x = Math.max(-maxX, Math.min(maxX, peekPan.x));
  peekPan.y = Math.max(-maxY, Math.min(maxY, peekPan.y));
}

function setPeekZoom(next, cx, cy) {
  const bg = originsPeekBg();
  if (!bg || !peekLayout.ew) return;
  const prev = peekPan.scale;
  const scale = Math.max(1, Math.min(2.5, next));
  if (Math.abs(scale - prev) < 0.001) return;
  if (cx != null && cy != null && prev > 0) {
    const rect = bg.getBoundingClientRect();
    const px = cx - (rect.left + rect.width / 2);
    const py = cy - (rect.top + rect.height / 2);
    peekPan.x += px * (1 - scale / prev);
    peekPan.y += py * (1 - scale / prev);
  }
  peekPan.scale = scale;
  if (scale <= 1.01) peekPan.scale = 1;
  clampPeekPan();
  applyPeekTransform({ snapPixels: true });
}

function showPeekHintOnce() {
  try {
    if (sessionStorage.getItem(PEEK_HINT_KEY) === "1") return;
    sessionStorage.setItem(PEEK_HINT_KEY, "1");
  } catch (_) {}
  toast("Posuň · přibliž", 2800);
}

/**
 * Cover+pan FLIP where resting crops the bake (portrait / short landscape).
 * Letterbox/pillarbox: keep 16:9 stage, hide UI, pan/zoom inside the shot.
 */
function peekNeedsCover() {
  /* Every viewport: the whole-scene view is the canvas (cover, or contain when letterboxed), so drag can pan it. */
  return true;
}

/** Freeze live computed visual so reverse starts from the current frame (no snap). */
function peekFreezeComputed(bg) {
  if (!bg) return;
  const cs = getComputedStyle(bg);
  bg.style.transition = "none";
  bg.style.transform = cs.transform === "none" ? "translate(0px, 0px) scale(1)" : cs.transform;
  bg.style.filter = cs.filter === "none" ? "none" : cs.filter;
  bg.style.opacity = cs.opacity;
  void bg.offsetWidth;
}

let prologCamKey = "";
/* First boot pose is set without the camera tween (revealBootScene clears it). */
let bootPoseSnap = true;
/** Short landscape: the card sits on the side opposite the subject, so choices never cover who has the attention. */
function prologCardSide(shot) {
  return shot && shot.focus.x > 0.6 ? "left" : "right";
}
/** The camera frames the attention target on every viewport (desktop too); only the whole-scene peek releases it. */
function prologCameraWanted() {
  const scr = document.querySelector('[data-screen="origins"]');
  if (!scr || state.screen !== "origins") return false;
  if (typeof prologSceneVisibleForStep === "function" && !prologSceneVisibleForStep(state.originStep)) return false;
  if (scr.classList.contains("is-peek") || scr.classList.contains("is-peek-expanding")) return false;
  return true;
}

/** The stylesheet's background-position of the bake (not our own slide): cached per size, because a slide overrides it inline. */
let prologBase = null;
function prologBasePos(bg, W, H) {
  const key = `${W}x${H}`;
  if (!prologBase || prologBase.key !== key) {
    const t = bg.style.transition;
    const inline = bg.style.backgroundPosition;
    bg.style.transition = "none";
    bg.style.backgroundPosition = "";
    prologBase = { key, ...readBgFocus(bg) };
    bg.style.backgroundPosition = inline; /* the read must not drop the live crop (its ease would restart from the rest) */
    bg.style.transition = t;
  }
  return prologBase;
}

/** Shot the prolog camera frames now (ORIGIN_STEPS[state.originStep]). */
function prologShotNow() {
  const step = ORIGIN_STEPS[state.originStep];
  return PROLOG_CAMERA[step?.shot] || PROLOG_CAMERA.celek;
}

/**
 * Camera pose of `shot`. `dims` = the in-flow box of the bake (defaults to its live size; a peek canvas is not it).
 * `focus` = the background-position (0–1) the pose sets, so a caller can map the picture onto the same box.
 */
function prologCameraPose(shot, dims) {
  const bg = originsPeekBg();
  const card = originsCard();
  const W = dims ? dims.W : bg?.offsetWidth || 0;
  const H = dims ? dims.H : bg?.offsetHeight || 0;
  if (!(W > 0 && H > 0) || !shot) return { x: 0, y: 0, scale: 1, focus: { x: 0.5, y: 0.5 } };
  const mode = peekIsPortrait() ? "portrait" : peekIsShortLandscape() ? "short" : "wide";
  const s = LOM.PrologCamera.frameZoom(shot.zoom, mode);
  /* The crop this frame is about to set (prologPortraitCrop runs first): the CSS position still reads the old one while its transition runs. */
  const cropX = prologCropX(shot, W, H);
  const pos = cropX == null ? prologBasePos(bg, W, H) : { x: cropX, y: 0.5 };
  /* The stylesheet rest of the bake: a crop or slide away from it moves the picture, which the parallax reads as camera (cam). */
  const rest = bg ? prologBasePos(bg, W, H) : { x: 0.5, y: 0.5 };
  const cover = LOM.PrologCamera.coverSize(W, H);
  const restCam = (fx, fy) => ({ x: (W - cover.iw) * (fx - rest.x), y: (H - cover.ih) * (fy - rest.y) });
  /* Free area: left of the card in short landscape (plus a little of its soft rim); the whole bake elsewhere. */
  let tx = W / 2;
  const ty = H / 2;
  if (peekIsShortLandscape() && card) {
    /* Layout width, not the live rect: the card slides sideways when the side flips. */
    const cw = card.offsetWidth;
    if (prologCardSide(shot) === "left") {
      tx = (cw * 0.9 + W) / 2;
    } else {
      const free = Math.min(W * 0.6, Math.max(W * 0.3, W - cw + cw * 0.1));
      tx = free / 2;
    }
  }
  /* frameInView: the attention point stays inside the box (zoom eases to 1 only if the pan cannot reach it). */
  const view = LOM.PrologCamera.frameInView({ W, H, s, focus: shot.focus, bgPos: pos, targetX: tx, targetY: ty });
  /* Portrait: zoom about the top edge, so the head grows downwards and stays under the notch (a bottom-origin zoom pushed it
   * off the top). Never pan vertically; the bake dissolves into the card below as before. */
  const focus = { x: pos.x, y: pos.y };
  if (peekIsPortrait()) {
    const c = restCam(pos.x, pos.y);
    return { x: view.x, y: 0, scale: view.s, origin: "center top", focus, cam: { x: view.x + c.x, y: c.y } };
  }
  /* Zoom 1: the element box is the viewport, so a transform pan would uncover the far edge (black band). Slide the picture across its cover overflow with background-position instead. */
  if (view.s <= 1 && (Math.abs(view.x) > 0.5 || Math.abs(view.y) > 0.5)) {
    const { iw, ih } = cover;
    const slide = (free, p, d) => (Math.abs(free) > 0.5 ? Math.max(0, Math.min(1, (free * p + d) / free)) : p);
    const bgX = slide(W - iw, pos.x, view.x);
    const bgY = slide(H - ih, pos.y, view.y);
    return { x: 0, y: 0, scale: 1, origin: "center center", bgX, bgY, focus: { x: bgX, y: bgY }, cam: restCam(bgX, bgY) };
  }
  const c = restCam(pos.x, pos.y);
  return { x: view.x, y: view.y, scale: view.s, origin: "center center", focus, cam: { x: view.x + c.x, y: view.y + c.y } };
}

/**
 * Portrait: the bake is cropped to the card-free top band (often far narrower than the picture), and a
 * transform pan cannot reach past that crop – so whoever sits near an image edge was simply not on screen.
 * Slide the crop itself (background-position, which the scene compositor follows) to centre the subject.
 */
let prologCropRaf = 0;
/** Horizontal crop (0–1, rounded like the CSS string) that centres the shot's focus; null = no crop (not portrait, or the picture fits). */
function prologCropX(shot, W, H) {
  if (!peekIsPortrait() || !shot) return null;
  return LOM.PrologCamera.portraitCropX(W, H, shot.focus.x);
}
function prologPortraitCrop(bg, shot, followMs = 0, slide = null) {
  const W = bg.offsetWidth;
  const H = bg.offsetHeight;
  let next = "";
  const px = prologCropX(shot, W, H);
  if (px != null) next = `${(px * 100).toFixed(1)}% center`;
  else if (slide) next = `${(slide.x * 100).toFixed(1)}% ${(slide.y * 100).toFixed(1)}%`;
  if (bg.style.backgroundPosition === next) return;
  bg.style.backgroundPosition = next;
  cancelAnimationFrame(prologCropRaf);
  /* The crop eases with the camera (CSS transition); the compositor re-reads the live position every frame. */
  const t0 = performance.now();
  const follow = () => {
    window.LOM?.SceneView?.relayout?.();
    if (performance.now() - t0 < followMs + 60) prologCropRaf = requestAnimationFrame(follow);
  };
  follow();
}

function applyPrologCamera(animate = true) {
  const shot = prologShotNow();
  document
    .querySelector('[data-screen="origins"]')
    ?.classList.toggle("is-card-left", prologCardSide(shot) === "left");
  if (!prologCameraWanted()) {
    const idle = originsPeekBg();
    if (idle?.style.backgroundPosition && state.screen === "origins" && !document.querySelector('[data-screen="origins"].is-peek')) prologPortraitCrop(idle, null);
    return;
  }
  const bg = originsPeekBg();
  if (!bg) return;
  /* Eye restored at boot (set before first paint): the whole-scene canvas owns the picture, so no camera zoom paints under it.
     resetPeekTransform (on exit) applies the camera again. */
  if (bootPoseSnap && document.querySelector('[data-screen="origins"]')?.classList.contains("is-peek")) return;
  const ease = animate && !bootPoseSnap && !peekReduceMotion() ? Math.round((shot.ease || 0.8) * 1000) : 0;
  bg.style.transition = ease ? `transform ${ease}ms ${SCENE_FADE_EASE}, background-position ${ease}ms ${SCENE_FADE_EASE}` : "none";
  const pose = prologCameraPose(shot);
  prologPortraitCrop(bg, shot, ease, pose.bgX != null ? { x: pose.bgX, y: pose.bgY } : null);
  const key = `${shot.id}|${bg.offsetWidth}x${bg.offsetHeight}`;
  const same = key === prologCamKey && Math.abs(peekPan.x - pose.x) < 0.5 && Math.abs(peekPan.y - pose.y) < 0.5 && Math.abs(peekPan.scale - pose.scale) < 0.001;
  if (same) return;
  prologCamKey = key;
  peekPan = { x: pose.x, y: pose.y, scale: pose.scale };
  /* The parallax camera is the picture's whole move (transform + background-position), not only the transform. */
  peekParallaxBias = pose.cam ? { x: pose.cam.x - pose.x, y: pose.cam.y - pose.y } : { x: 0, y: 0 };
  bg.style.transformOrigin = pose.origin || "center center";
  /* After the camera tween settles, snap to device pixels and re-measure the GL buffer. */
  if (ease > 0) {
    applyPeekTransform();
    LOM.SceneView?.scheduleSettleLayout?.(ease + 32);
    setTimeout(() => applyPeekTransform({ snapPixels: true }), ease + 40);
  } else {
    applyPeekTransform({ snapPixels: true });
    LOM.SceneView?.relayout?.();
  }
}

function peekRestIdentity() {
  return { x: 0, y: 0, scale: 1 };
}

/**
 * Animate from frozen frame to `to` pan/scale, then settle (exit / mid-reverse).
 * Exit stays optically clear into the resting crop – dimming here caused an end snap
 * when settle cleared filter/opacity against a different CSS plate.
 */
function peekAnimateTo(scr, bg, gen, to, done) {
  scr.classList.add("is-peek-expanding", "is-peek-closing");
  peekPan = { x: to.x, y: to.y, scale: to.scale };
  bg.style.transition = peekTransformTransition();
  bg.style.filter = "blur(0px)";
  bg.style.opacity = "1";
  bg.style.transform = `translate(${to.x}px, ${to.y}px) scale(${to.scale})`;
  afterPeekTransition(bg, gen, () => {
    if (gen !== peekEnterGen) return;
    bg.style.transition = "none";
    bg.style.filter = "none";
    bg.style.opacity = "1";
    done();
  });
}

function setPeekButtonState(btn, on) {
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(!!on));
  /* Not “text” – choices/UI return too. Short tips. */
  const tip = on ? "Zpět" : "Rozhlédnout se";
  btn.dataset.tip = tip;
  btn.title = tip;
  btn.setAttribute("aria-label", tip);
  const ico = on
    ? '<svg viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>'
    : '<svg viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const span = btn.querySelector("[aria-hidden]");
  if (span) span.innerHTML = ico;
  else btn.innerHTML = `<span aria-hidden="true">${ico}</span>`;
}

/** Letterbox/pillarbox peek: UI away, pan/zoom inside the stage (pruhy zůstanou). */
function enterStagePeek(scr, bg, gen, opts = {}) {
  const keepPan = !!opts.keepPan;
  /*
   * Mid-exit reverse: zoom back out was in progress – reverse to clear view from current frame.
   */
  if (scr.classList.contains("is-peek") && !scr.classList.contains("is-peek-cover") && peekLayout.ew > 0) {
    peekFreezeComputed(bg);
    scr.classList.remove("is-peek-closing");
    scr.classList.add("is-peek-expanding");
    const to = keepPan ? { ...peekPan } : peekRestIdentity();
    const camNow = peekSceneCamera();
    peekPan = { ...to };
    /* Bias carries the camera the parallax holds now, so the depth shift does not jump while the pan settles. */
    peekParallaxBias = keepPan ? { x: 0, y: 0 } : { x: camNow.x - to.x, y: camNow.y - to.y };
    bg.style.transition = peekTransformTransition();
    bg.style.filter = "blur(0px)";
    bg.style.opacity = "1";
    bg.style.transform = `translate(${to.x}px, ${to.y}px) scale(${to.scale})`;
    afterPeekTransition(bg, gen, () => {
      if (gen !== peekEnterGen) return;
      peekSettleEnterVisual(scr, bg);
      showPeekHintOnce();
      persistPeekEyeState(true);
      writeStorybookSession();
    });
    return;
  }

  const box = peekStageBox();
  if (!keepPan) {
    peekFocus = readBgFocus(bg);
    /* Stage peek starts at the live camera pose (no forced zoom-out to identity). */
    const camNow = peekSceneCamera();
    peekPan = { x: camNow.x, y: camNow.y, scale: camNow.scale > 0 ? camNow.scale : 1 };
    peekParallaxBias = { x: 0, y: 0 };
  } else {
    peekParallaxBias = { x: 0, y: 0 };
  }
  if (box) {
    peekLayout = { ew: box.width, eh: box.height, vw: box.width, vh: box.height };
  } else {
    peekLayout = { ew: 0, eh: 0, vw: 0, vh: 0 };
  }
  clampPeekPan();
  scr.classList.add("is-peek");
  scr.classList.remove("is-peek-cover", "is-peek-expanding");
  bg.style.transformOrigin = "center center";
  applyPeekTransform();
  showPeekHintOnce();
  persistPeekEyeState(true);
  writeStorybookSession();
}

/** End of peek-enter beat: clear dim/blur even if transitionend raced the timeout. */
function peekSettleEnterVisual(scr, bg) {
  bg.style.transition = "none";
  bg.style.filter = "none";
  bg.style.opacity = "1";
  scr.classList.remove("is-peek-expanding", "is-peek-layout");
  applyPeekTransform();
}

/** opts.keepPan: session restore already set peekPan/peekFocus (Cmd+R while eye was open). */
function enterPeekMode(opts = {}) {
  const scr = document.querySelector('[data-screen="origins"]');
  const bg = originsPeekBg();
  if (!scr || !bg) return;
  if (typeof prologSceneVisibleForStep === "function" && !prologSceneVisibleForStep(state.originStep)) return;
  const keepPan = !!opts.keepPan;
  const gen = ++peekEnterGen;
  scr.classList.remove("is-peek-closing");
  /*
   * Mark peeking immediately (before async image measure) so boot's writeStorybookSession
   * and isOriginsPeeking() see the eye as open – otherwise a mid-enter Cmd+R saved peek:false.
   */
  scr.classList.add("is-peek-expanding");
  persistPeekEyeState(true);
  /* One bake only: drop a soft-crossfade leftover before the cover canvas mounts. */
  bg.querySelectorAll(":scope > .bg-crossfade").forEach((n) => n.remove());
  /* Hide the resting scene-compose / particles so only the interactive peek bake remains. */
  peekSuspendSceneLayer();

  if (!peekNeedsCover()) {
    enterStagePeek(scr, bg, gen, { keepPan });
    return;
  }

  /*
   * Mid-exit reverse: keep fixed canvas, animate from the current frame back to cover.
   * (Fresh enter would re-FLIP from resting and jump.)
   */
  if (scr.classList.contains("is-peek-cover") && peekCoverCanvasActive(bg) && peekLayout.ew > 0) {
    peekFreezeComputed(bg);
    scr.classList.add("is-peek", "is-peek-expanding");
    const { ew, eh, vw, vh } = peekLayout;
    if (!keepPan) {
      const p = peekPanForFocus(ew, eh, vw, vh, peekFocus);
      peekPan = { x: p.x, y: p.y, scale: 1 };
    }
    clampPeekPan();
    bg.style.transition = peekTransformTransition();
    bg.style.filter = "blur(0px)";
    bg.style.opacity = "1";
    bg.style.transform = `translate(${peekPan.x}px, ${peekPan.y}px) scale(${peekPan.scale})`;
    afterPeekTransition(bg, gen, () => {
      if (gen !== peekEnterGen) return;
      peekSettleEnterVisual(scr, bg);
      showPeekHintOnce();
      persistPeekEyeState(true);
      writeStorybookSession();
    });
    return;
  }

  /* Read focus before is-peek (portrait/bake change background-position), unless boot restore seeded it. */
  if (!keepPan) {
    peekFocus = readBgFocus(bg);
    peekParallaxBias = { x: 0, y: 0 };
  } else {
    peekParallaxBias = { x: 0, y: 0 };
  }
  const fadeOnly = peekIsShortLandscape();
  let coverRetries = 0;
  const runCoverEnter = () => {
  withPeekImageSize(bg, (iw, ih) => {
    if (gen !== peekEnterGen) return;
    if (!scr.isConnected || !document.body.contains(bg)) return;
    const { vw, vh, top, left } = peekViewport();
    /* Boot / first paint: wait until the viewport has a real box (avoid squeeze from 0×0 → full window). Capped. */
    if (!(vw > 0 && vh > 0)) {
      if (gen !== peekEnterGen || coverRetries >= 60) return;
      coverRetries += 1;
      requestAnimationFrame(runCoverEnter);
      return;
    }
    const { ew, eh } = peekFitSize(iw, ih, vw, vh);
    /* FLIP from the painted image (contain / auto 100% / half-plate), not the BG box. Re-read here, not a stale call-time value. */
    const fromBox = bg.getBoundingClientRect();
    /*
     * Compose-kept: the visible picture is the full plate (cover stage), not a CSS background-size
     * crop of a missing bake – measuring via background would invent a wrong from-rect.
     */
    const from =
      peekKeptCompose && iw > 0 && ih > 0
        ? peekDisplayedImageRect(fromBox, iw, ih, { size: "cover", focus: peekFocus })
        : peekDisplayedImageRect(fromBox, iw, ih, bg);
    /*
     * Prefer starting at the prologue camera pose (same crop/zoom). Zoom-out to the whole bake
     * is only by the user. If that pose cannot be represented on the cover canvas, fall back to
     * a smooth same-layer FLIP toward focus rest (no layer swap).
     */
    let seedKeep = keepPan;
    if (!keepPan) {
      const posePan = peekCoverPanForProlog(iw, ih, ew, eh, vw, vh, left, top);
      if (posePan) {
        peekPan = posePan;
        seedKeep = true;
      } else {
        peekPan = { x: 0, y: 0, scale: 1 };
        seedKeep = false;
      }
    }
    /*
     * Sync kick (0→1 together): expand stage (layout only) → absolute canvas under
     * melt → start visual → one turn add peek classes + arm bg end state.
     * Short landscape = fade only (left-fit FLIP would shoot sideways).
     */
    bg.style.transition = "none";
    scr.classList.add("is-peek-layout");
    void scr.offsetWidth;
    applyPeekCanvas(bg, ew, eh, vw, vh, { top, left }, { keepPan: seedKeep });
    /* Cover canvas + live compose: force cover geometry (100% 100% would read as contain). */
    if (peekKeptCompose) LOM.SceneView?.relayout?.();
    const endT = `translate(${peekPan.x}px, ${peekPan.y}px) scale(${peekPan.scale})`;
    let startT = endT;
    let motion = "fade";
    if (bootPoseSnap || seedKeep) {
      /* Restored / pose-matched: first paint is already the eye crop, no entrance zoom-out. */
      motion = "snap";
    } else if (!fadeOnly) {
      const flip = peekFlipFromRect(bg, from);
      if (!peekReduceMotion() && peekFlipSignificant(flip)) {
        startT = `translate(${peekPan.x + flip.dx}px, ${peekPan.y + flip.dy}px) scale(${flip.scale})`;
        motion = "flip";
      } else {
        motion = "snap";
      }
    } else if (peekReduceMotion()) {
      motion = "snap";
    }
    if (motion === "snap") {
      scr.classList.remove("is-peek-layout");
      scr.classList.add("is-peek", "is-peek-cover");
      peekSettleEnterVisual(scr, bg);
      showPeekHintOnce();
      persistPeekEyeState(true);
      writeStorybookSession();
      return;
    }
    bg.style.filter = `blur(${PEEK_BLUR})`;
    bg.style.opacity = PEEK_DIM;
    bg.style.transform = startT;
    void bg.offsetWidth;
    scr.classList.remove("is-peek-layout");
    scr.classList.add("is-peek", "is-peek-cover", "is-peek-expanding");
    bg.style.transition = motion === "flip" ? peekTransformTransition() : peekFadeTransition();
    bg.style.filter = "blur(0px)";
    bg.style.opacity = "1";
    bg.style.transform = endT;
    afterPeekTransition(bg, gen, () => {
      if (gen !== peekEnterGen) return;
      peekSettleEnterVisual(scr, bg);
      showPeekHintOnce();
      persistPeekEyeState(true);
      writeStorybookSession();
    });
  });
  };
  const kickCoverEnter = () => {
    const go = () => {
      if (gen !== peekEnterGen) return;
      runCoverEnter();
    };
    /* Decode preferred bake before the first cover paint when not reusing the compositor. */
    peekPrepareBakeSource(bg).then(go, go);
  };
  /* Measure after layout (two frames at boot) so the cover canvas keeps bake aspect. */
  if (bootPoseSnap) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (gen !== peekEnterGen) return;
        kickCoverEnter();
      })
    );
  } else kickCoverEnter();
}

function exitPeekMode() {
  const scr = document.querySelector('[data-screen="origins"]');
  const bg = originsPeekBg();
  if (!scr) return;
  const gen = ++peekEnterGen;
  /* Already shrinking / cancelled enter – snap to settled CSS. */
  if (scr.classList.contains("is-peek-expanding") && !scr.classList.contains("is-peek")) {
    peekResumeSceneLayer({ underPeek: true });
    scr.classList.remove("is-peek-expanding", "is-peek-closing", "is-peek-cover", "is-peek-layout");
    resetPeekTransform();
    persistPeekEyeState(false);
    writeStorybookSession();
    return;
  }
  const inPeek = bg && scr.classList.contains("is-peek");
  const settle = () => {
    peekResumeSceneLayer({ underPeek: true });
    scr.classList.remove(
      "is-peek",
      "is-peek-expanding",
      "is-peek-closing",
      "is-peek-cover",
      "is-peek-layout"
    );
    resetPeekTransform();
    persistPeekEyeState(false);
    writeStorybookSession();
  };

  if (!inPeek) {
    settle();
    return;
  }

  if (peekReduceMotion() || !(peekLayout.ew > 0)) {
    settle();
    return;
  }

  /* Stage peek: zoom/pan from current frame back to resting identity, then show UI. */
  if (!scr.classList.contains("is-peek-cover")) {
    const to = peekRestIdentity();
    const midAnim = scr.classList.contains("is-peek-expanding");
    peekFreezeComputed(bg);
    if (
      !midAnim &&
      Math.abs(peekPan.x - to.x) < 1 &&
      Math.abs(peekPan.y - to.y) < 1 &&
      Math.abs(peekPan.scale - to.scale) < 0.02
    ) {
      settle();
      return;
    }
    peekAnimateTo(scr, bg, gen, to, settle);
    return;
  }

  /*
   * Cover peek: from current pan/zoom to resting crop (mid-enter reverse OK).
   * Stage eases via is-peek-closing in parallel with FLIP.
   * Short landscape: fade out → resume scene under peek while invisible → fade in
   * (left-fit FLIP would shoot sideways; dim→snap was the end jump).
   */
  if (peekIsShortLandscape()) {
    peekFreezeComputed(bg);
    scr.classList.add("is-peek-expanding", "is-peek-closing");
    const half = Math.max(160, Math.round(PEEK_EXPAND_MS / 2));
    const fade = `opacity ${half}ms ${SCENE_FADE_EASE}, filter ${half}ms ${SCENE_FADE_EASE}`;
    bg.style.transition = fade;
    bg.style.filter = `blur(${PEEK_BLUR})`;
    bg.style.opacity = "0";
    afterPeekTransition(
      bg,
      gen,
      () => {
        if (gen !== peekEnterGen) return;
        peekResumeSceneLayer({ underPeek: true });
        scr.classList.remove(
          "is-peek",
          "is-peek-expanding",
          "is-peek-closing",
          "is-peek-cover",
          "is-peek-layout"
        );
        resetPeekTransform("instant");
        bg.style.transition = "none";
        bg.style.opacity = "0";
        bg.style.filter = `blur(${PEEK_BLUR})`;
        void bg.offsetWidth;
        bg.style.transition = fade;
        bg.style.opacity = "1";
        bg.style.filter = "blur(0px)";
        afterPeekTransition(
          bg,
          gen,
          () => {
            if (gen !== peekEnterGen) return;
            bg.style.transition = "";
            bg.style.filter = "";
            bg.style.opacity = "";
            persistPeekEyeState(false);
            writeStorybookSession();
          },
          half
        );
      },
      half
    );
    return;
  }
  withPeekImageSize(bg, (iw, ih) => {
    if (gen !== peekEnterGen) return;
    if (!scr.isConnected || !document.body.contains(bg)) {
      peekResumeSceneLayer();
      persistPeekEyeState(false);
      return;
    }
    const { ew, eh, vw, vh } = peekLayout;
    const { top, left } = peekViewport();
    /* Prolog camera missing (not loaded): fall back to the plain settle. */
    if (!LOM.PrologCamera?.poseRect) {
      settle();
      return;
    }
    /*
     * Target first: the pose the prolog step settles on (in-flow box of the bake), mapped onto the canvas frame.
     * The tween goes straight there; it never stops at the resting identity (that stop was the second move).
     */
    const box = peekRestingBox(vw, vh, left, top);
    const pose = prologCameraPose(prologShotNow(), { W: box.width, H: box.height });
    const target = LOM.PrologCamera.poseRect(
      peekDisplayedImageRect(box, iw, ih, { size: peekRestingBgSize(), focus: pose.focus }),
      box,
      pose
    );
    const to = peekPanScaleToRect(target, ew, eh, vw, vh, left, top);
    const midAnim = scr.classList.contains("is-peek-expanding");
    peekFreezeComputed(bg);
    const finish = () => {
      if (gen !== peekEnterGen) return;
      finishPeekCoverExit(scr, bg);
    };
    if (
      !midAnim &&
      Math.abs(peekPan.x - to.x) < 1 &&
      Math.abs(peekPan.y - to.y) < 1 &&
      Math.abs(peekPan.scale - to.scale) < 0.02
    ) {
      finish();
      return;
    }
    /* The compositor's parallax eases to the camera it will hold at the end (same channel as applyPeekTransform). */
    LOM.SceneView?.setCamera?.({ x: (pose.cam || pose).x, y: (pose.cam || pose).y, scale: pose.scale });
    peekAnimateTo(scr, bg, gen, to, finish);
  });
}

function peekAnimBusy(scr) {
  return (
    !!scr &&
    (scr.classList.contains("is-peek-expanding") || scr.classList.contains("is-peek-closing"))
  );
}

function peekCanGesture(scr) {
  return !!scr && scr.classList.contains("is-peek") && peekLayout.ew > 0 && !peekAnimBusy(scr);
}

function initPrologPeekGestures() {
  const scr = document.querySelector('[data-screen="origins"]');
  const bg = originsPeekBg();
  if (!scr || !bg || bg.dataset.peekGestures === "1") return;
  bg.dataset.peekGestures = "1";

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const pointers = new Map();
  let pinchDist = 0;
  let pinchScale = 1;

  bg.addEventListener("pointerdown", (e) => {
    if (!peekCanGesture(scr)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      bg.setPointerCapture(e.pointerId);
    } catch (_) {}
    if (pointers.size === 1) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      bg.classList.add("is-dragging");
    } else if (pointers.size === 2) {
      dragging = false;
      const pts = [...pointers.values()];
      pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      pinchScale = peekPan.scale;
    }
    e.preventDefault();
  });

  bg.addEventListener("pointermove", (e) => {
    if (!peekCanGesture(scr)) return;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      setPeekZoom(pinchScale * (dist / pinchDist), midX, midY);
      markSceneShotCustom();
      return;
    }
    if (!dragging) return;
    peekPan.x += e.clientX - lastX;
    peekPan.y += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    clampPeekPan();
    applyPeekTransform();
    markSceneShotCustom();
  });

  const endPtr = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      dragging = false;
      bg.classList.remove("is-dragging");
      clampPeekPan();
      applyPeekTransform({ snapPixels: true });
      persistPeekEyeState(true);
      writeStorybookSession();
    } else if (pointers.size === 1) {
      const only = [...pointers.values()][0];
      dragging = true;
      lastX = only.x;
      lastY = only.y;
      bg.classList.add("is-dragging");
      pinchDist = 0;
    }
  };
  bg.addEventListener("pointerup", endPtr);
  bg.addEventListener("pointercancel", endPtr);

  bg.addEventListener(
    "wheel",
    (e) => {
      if (!peekCanGesture(scr)) return;
      e.preventDefault();
      setPeekZoom(peekPan.scale + (e.deltaY > 0 ? -0.12 : 0.12), e.clientX, e.clientY);
      markSceneShotCustom();
      persistPeekEyeState(true);
      writeStorybookSession();
    },
    { passive: false }
  );

  bg.addEventListener("dblclick", (e) => {
    if (!peekCanGesture(scr)) return;
    e.preventDefault();
    if (peekPan.scale > 1.05) {
      peekPan.scale = 1;
      clampPeekPan();
      applyPeekTransform({ snapPixels: true });
    } else {
      setPeekZoom(1.8, e.clientX, e.clientY);
    }
    markSceneShotCustom();
    persistPeekEyeState(true);
    writeStorybookSession();
  });

  const onPeekResize = () => {
    if (!scr.classList.contains("is-peek") || peekAnimBusy(scr)) return;
    layoutPeekFullImage();
  };
  window.addEventListener("resize", onPeekResize);
  window.visualViewport?.addEventListener("resize", onPeekResize);
}

/** Read eye snap from per-user pref, else storybook session. */
function readPersistedPeekSnap() {
  const BH = typeof BootHold !== "undefined" ? BootHold : null;
  try {
    const prefKey = BH && BH.peekUiKey ? BH.peekUiKey(peekAccountId()) : `lom.ui.${peekAccountId()}.lom.peek`;
    const raw = localStorage.getItem(prefKey);
    if (raw) {
      const snap = BH && BH.parsePeekSnap ? BH.parsePeekSnap(JSON.parse(raw)) : JSON.parse(raw);
      if (snap && snap.open) return snap;
    }
  } catch (_) {}
  try {
    const raw = sessionStorage.getItem("lom.storybook");
    if (!raw) return null;
    return BH && BH.parsePeekSnap ? BH.parsePeekSnap(JSON.parse(raw)) : null;
  } catch (_) {
    return null;
  }
}

/**
 * If storybook boot raced ahead of async enterPeekMode (or missed keepPan), re-enter once
 * the scene is ready with the saved pan/zoom.
 */
function peekEnsureBootRestore() {
  const BH = typeof BootHold !== "undefined" ? BootHold : null;
  const snap = readPersistedPeekSnap();
  const held = typeof bootHold !== "undefined" && bootHold.held && bootHold.held();
  const already =
    typeof isOriginsPeeking === "function"
      ? isOriginsPeeking()
      : !!document.querySelector('[data-screen="origins"].is-peek, [data-screen="origins"].is-peek-expanding');
  const sceneVisible =
    typeof prologSceneVisibleForStep !== "function" ||
    (typeof state !== "undefined" && prologSceneVisibleForStep(state.originStep));
  const ready = {
    held: !!held,
    screen: typeof state !== "undefined" ? state.screen : null,
    sceneVisible: !!sceneVisible,
    alreadyPeeking: !!already,
  };
  const should = BH && BH.shouldRestorePeek ? BH.shouldRestorePeek(snap, ready) : !!(snap && snap.open && !held && !already && ready.screen === "origins" && sceneVisible);
  if (!should) {
    /* Still booting: retry until hold releases / reveal finishes. */
    if (held || document.documentElement.classList.contains("boot-pending")) {
      setTimeout(peekEnsureBootRestore, 50);
    }
    return;
  }
  if (snap.pan) peekPan = { x: snap.pan.x, y: snap.pan.y, scale: snap.pan.scale };
  if (snap.focus) peekFocus = { x: snap.focus.x, y: snap.focus.y };
  enterPeekMode({ keepPan: true });
  if (typeof setPeekButtonState === "function") {
    setPeekButtonState(document.querySelector(".peek-btn"), true);
  }
}

/* After scripts load: reinforce eye restore once the boot hold / scene is ready. */
setTimeout(peekEnsureBootRestore, 0);
