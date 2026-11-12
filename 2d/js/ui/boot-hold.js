/*
 * Boot hold: the first composition of the 2D page happens once, with the stored state already applied.
 * UMD: `BootHold` in the browser (script tag), require() in tests (2d/js/test/boot-hold.test.js).
 *
 *   create() → { held() → true until release(), release() → true only on the first call }
 *   snapshotForScenario(raw, scenarioId) → raw when it is an object stored for that scenario, else null
 *   skipEntrance(root) → true while html.boot-pending or html.boot-settling (first paint lands final)
 *   scrollFromSnapshot(raw) → { body?, choices?, flow? } from a stored prolog snap, else null
 *   applyScrollMap(map, targets) → sets scrollTop on matching elements; true when any applied
 *   peekUiKey(accountId) → lom.ui.<account>.lom.peek (same shape as ClientState.uiKey)
 *   parsePeekSnap(raw) / serializePeekSnap(snap) → eye open + pan + focus
 *   mergePeekIntoSession(session, snap) → storybook session object with peek fields
 *   shouldRestorePeek(snap, ready) → true when boot should re-enter the eye
 *
 * The hold keeps the scene from being composed with defaults while boot reads sessionStorage; app.js releases it
 * after restoreProlog, so the scene composes once and the visible stage never flips from a default to the stored one.
 * boot-settling (with CSS) zeros entrance animations on the prolog stage until one frame after reveal.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BootHold = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SCROLL_KEYS = ["body", "choices", "flow"];
  var PEEK_PREF_NAME = "lom.peek";
  var UI_PREFIX = "lom.ui.";

  function create() {
    var held = true;
    return {
      held: function () {
        return held;
      },
      release: function () {
        if (!held) return false;
        held = false;
        return true;
      },
    };
  }

  function snapshotForScenario(raw, scenarioId) {
    if (!raw || typeof raw !== "object") return null;
    return raw.scenarioId === scenarioId ? raw : null;
  }

  function skipEntrance(root) {
    if (!root || !root.classList) return false;
    return root.classList.contains("boot-settling") || root.classList.contains("boot-pending");
  }

  function scrollFromSnapshot(raw) {
    if (!raw || typeof raw !== "object") return null;
    var src = raw.scroll;
    if (!src || typeof src !== "object") return null;
    var out = {};
    for (var i = 0; i < SCROLL_KEYS.length; i++) {
      var k = SCROLL_KEYS[i];
      var n = src[k];
      if (typeof n === "number" && isFinite(n) && n >= 0) out[k] = n;
    }
    return Object.keys(out).length ? out : null;
  }

  function applyScrollMap(map, targets) {
    if (!map || typeof map !== "object" || !targets || typeof targets !== "object") return false;
    var applied = false;
    for (var i = 0; i < SCROLL_KEYS.length; i++) {
      var k = SCROLL_KEYS[i];
      var el = targets[k];
      var n = map[k];
      if (!el || typeof n !== "number" || !isFinite(n) || n < 0) continue;
      el.scrollTop = n;
      applied = true;
    }
    return applied;
  }

  /* Per-account localStorage key (mirrors ClientState.uiKey; 2d may not load that file). */
  function peekUiKey(accountId) {
    var a = accountId && typeof accountId === "string" && accountId.length ? accountId : "anon";
    return UI_PREFIX + a + "." + PEEK_PREF_NAME;
  }

  /** Normalize eye state from session or pref: { open, pan?, focus? } or null. */
  function parsePeekSnap(raw) {
    if (!raw || typeof raw !== "object") return null;
    var open = !!(raw.open || raw.peek);
    var panIn = raw.pan || raw.peekPan;
    var focusIn = raw.focus || raw.peekFocus;
    var pan = null;
    if (panIn && typeof panIn.x === "number" && isFinite(panIn.x)) {
      pan = {
        x: panIn.x,
        y: typeof panIn.y === "number" && isFinite(panIn.y) ? panIn.y : 0,
        scale: Math.max(1, typeof panIn.scale === "number" && isFinite(panIn.scale) ? panIn.scale : 1),
      };
    }
    var focus = null;
    if (focusIn && typeof focusIn.x === "number" && typeof focusIn.y === "number") {
      focus = { x: focusIn.x, y: focusIn.y };
    }
    if (!open && !pan && !focus) return null;
    return { open: open, pan: pan, focus: focus };
  }

  function serializePeekSnap(snap) {
    if (!snap || typeof snap !== "object") return null;
    var out = { open: !!snap.open };
    if (snap.pan && typeof snap.pan.x === "number") {
      out.pan = {
        x: snap.pan.x,
        y: typeof snap.pan.y === "number" ? snap.pan.y : 0,
        scale: Math.max(1, typeof snap.pan.scale === "number" ? snap.pan.scale : 1),
      };
    }
    if (snap.focus && typeof snap.focus.x === "number" && typeof snap.focus.y === "number") {
      out.focus = { x: snap.focus.x, y: snap.focus.y };
    }
    return out;
  }

  /** Merge eye fields into a storybook session object (pure; does not write storage). */
  function mergePeekIntoSession(session, snap) {
    var base = session && typeof session === "object" ? Object.assign({}, session) : {};
    var s = parsePeekSnap(snap) || { open: false };
    base.peek = !!s.open;
    if (s.pan) base.peekPan = { x: s.pan.x, y: s.pan.y, scale: s.pan.scale };
    if (s.focus) base.peekFocus = { x: s.focus.x, y: s.focus.y };
    return base;
  }

  /**
   * Boot should re-enter the eye when the snap is open and the scene is ready.
   * ready: { held, screen, sceneVisible, alreadyPeeking }
   */
  function shouldRestorePeek(snap, ready) {
    var s = parsePeekSnap(snap);
    if (!s || !s.open) return false;
    if (!ready || typeof ready !== "object") return false;
    if (ready.held) return false;
    if (ready.alreadyPeeking) return false;
    if (ready.screen !== "origins") return false;
    if (ready.sceneVisible === false) return false;
    return true;
  }

  return {
    create: create,
    snapshotForScenario: snapshotForScenario,
    skipEntrance: skipEntrance,
    scrollFromSnapshot: scrollFromSnapshot,
    applyScrollMap: applyScrollMap,
    peekUiKey: peekUiKey,
    parsePeekSnap: parsePeekSnap,
    serializePeekSnap: serializePeekSnap,
    mergePeekIntoSession: mergePeekIntoSession,
    shouldRestorePeek: shouldRestorePeek,
    PEEK_PREF_NAME: PEEK_PREF_NAME,
  };
});
