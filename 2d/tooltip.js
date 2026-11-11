/* Shared hover / long-press / focus tooltip for every page: 2D (2d/app.js), Admin and the play page.
   Shows the text of [data-tip] (also .stat-icon, abbr.kodex when window.LOM.Kodex is loaded) in one floating #float-tip.
   Classic script, no build, no dependency on app.js. Styles: tooltip.css (same folder). Load before the page script. */
/** Tip v body - mimo backdrop-filter / overflow parentů */
function floatTipEl() {
  let tip = document.getElementById("float-tip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "float-tip";
    tip.className = "float-tip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
  }
  return tip;
}

function formatTipHtml(text) {
  const parts = String(text)
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    const one = parts[0] || text;
    const m = one.match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|⚔|🛡|♥|✦|◎|⬡|✧|🪙)\s*(.*)$/u);
    if (m) {
      return `<span class="tip-bits"><span class="tip-bit"><span class="tip-ico" aria-hidden="true">${m[1]}</span>${m[2] || ""}</span></span>`;
    }
    return one;
  }
  return `<span class="tip-bits">${parts
    .map((p) => {
      const m = p.match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|⚔|🛡|♥|✦|◎|⬡|✧|🪙)\s*(.*)$/u);
      if (m) {
        return `<span class="tip-bit"><span class="tip-ico" aria-hidden="true">${m[1]}</span>${m[2] || ""}</span>`;
      }
      return `<span class="tip-bit">${p}</span>`;
    })
    .join("")}</span>`;
}

/**
 * Tip viewport (visualViewport when present – PWA / mobile URL bar).
 * Best practice: desktop = hover; touch = long-press (~0.5 s) or tap-toggle for Kodex.
 */
function tipViewportBox() {
  const vv = window.visualViewport;
  return {
    left: vv?.offsetLeft ?? 0,
    top: vv?.offsetTop ?? 0,
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}

function tipIsCoarse() {
  return window.matchMedia("(hover: none)").matches;
}

/** Visible part of el ∩ visual viewport ∩ scroll ancestors. */
function visibleRect(el) {
  const r0 = el.getBoundingClientRect();
  const vv = tipViewportBox();
  let top = Math.max(r0.top, vv.top);
  let bottom = Math.min(r0.bottom, vv.top + vv.height);
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy !== "auto" && oy !== "scroll" && oy !== "hidden") continue;
    const pr = p.getBoundingClientRect();
    top = Math.max(top, pr.top);
    bottom = Math.min(bottom, pr.bottom);
  }
  if (bottom < top) bottom = top;
  return { left: r0.left, right: r0.right, width: r0.width, top, bottom };
}

let floatTipTimer = null;
let floatTipAnchor = null;
/** @type {MutationObserver | null} Runs only while a tip is shown. */
let floatTipObserver = null;

/* Anchor still connected, rendered, not hidden and not covered by another element at its first box centre. */
function floatTipAnchorOk(el) {
  if (!el.isConnected) return false;
  const box = el.getClientRects()[0];
  if (!box || getComputedStyle(el).visibility === "hidden") return false;
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  const tip = document.getElementById("float-tip");
  return !hit || el.contains(hit) || (tip !== null && tip.contains(hit));
}

function floatTipWatch() {
  if (floatTipObserver) return;
  floatTipObserver = new MutationObserver(() => {
    if (floatTipAnchor && !floatTipAnchorOk(floatTipAnchor)) hideFloatTip();
  });
  floatTipObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "disabled", "data-screen"],
  });
}

function showFloatTip(icon, opts = {}) {
  const text =
    icon.dataset.tip ||
    (icon.dataset.kodex && window.LOM?.Kodex?.KODEX_BY?.[icon.dataset.kodex]?.short) ||
    icon.querySelector(".tip-bubble")?.textContent;
  if (!text) {
    hideFloatTip();
    return;
  }
  const tip = floatTipEl();
  tip.innerHTML = formatTipHtml(text);
  tip.classList.remove("below");
  /* Measure while invisible – avoids the place→clamp jump. */
  tip.style.visibility = "hidden";
  tip.classList.add("show");
  const r = visibleRect(icon);
  const vv = tipViewportBox();
  const pad = 8;
  clearTimeout(floatTipTimer);
  floatTipAnchor = icon;
  floatTipWatch();
  const autoHide = opts.autoHide ?? tipIsCoarse();
  if (autoHide) floatTipTimer = setTimeout(hideFloatTip, opts.hideMs || 4000);

  let left = r.left + r.width / 2;
  let top = r.top - 6;
  let below = top < vv.top + 52;
  if (below) {
    top = r.bottom + 6;
    tip.classList.add("below");
  }
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;

  const tr = tip.getBoundingClientRect();
  let dx = 0;
  if (tr.left < vv.left + pad) dx = vv.left + pad - tr.left;
  if (tr.right > vv.left + vv.width - pad) dx = vv.left + vv.width - pad - tr.right;
  if (tr.top < vv.top + pad) {
    tip.classList.add("below");
    tip.style.top = `${r.bottom + 6}px`;
    const tr2 = tip.getBoundingClientRect();
    if (tr2.bottom > vv.top + vv.height - pad) {
      tip.style.top = `${Math.max(vv.top + pad, vv.top + vv.height - pad - tr2.height)}px`;
    }
  } else if (tr.bottom > vv.top + vv.height - pad) {
    tip.style.top = `${top + (vv.top + vv.height - pad - tr.bottom)}px`;
  }
  if (dx) tip.style.left = `${left + dx}px`;
  tip.style.visibility = "";
}

