"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "../..");

describe("float corner resize (tooltip.js + floating boxes)", () => {
  it("tooltip.js exposes mountCornerResize", () => {
    const src = fs.readFileSync(path.join(ROOT, "tooltip.js"), "utf8");
    assert.match(src, /function mountCornerResize\s*\(/);
    assert.match(src, /window\.mountCornerResize\s*=\s*mountCornerResize/);
  });

  it("tooltip.css styles the shared resize handle", () => {
    const css = fs.readFileSync(path.join(ROOT, "tooltip.css"), "utf8");
    assert.match(css, /\.float-resize/);
    assert.match(css, /cursor:\s*nwse-resize/);
  });

  it("devbar persists w/h and mounts corner resize", () => {
    const src = fs.readFileSync(path.join(ROOT, "js/ui/devbar.js"), "utf8");
    assert.match(src, /w:\s*null/);
    assert.match(src, /h:\s*null/);
    assert.match(src, /mountCornerResize\s*\(\s*bar/);
    assert.match(src, /prefs\.w/);
    assert.match(src, /prefs\.h/);
  });

  it("styles hide inner resets and keep chrome reset compact", () => {
    const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
    assert.match(css, /\.storybook-bar\s+\.dev-scroll\s+\.dev-reset/);
    assert.match(css, /display:\s*none\s*!important/);
    assert.match(css, /\.dev-chrome\s*>\s*\.dev-btn:not\(\.dev-reset\)/);
  });

  it("dev box sticky chain and scroll padding", () => {
    const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
    assert.match(css, /--stick-1:\s*0px/);
    assert.match(css, /--stick-2:\s*calc\(var\(--stick-1\)\s*\+\s*var\(--sub-h\)\)/);
    assert.match(css, /\.storybook-bar\s+\.dev-body\s*\{[^}]*--dev-body-pad:\s*0\.5rem/s);
    assert.match(css, /\/\* Body supplies the inset[\s\S]*?padding:\s*0\s+0\s+0\.625rem/);
    assert.match(css, /scroll-padding-top:\s*calc\(var\(--stick-2\)\s*\+\s*var\(--sub-h\)\s*\+\s*0\.5rem\)/);
    assert.match(css, /summary\.box-subhead[^}]*top:\s*var\(--stick-1\)/s);
    assert.match(css, /details\.dev-sub\s*>\s*summary[^}]*top:\s*var\(--stick-2\)/s);
    assert.match(css, /summary\.box-subhead[^}]*background:\s*var\(--panel-solid\)/s);
    const src = fs.readFileSync(path.join(ROOT, "js/ui/devbar.js"), "utf8");
    assert.match(src, /function bindStickyStack\s*\(/);
    assert.match(src, /function ensureDevBody\s*\(/);
  });
});
