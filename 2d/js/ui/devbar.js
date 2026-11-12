/** Filled by initStatusBox – same clamp for the Stav systému box (it follows the dev box visibility). */
let clampStatusBar = () => {};
/** Veřejný export přepíše na true: ukázka končí po prologu (bez pokračování do hry). */
const PUBLIC_DEMO = true;

const DEV_BAR_KEY = "lom.devBarCollapsed";
/* Stav systému box: same prefs model as the dev box, its own key. */
const STATUS_BAR_KEY = "lom.statusBarCollapsed";
const DEV_VIS_KEY = "lom.dev";
/* Per-account localStorage key (mirrors ClientState.uiKey; 2d page may not load client-state.js). */
function uiPrefKey(name) {
  if (typeof ClientState !== "undefined" && ClientState.uiKey) return ClientState.uiKey(name);
  let a = "anon";
  try {
    a = document.documentElement.getAttribute("data-account") || "";
    if (!a) {
      const m = /(?:^|;\s*)lom_account=([^;]*)/.exec(document.cookie || "");
      if (m) a = decodeURIComponent(m[1] || "");
    }
  } catch (_) {}
  if (!a) a = "anon";
  return "lom.ui." + a + "." + name;
}
/* The one reset of the dev box (chrome preset ↺). Inner section/object resets are hidden in CSS. */
const DEV_RESET_TITLE = "Obnovit podle presetu scény";
const DEV_KNOB_SEC = {
  mode: "world",
  place: "world",
  phase: "cas",
  prologShot: "world",
  prologStyle: "world",
};

/* slider 0 = pryč; 1–100 = použitelný rozsah 20–80 % (původní mapování) */
const DEV_OP_MIN = 0.2;
const DEV_OP_MAX = 0.8;
const devSliderToOpacity = (v) => (v <= 0 ? 0 : DEV_OP_MIN + ((DEV_OP_MAX - DEV_OP_MIN) * Math.min(100, v)) / 100);
const devOpacityToSlider = (o) => (o <= 0 ? 0 : Math.max(1, Math.min(100, Math.round(((o - DEV_OP_MIN) / (DEV_OP_MAX - DEV_OP_MIN)) * 100))));

/* Stav systému transparency: per-account localStorage. Default = fully opaque slider (DEV_OP_MAX), like the dev box. */
const STATUS_OPACITY_KEY = "lom.statusOpacity";
function loadStatusOpacity() {
  try {
    const n = parseFloat(localStorage.getItem(uiPrefKey(STATUS_OPACITY_KEY)));
    if (Number.isFinite(n)) return Math.min(DEV_OP_MAX, Math.max(0, n));
  } catch (_) {}
  return DEV_OP_MAX;
}

function saveStatusOpacity(opacity) {
  try {
    localStorage.setItem(uiPrefKey(STATUS_OPACITY_KEY), String(opacity));
  } catch (_) {}
}

function applyDevOpacity(bar, opacity, sliderId = "dev-opacity") {
  const o = Math.min(DEV_OP_MAX, Math.max(0, opacity));
  bar.style.setProperty("--dev-opacity", String(o));
  const op = $(sliderId);
  if (op) op.value = String(devOpacityToSlider(o));
}

function loadDevBarPrefs(key = DEV_BAR_KEY) {
  const out = {
    collapsed: true,
    minimized: false,
    opacity: 0.8,
    x: null,
    y: null,
    w: null,
    h: null,
    sections: {
      cas: true,
      svet: true,
      world: true,
      boj: false,
      debug: false,
    },
  };
  try {
    const raw = localStorage.getItem(uiPrefKey(key));
    if (raw === "1" || raw === "0") {
      out.collapsed = raw === "1";
      return out;
    }
    if (raw) {
      const j = JSON.parse(raw);
      if (typeof j.collapsed === "boolean") out.collapsed = j.collapsed;
      if (typeof j.minimized === "boolean") out.minimized = j.minimized;
      if (typeof j.opacity === "number") out.opacity = Math.min(DEV_OP_MAX, Math.max(0, j.opacity));
      if (typeof j.x === "number") out.x = j.x;
      if (typeof j.y === "number") out.y = j.y;
      if (typeof j.w === "number" && j.w > 0) out.w = j.w;
      if (typeof j.h === "number" && j.h > 0) out.h = j.h;
      if (j.sections && typeof j.sections === "object") {
        for (const k of Object.keys(out.sections)) if (typeof j.sections[k] === "boolean") out.sections[k] = j.sections[k];
      }
    }
  } catch (_) {}
  return out;
}