function hideFloatTip() {
  clearTimeout(floatTipTimer);
  floatTipTimer = null;
  floatTipAnchor = null;
  if (floatTipObserver) {
    floatTipObserver.disconnect();
    floatTipObserver = null;
  }
  const tip = document.getElementById("float-tip");
  if (!tip) return;
  tip.classList.remove("show");
  tip.style.visibility = "";
}
const tipSel = ".stat-icon, .has-tip";
/** After pointerdown on a tip host, suppress hover re-show until pointerleave of that host. */
let floatTipSuppressEl = null;

function floatTipClearSuppress() {
  floatTipSuppressEl = null;
}

function floatTipIsSuppressed(el) {
  return !!(floatTipSuppressEl && el && (el === floatTipSuppressEl || floatTipSuppressEl.contains(el)));
}

/* scroll, Esc a stisk kdekoli schovají tip (tip by jinak zůstal viset na starém místě) */
document.addEventListener("scroll", hideFloatTip, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideFloatTip();
}, true);
/* Press anywhere dismisses a stuck tip; pointerdown on a tip host also suppresses hover re-show until leave. */
document.addEventListener("pointerdown", (e) => {
  if (floatTipAnchor) hideFloatTip();
  const host = e.target instanceof Element ? e.target.closest?.(tipSel) : null;
  floatTipSuppressEl = host || null;
}, true);
/* Cursor leaves the page, the window loses focus or the tab is hidden: pointerout may never fire, so close here too. */
document.documentElement.addEventListener("pointerleave", () => {
  floatTipClearSuppress();
  hideFloatTip();
});
document.documentElement.addEventListener("mouseleave", () => {
  floatTipClearSuppress();
  hideFloatTip();
});
window.addEventListener("blur", () => {
  floatTipClearSuppress();
  hideFloatTip();
});
/* Route change (history back/forward, hash) and leaving the page: the anchor may stay mounted on another view. */
window.addEventListener("popstate", hideFloatTip);
window.addEventListener("hashchange", hideFloatTip);
window.addEventListener("pagehide", hideFloatTip);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    floatTipClearSuppress();
    hideFloatTip();
  }
});

const TIP_LONG_MS = 500;
const TIP_MOVE_PX = 12;
/** @type {null | { el: Element, x: number, y: number, timer: number, shown: boolean, pointerId: number }} */
let tipPress = null;

function tipClearPress() {
  if (!tipPress) return;
  clearTimeout(tipPress.timer);
  tipPress = null;
}

/* Desktop / mouse: hover. Touch: no hover tip (long-press / Kodex tap below). */
document.addEventListener(
  "pointerover",
  (e) => {
    if (e.pointerType === "touch" || tipIsCoarse()) return;
    const k = e.target.closest?.("abbr.kodex");
    if (k) {
      if (floatTipIsSuppressed(k)) return;
      showFloatTip(k, { autoHide: false });
      return;
    }
    const icon = e.target.closest?.(tipSel);
    if (icon) {
      if (floatTipIsSuppressed(icon)) return;
      showFloatTip(icon, { autoHide: false });
    }
  },
  true
);
document.addEventListener(
  "pointerout",
  (e) => {
    if (e.pointerType === "touch" || tipIsCoarse()) return;
    const fromKodex = e.target.closest?.("abbr.kodex");
    if (fromKodex && !e.relatedTarget?.closest?.("abbr.kodex")) {
      if (floatTipSuppressEl === fromKodex) floatTipClearSuppress();
      hideFloatTip();
      return;
    }
    const icon = e.target.closest?.(tipSel);
    if (!icon) return;
    const to = e.relatedTarget?.closest?.(tipSel);
    if (to !== icon) {
      if (floatTipSuppressEl === icon) floatTipClearSuppress();
      hideFloatTip();
    }
  },
  true
);

