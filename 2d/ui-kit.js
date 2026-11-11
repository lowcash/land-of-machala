/*
 * Tiny shared HTML-string kit for 2d and admin. Classic script, no DOM access at load.
 * Every helper returns an escaped HTML string; attribute values and text are always escaped.
 * Exposed as window.UiKit (and module.exports in node tests).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.UiKit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var ATTR_NAME = /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/;
  function attrs(map) {
    var out = "";
    if (!map) return out;
    Object.keys(map).forEach(function (name) {
      var v = map[name];
      if (!ATTR_NAME.test(name) || v === false || v == null) return;
      out += v === true ? " " + name : " " + name + '="' + esc(v) + '"';
    });
    return out;
  }

  function btn(label, opts) {
    var o = opts || {};
    var cls = "btn" + (o.variant ? " btn-" + esc(o.variant) : "");
    return '<button type="button" class="' + cls + '"' + attrs(o.attrs) + ">" + esc(label) + "</button>";
  }

  function chip(text, state) {
    return '<span class="ui-chip' + (state ? " ui-chip-" + esc(state) : "") + '">' + esc(text) + "</span>";
  }

  function note(text, kind) {
    return '<p class="ui-note' + (kind ? " ui-note-" + esc(kind) : "") + '">' + esc(text) + "</p>";
  }

  function stateLine(kind, text) {
    var k = kind || "info";
    var role = k === "danger" ? "alert" : "status";
    return '<p class="ui-state ui-state-' + esc(k) + '" role="' + role + '">' + esc(text) + "</p>";
  }

  return {
    esc: esc,
    escAttr: esc,
    btn: btn,
    chip: chip,
    note: note,
    stateLine: stateLine,
  };
});