function saveDevBarPrefs(prefs, key = DEV_BAR_KEY) {
  try {
    localStorage.setItem(uiPrefKey(key), JSON.stringify(prefs));
  } catch (_) {}
}

/**
 * Open / closed state of the collapsible subsections of the dev box (Čas, Počasí, Kamera, Pozice, Objekty, Efekty); per account.
 * Only boolean values for the current keys are read: stale or hand-edited storage falls back to the HTML default.
 */
const DEV_SUB_KEY = "lom.devSub";
const DEV_SUB_IDS = ["cas", "pocasi", "kamera", "pozice", "objekty", "efekty"];
function loadDevSubPrefs() {
  const out = {};
  try {
    const j = JSON.parse(localStorage.getItem(uiPrefKey(DEV_SUB_KEY)) || "null");
    if (j && typeof j === "object" && !Array.isArray(j)) {
      for (const k of DEV_SUB_IDS) if (typeof j[k] === "boolean") out[k] = j[k];
    }
  } catch (_) {}
  return out;
}
function saveDevSubPrefs(prefs) {
  try {
    localStorage.setItem(uiPrefKey(DEV_SUB_KEY), JSON.stringify(prefs));
  } catch (_) {}
}

/** Scroll position of the dev box (.dev-scroll), per account (localStorage, try/catch). */
const DEV_SCROLL_KEY = "lom.scroll.dev";
function loadDevScroll() {
  try {
    const n = parseFloat(localStorage.getItem(uiPrefKey(DEV_SCROLL_KEY)));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (_) {
    return 0;
  }
}
function saveDevScroll(top) {
  try {
    localStorage.setItem(uiPrefKey(DEV_SCROLL_KEY), String(Math.round(top)));
  } catch (_) {}
}

/** file: / localhost výchozí; ?dev=0 skryje, ?dev=1 ukáže; lom.dev přepíná Ctrl+Shift+D.
 *  Veřejná ukázka (PUBLIC_DEMO): lišta je výchozí zapnutá (ořezaná). */
function shouldShowDevBar() {
  try {
    const q = new URLSearchParams(location.search).get("dev");
    if (q === "0") return false;
    if (q === "1") return true;
    const stored = localStorage.getItem(uiPrefKey(DEV_VIS_KEY));
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch (_) {}
  if (PUBLIC_DEMO) return true;
  const host = location.hostname;
  return location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * .storybook-bar (border) > .dev-body (inset padding) > .dev-scroll.
 * Wraps the scroll element once so the scrollport is not flush with the box edge.
 */
function ensureDevBody(bar) {
  if (!bar) return null;
  const existing = bar.querySelector(":scope > .dev-body > .dev-scroll");
  if (existing) return existing;
  const scroll = bar.querySelector(":scope > .dev-scroll");
  if (!scroll) return bar.querySelector(".dev-scroll");
  const body = document.createElement("div");
  body.className = "dev-body";
  scroll.parentNode.insertBefore(body, scroll);
  body.appendChild(scroll);
  return scroll;
}

function applyDevVisibility(show) {
  document.body.classList.toggle("has-dev", !!show);
  /* Both floating boxes (dev box, Stav systému) follow the same switch; the status box never shows in the public demo. */
  document.querySelectorAll(".storybook-bar").forEach((bar) => {
    ensureDevBody(bar);
    const hide = !show || (PUBLIC_DEMO && bar.id === "status-bar");
    bar.hidden = hide;
    bar.toggleAttribute("hidden", hide);
  });
  syncDevPad();
  /* A box shown now was laid out as zero size while hidden: clamp it again once it has a rect. */
  if (show) requestAnimationFrame(() => {
    clampDevBar();
    clampStatusBar();
  });
}

/**
 * Floating box (dev box, Stav systému): the square handle toggles collapse (click) or moves the box (drag). Corner
 * resize (mountCornerResize in tooltip.js) persists w/h per account like x/y. The box is anchored to the handle; prefs
 * live under `key` and the box is clamped to the visual viewport. `defaultPos()` gives the first position
 * (null = top-left corner); `onApply(prefs)` runs on every chrome change, `onFrame()` after the next layout.
 */
function mountFloatBox(bar, handle, key, { defaultPos = null, onApply = () => {}, onFrame = () => {}, tipLabel = "" } = {}) {
  const prefs = loadDevBarPrefs(key);
  const scroll = ensureDevBody(bar) || bar.querySelector(".dev-scroll");
  /*
   * The square handle is position:fixed and the box is anchored to it: the box sits at (x, y), the handle at (x+1, y+1)
   * (the box border is 1 px). Collapsing or expanding only changes the box size, so the handle never moves.
   */
  const placeBar = (x, y) => {
    prefs.x = x;
    prefs.y = y;
    bar.style.left = `${x}px`;
    bar.style.top = `${y}px`;
    bar.style.right = "auto";
    if (handle) {
      handle.style.left = `${x + 1}px`;
      handle.style.top = `${y + 1}px`;
    }
  };
  const boxPad = () => {
    const root = getComputedStyle(document.documentElement);
    const px = (name) => {
      const n = parseFloat(root.getPropertyValue(name));
      return Number.isFinite(n) ? n : 0;
    };
    return {
      vw: window.visualViewport?.width || window.innerWidth,
      vh: window.visualViewport?.height || window.innerHeight,
      padL: 8 + px("--safe-l"),
      padT: 8 + px("--safe-t"),
      padR: 8 + px("--safe-r"),
      padB: 8 + px("--safe-b"),
    };
  };
  /** Open size from prefs; collapsed uses CSS (2rem square). */
  const applyBoxSize = () => {
    const closed = !!(prefs.collapsed || prefs.minimized);
    if (closed) {
      bar.style.width = "";
      bar.style.maxWidth = "";
      bar.style.height = "";
      bar.style.maxHeight = "";
      if (scroll) scroll.style.maxHeight = "";
      return;
    }
    const { vw, vh, padL, padR, padT, padB } = boxPad();
    const maxW = Math.max(160, vw - padL - padR);
    const maxH = Math.max(96, vh - padT - padB);
    if (prefs.w != null) {
      const w = Math.max(160, Math.min(maxW, prefs.w));
      prefs.w = w;
      bar.style.width = `${w}px`;
      bar.style.maxWidth = `${w}px`;
    } else {
      bar.style.width = "";
      bar.style.maxWidth = "";
    }
    if (prefs.h != null) {
      const h = Math.max(96, Math.min(maxH, prefs.h));
      prefs.h = h;
      bar.style.height = `${h}px`;
      bar.style.maxHeight = `${h}px`;
      if (scroll) scroll.style.maxHeight = "none";
    } else {
      bar.style.height = "";
      bar.style.maxHeight = "";
      if (scroll) scroll.style.maxHeight = "";
    }
  };
  const applyChrome = () => {
    /* minimized (starý klíč) = sbaleno */
    const closed = !!(prefs.collapsed || prefs.minimized);
    prefs.collapsed = closed;
    prefs.minimized = false;
    bar.classList.toggle("is-collapsed", closed);
    bar.classList.toggle("is-minimized", closed);
    applyBoxSize();
    onApply(prefs);
    if (prefs.x != null && prefs.y != null) placeBar(prefs.x, prefs.y);
    if (handle) {
      /* Hover text comes from the shared tooltip (data-tip); no native title, so the two never show together. Short label only. */
      const action = closed ? "Otevřít nebo přesunout" : "Sbalit nebo přesunout";
      handle.dataset.tip = tipLabel;
      handle.setAttribute("aria-label", action);
      handle.setAttribute("aria-expanded", String(!closed));
    }
    syncDevPad();
    requestAnimationFrame(() => {
      clampBar();
      onFrame();
    });
  };
  /** Sbal/rozbal: jen třídy (CSS animuje width / max-height); handle zůstává na místě. */
  const toggleCollapsed = () => {
    prefs.collapsed = !prefs.collapsed;
    prefs.minimized = false;
    applyChrome();
    clampBar();
    saveDevBarPrefs(prefs, key);
  };
  /*
   * Exception vs peek eye: free over the whole visual viewport (incl. letterbox bars).
   * Remembers prefs.x/y; only clamps so it does not leave the screen.
   */
  const clampBar = () => {
    const { vw, vh, padL, padT, padR, padB } = boxPad();
    applyBoxSize();
    const r = bar.getBoundingClientRect();
    let minX = padL;
    const minY = padT;
    /* The admin switch (top-left corner, z 60) lives under the bar's default slot: while it is shown the bar starts
       to its right, so on localhost (bar always on) the switch is not buried. Skipped when the open bar would not fit. */
    const sw = $("admin-switch");
    if (sw && !sw.hidden) {
      const s = sw.getBoundingClientRect();
      const free = s.right + 6;
      if (free > minX && (prefs.y == null || prefs.y < s.bottom) && free + Math.min(r.width, vw) + padR <= vw) minX = free;
    }
    const maxX = Math.max(minX, vw - Math.min(r.width, vw) - padR);
    const maxY = Math.max(minY, vh - Math.min(r.height, vh) - padB);
    if (prefs.x == null || prefs.y == null) {
      const d = defaultPos?.();
      prefs.x = d ? d.x : minX;
      prefs.y = d ? d.y : minY;
    }
    const x = Math.max(minX, Math.min(maxX, prefs.x));
    const y = Math.max(minY, Math.min(maxY, prefs.y));
    placeBar(x, y);
  };
  window.addEventListener("resize", clampBar);
  window.visualViewport?.addEventListener("resize", clampBar);
  requestAnimationFrame(clampBar);

  /* Corner resize: same mountCornerResize helper as tooltips (tooltip.js). */
  if (typeof mountCornerResize === "function") {
    mountCornerResize(bar, {
      minW: 180,
      minH: 120,
      maxW: () => {
        const { vw, padL, padR } = boxPad();
        return Math.max(180, vw - padL - padR);
      },
      maxH: () => {
        const { vh, padT, padB } = boxPad();
        return Math.max(120, vh - padT - padB);
      },
      disabled: () => !!(prefs.collapsed || prefs.minimized),
      getSize: () => {
        if (prefs.collapsed || prefs.minimized) return null;
        const r = bar.getBoundingClientRect();
        return {
          w: prefs.w != null ? prefs.w : Math.round(r.width),
          h: prefs.h != null ? prefs.h : Math.round(r.height),
        };
      },
      onMove: (w, h) => {
        prefs.w = w;
        prefs.h = h;
        if (scroll) scroll.style.maxHeight = "none";
      },
      onSize: (w, h) => {
        prefs.w = w;
        prefs.h = h;
        saveDevBarPrefs(prefs, key);
        clampBar();
      },
    });
  }

  /* čtverec: klik = sbalit/rozbalit (kotva = handle); táhni = přesun */
  if (handle) {
    let dragging = false;
    let moved = false;
    let ox = 0;
    let oy = 0;
    let startX = 0;
    let startY = 0;
    const THRESH = 6;
    const onMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && (Math.abs(dx) > THRESH || Math.abs(dy) > THRESH)) {
        dragging = true;
        moved = true;
        bar.classList.add("is-dragging");
        const rect = bar.getBoundingClientRect();
        ox = startX - rect.left;
        oy = startY - rect.top;
      }
      if (!dragging) return;
      const x = Math.max(0, Math.min(window.innerWidth - 40, e.clientX - ox));
      const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - oy));
      placeBar(x, y);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      bar.classList.remove("is-dragging");
      if (!moved) {
        toggleCollapsed();
        saveDevBarPrefs(prefs, key);
      } else if (dragging) {
        saveDevBarPrefs(prefs, key);
        clampBar();
      }
      dragging = false;
      moved = false;
    };
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      moved = false;
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      e.preventDefault();
      /* Touch: keep the stream on the handle so the page never takes over the gesture. */
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {}
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
  }
  return { prefs, placeBar, applyChrome, clampBar, applyBoxSize };
}