/* Touch / coarse: long-press shows tip; release keeps it; move cancels. */
document.addEventListener(
  "pointerdown",
  (e) => {
    if (e.pointerType !== "touch" && !(tipIsCoarse() && e.pointerType === "pen")) return;
    const icon = e.target.closest?.(tipSel);
    if (!icon || !icon.dataset.tip) return;
    tipClearPress();
    tipPress = {
      el: icon,
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      shown: false,
      timer: window.setTimeout(() => {
        if (!tipPress || tipPress.el !== icon) return;
        tipPress.shown = true;
        showFloatTip(icon, { autoHide: true, hideMs: 4500 });
        try {
          navigator.vibrate?.(12);
        } catch (_) {}
      }, TIP_LONG_MS),
    };
  },
  true
);
document.addEventListener(
  "pointermove",
  (e) => {
    if (!tipPress || e.pointerId !== tipPress.pointerId) return;
    if (Math.hypot(e.clientX - tipPress.x, e.clientY - tipPress.y) > TIP_MOVE_PX) tipClearPress();
  },
  true
);
document.addEventListener(
  "pointerup",
  (e) => {
    if (!tipPress || e.pointerId !== tipPress.pointerId) return;
    const held = tipPress.shown;
    const el = tipPress.el;
    tipClearPress();
    if (held) {
      /* Suppress the click that would fire the button (peek / dock / …). */
      el.setAttribute("data-tip-hold", "1");
      requestAnimationFrame(() => el.removeAttribute("data-tip-hold"));
    }
  },
  true
);
document.addEventListener(
  "pointercancel",
  () => {
    tipClearPress();
    hideFloatTip();
  },
  true
);
/* Touch end: the tip (incl. a long-press one) closes on release. A tap on Kodex re-opens it through its click handler below. */
document.addEventListener(
  "pointerup",
  (e) => {
    if (e.pointerType === "touch") hideFloatTip();
  },
  true
);
document.addEventListener(
  "touchend",
  () => {
    hideFloatTip();
  },
  true
);

/* Guard: a tip stays open only while the pointer is over its anchor. Covers pointerout that never came (anchor removed
   or re-rendered, pointer jumped off). Registered after the show listeners above, so a new anchor is already set. */
function floatTipPointerGuard(e) {
  if (!floatTipAnchor) return;
  if (e.target instanceof Element && floatTipAnchor.contains(e.target)) return;
  hideFloatTip();
}
document.addEventListener("pointerover", floatTipPointerGuard, true);
document.addEventListener("pointermove", floatTipPointerGuard, true);
/* Focus leaves the anchor (tab, click elsewhere) closes the tip; focus moving inside the anchor keeps it. */
document.addEventListener("focusout", (e) => {
  if (floatTipAnchor && floatTipAnchor.contains(e.target) && !floatTipAnchor.contains(e.relatedTarget)) hideFloatTip();
});
document.addEventListener(
  "click",
  (e) => {
    const held = e.target.closest?.("[data-tip-hold]");
    if (held) {
      e.preventDefault();
      e.stopPropagation();
      held.removeAttribute("data-tip-hold");
    }
  },
  true
);

/* Kodex on touch: tap toggles (words in prose – long-press fights selection). */
let kodexTapId = null;
document.addEventListener(
  "click",
  (e) => {
    const k = e.target.closest?.("abbr.kodex");
    if (!k) {
      if (kodexTapId) {
        hideFloatTip();
        kodexTapId = null;
      } else if (tipIsCoarse() && floatTipAnchor && !e.target.closest?.(tipSel)) {
        hideFloatTip();
      }
      return;
    }
    if (!tipIsCoarse() && e.pointerType !== "touch") return;
    if (kodexTapId === k.dataset.kodex) {
      hideFloatTip();
      kodexTapId = null;
    } else {
      showFloatTip(k, { autoHide: true });
      kodexTapId = k.dataset.kodex;
    }
  },
  true
);

document.addEventListener(
  "focusin",
  (e) => {
    /* Touch focus follows the tap: a tip shown here would outlive the touch end, so focus shows a tip only on fine pointers. */
    if (tipIsCoarse()) return;
    const icon = e.target.closest?.(tipSel);
    if (icon) showFloatTip(icon, { autoHide: false });
  },
  true
);
