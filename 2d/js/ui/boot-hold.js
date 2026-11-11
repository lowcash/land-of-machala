/*
 * Boot hold: the first composition of the 2D page happens once, with the stored state already applied.
 * UMD: `BootHold` in the browser (script tag), require() in tests (2d/js/test/boot-hold.test.js).
 *
 *   create() → { held() → true until release(), release() → true only on the first call }
 *   snapshotForScenario(raw, scenarioId) → raw when it is an object stored for that scenario, else null
 *   skipEntrance(root) → true while html.boot-pending or html.boot-settling (first paint lands final)
 *   scrollFromSnapshot(raw) → { body?, choices?, flow? } from a stored prolog snap, else null
 *   applyScrollMap(map, targets) → sets scrollTop on matching elements; true when any applied
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

  return {
    create: create,
    snapshotForScenario: snapshotForScenario,
    skipEntrance: skipEntrance,
    scrollFromSnapshot: scrollFromSnapshot,
    applyScrollMap: applyScrollMap,
  };
});