/**
 * Level-2 sticky summaries (details.dev-sub > summary) park at --stick-2. When their parent
 * subsection scrolls away, CSS sticky pulls them up through the level-1 slot. Hide any sub
 * header that has been dragged above its park line so it never paints under the section row.
 */
function bindStickyStack(scroll) {
  if (!scroll) return;
  let raf = 0;
  const sync = () => {
    raf = 0;
    const bar = scroll.closest(".storybook-bar");
    if (!bar || bar.classList.contains("is-collapsed") || bar.classList.contains("is-minimized")) return;
    const sr = scroll.getBoundingClientRect();
    if (sr.height < 1) return;
    const sample = bar.querySelector("summary.box-subhead, .dev-sys-sec > summary");
    const subH = (sample && sample.getBoundingClientRect().height) || 24;
    const park = sr.top + subH;
    scroll.querySelectorAll("details.dev-sub > summary").forEach((sum) => {
      const top = sum.getBoundingClientRect().top;
      sum.style.visibility = top < park - 1.5 ? "hidden" : "";
    });
  };
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(sync);
  };
  scroll.addEventListener("scroll", onScroll, { passive: true });
  scroll.addEventListener("toggle", onScroll, true);
  requestAnimationFrame(sync);
  return sync;
}

function initDevBar() {
  const bar = document.querySelector(".storybook-bar");
  const panel = $("dev-detail-panel");
  if (!bar || !panel) return;

  /* Scroll of the dev box (.dev-scroll): restored once it is open and laid out (a collapsed box has no height). */
  const devScroll = ensureDevBody(bar);
  const devOpen = () => !!devScroll && !bar.classList.contains("is-collapsed");
  const restoreDevScroll = () => {
    if (devOpen()) devScroll.scrollTop = loadDevScroll();
  };
  const box = mountFloatBox(bar, $("dev-drag"), DEV_BAR_KEY, {
    tipLabel: "Vývojářský panel",
    onApply: (prefs) => {
      /* Panel stays in DOM – collapse animates .dev-scroll (hidden would hard-cut). */
      panel.hidden = false;
      applyDevOpacity(bar, prefs.opacity);
    },
    onFrame: restoreDevScroll,
  });
  const prefs = box.prefs;
  clampDevBar = box.clampBar;
  const applySections = () => {
    bar.querySelectorAll("details.dev-sec[data-sec]").forEach((el) => {
      const id = el.dataset.sec;
      el.open = !!prefs.sections[id];
    });
  };

  $("dev-opacity")?.addEventListener("input", (e) => {
    prefs.opacity = devSliderToOpacity(Number(e.target.value));
    applyDevOpacity(bar, prefs.opacity);
    saveDevBarPrefs(prefs);
  });
  bar.querySelectorAll("details.dev-sec[data-sec]").forEach((el) => {
    el.addEventListener("toggle", () => {
      prefs.sections[el.dataset.sec] = el.open;
      saveDevBarPrefs(prefs);
    });
  });
  applyDevVisibility(shouldShowDevBar());
  applySections();
  const subPrefs = loadDevSubPrefs();
  bar.querySelectorAll("details.dev-sub[data-sub]").forEach((el) => {
    if (typeof subPrefs[el.dataset.sub] === "boolean") el.open = subPrefs[el.dataset.sub];
    el.addEventListener("toggle", () => {
      subPrefs[el.dataset.sub] = el.open;
      saveDevSubPrefs(subPrefs);
    });
  });
  const syncSticky = bindStickyStack(devScroll);
  /* Written throttled while the box is open (a collapsed box reports 0 and is not stored). */
  let devScrollT = 0;
  devScroll?.addEventListener(
    "scroll",
    () => {
      if (devScrollT || !devOpen()) return;
      devScrollT = setTimeout(() => {
        devScrollT = 0;
        if (devOpen()) saveDevScroll(devScroll.scrollTop);
      }, 200);
    },
    { passive: true }
  );
  /* Same top/bottom edge fade as the rest of the app (styles.css [data-fade] mask). */
  if (typeof bindScrollFade === "function") {
    bindScrollFade(devScroll);
    const worldOut = $("dev-world-out");
    if (worldOut) bindScrollFade(worldOut);
  }
  window.addEventListener("pagehide", () => {
    if (devOpen()) saveDevScroll(devScroll.scrollTop);
  });
  box.applyChrome();
  if (typeof syncSticky === "function") requestAnimationFrame(syncSticky);

  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d"))) return;
    if (e.target.matches?.("input, textarea, select")) return;
    e.preventDefault();
    const next = !document.body.classList.contains("has-dev");
    try {
      localStorage.setItem(uiPrefKey(DEV_VIS_KEY), next ? "1" : "0");
    } catch (_) {}
    applyDevVisibility(next);
  });
}

/** Stav systému box: anchored right of the dev box handle on first use, then its own saved position. */
function initStatusBox() {
  const bar = $("status-bar");
  if (!bar) return;
  ensureDevBody(bar);
  const box = mountFloatBox(bar, $("status-drag"), STATUS_BAR_KEY, {
    tipLabel: "Stav systému",
    defaultPos: () => {
      const r = $("dev-drag")?.getBoundingClientRect();
      if (r && r.width) return { x: Math.round(r.right + 5), y: Math.round(r.top - 1) };
      /* Dev box hidden (zero rect): the same spot from constants – its 8 px edge + the 2rem handle + a 5 px gap. */
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return { x: Math.round(8 + 2 * rem + 5), y: 8 };
    },
  });
  clampStatusBar = box.clampBar;
  box.applyChrome();
  const statusScroll = bar.querySelector(".dev-scroll");
  if (typeof bindScrollFade === "function") bindScrollFade(statusScroll);
  bindStickyStack(statusScroll);
  /* Own transparency slider: same helpers as the dev box, separate localStorage key. */
  applyDevOpacity(bar, loadStatusOpacity(), "status-opacity");
  $("status-opacity")?.addEventListener("input", (e) => {
    const o = devSliderToOpacity(Number(e.target.value));
    applyDevOpacity(bar, o, "status-opacity");
    saveStatusOpacity(o);
  });
}
