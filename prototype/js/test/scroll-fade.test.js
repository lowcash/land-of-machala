/**
 * Scroll-fade contract + Brave layout smoke (aspect ratios, eye vs content overlap).
 * Floor-mask (no fade-to-black wash). CSS always; browser smoke skips without Brave.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "../../..");
const STYLES = path.join(ROOT, "prototype/styles.css");
const INDEX = path.join(ROOT, "prototype/index.html");

const BRAVE_CANDIDATES = [
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "brave-browser",
  "brave",
];

function findBrave() {
  for (const c of BRAVE_CANDIDATES) {
    if (c.startsWith("/") && fs.existsSync(c)) return c;
    try {
      execFileSync("which", [c], { stdio: "ignore" });
      return c;
    } catch {
      /* try next */
    }
  }
  return null;
}

function readFadeFloor(css) {
  const m = css.match(/--prolog-scroll-fade-floor:\s*([0-9.]+)/);
  assert.ok(m, "missing --prolog-scroll-fade-floor");
  return Number(m[1]);
}

test("scroll-fade: floor mask (no fade-to-black / no opaque wash ink)", () => {
  const css = fs.readFileSync(STYLES, "utf8");
  const floor = readFadeFloor(css);
  assert.ok(floor >= 0 && floor <= 0.1, `floor ${floor} must be ~0 so content melts to transparent (no hard edge)`);
  assert.match(css, /--prolog-scroll-fade:\s*min\(2\.85rem/);
  assert.equal(/--prolog-scroll-fade-ink:/.test(css), false, "opaque wash ink token must be gone");
  /* Fade size animates through registered --pf-t / --pf-b (mask-image itself cannot transition). */
  assert.match(css, /@property --pf-t/);
  assert.match(css, /transition:\s*--pf-t[^;]*--pf-b/);
  /* Soft multi-stop ramp (not a hard mid cliff). */
  assert.match(css, /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.2\)\s+calc\(var\(--pf-t\)\s*\*\s*0\.3\)/);
  assert.match(css, /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.45\)\s+calc\(var\(--pf-t\)\s*\*\s*0\.48\)/);
  assert.match(css, /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.9\)\s+calc\(var\(--pf-t\)\s*\*\s*0\.84\)/);
  assert.equal(/transparent\s+0/.test(css.match(/scroll-fade-clip:has[\s\S]{0,400}/)?.[0] || ""), false);
});

test("scroll-fade: desktop clip mask + phone flow mask; no pane wash", () => {
  const css = fs.readFileSync(STYLES, "utf8");
  assert.match(css, /\.scroll-fade-clip:has\(>\s*\.origin-body\.fade-top\)/);
  assert.match(css, /\.origin-flow:has\(>\s*\.origin-flow-scroll\.fade-top\)/);
  assert.match(css, /\.origin-scroll-pane::before\s*,[\s\S]*?\.origin-scroll-pane::after\s*\{[\s\S]*?content:\s*none/);
});

test("scroll-fade: landscape text column is wider than half (no empty right band)", () => {
  const css = fs.readFileSync(STYLES, "utf8");
  assert.match(css, /--prolog-landscape-card-w:\s*min\(60%/);
  assert.match(
    css,
    /max-height:\s*520px\)\s*\{[\s\S]*?\.auth-card\s*\{[\s\S]*?width:\s*var\(--prolog-landscape-card-w\)/
  );
  assert.equal(/width:\s*48%/.test(css), false, "48% column was too narrow with gutters");
});

test("peek eye: tight top-right; landscape equal gutters + top peek clear", () => {
  const css = fs.readFileSync(STYLES, "utf8");
  assert.match(css, /--prolog-peek-inset:\s*var\(--prolog-near\)/);
  assert.match(css, /--prolog-peek-clear:\s*calc\(var\(--prolog-peek-inset\)/);
  assert.match(
    css,
    /\.peek-btn\s*\{[\s\S]*?top:\s*calc\(var\(--prolog-peek-inset/
  );
  assert.equal(
    /\.peek-btn\s*\{[\s\S]*?top:\s*calc\(var\(--prolog-progress-bottom/.test(css),
    false,
    "eye must not use progress-bottom (left a large empty band above text)"
  );
  assert.match(
    css,
    /\.auth-card\s*\{[\s\S]*?padding:\s*max\([\s\S]*?--prolog-peek-clear[\s\S]*?var\(--prolog-side-gutter\)\s+var\(--prolog-card-y-bottom\)\s+var\(--prolog-side-gutter\)/
  );
  assert.equal(
    /padding:[\s\S]*?max\(\s*var\(--prolog-side-gutter\)\s*,\s*var\(--prolog-peek-clear\)\)/.test(css),
    false,
    "peek-clear must not inflate the right side gutter"
  );
  assert.equal(
    /max-height:\s*520px\)\s*\{[\s\S]*?\.peek-btn\s*\{[\s\S]*?left:\s*50%/.test(css),
    false,
    "left:50% put the eye over the text column"
  );
});

const VIEWPORTS = [
  { id: "ultrawide-21x9", w: 1680, h: 720, expect: "desktop" },
  { id: "desktop-16x9", w: 1280, h: 720, expect: "desktop" },
  { id: "desktop-4x3", w: 1024, h: 768, expect: "desktop" },
  { id: "phone-portrait", w: 390, h: 844, expect: "phone" },
  { id: "phone-landscape", w: 844, h: 390, expect: "phone" },
];

test("scroll-fade + overlap: layout smoke across aspect ratios (Brave)", (t) => {
  const brave = findBrave();
  if (!brave) return t.skip("Brave not installed");
  if (!fs.existsSync(INDEX)) return t.skip("prototype/index.html missing");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lom-fade-"));
  const harness = path.join(dir, "harness.html");
  const indexUrl = `file://${INDEX}`;

  const frames = VIEWPORTS.map(
    (v) =>
      `<iframe data-id="${v.id}" data-expect="${v.expect}" width="${v.w}" height="${v.h}" src="${indexUrl}"></iframe>`
  ).join("\n");

  fs.writeFileSync(
    harness,
    `<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8" /><title>fade-smoke</title></head>
<body style="margin:0;background:#111">
${frames}
<pre id="out"></pre>
<script>
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const overlapArea = (a, b) => {
    if (!a || !b) return 0;
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return x * y;
  };
  const frames = [...document.querySelectorAll("iframe")];
  await sleep(2800);
  const report = [];
  for (const frame of frames) {
    const id = frame.dataset.id;
    const expect = frame.dataset.expect;
    const row = { id, expect, ok: false, errors: [] };
    try {
      const d = frame.contentDocument;
      const w = frame.contentWindow;
      if (!d || !w) throw new Error("no contentDocument (file iframe blocked?)");
      if (typeof w.applyScenario === "function") w.applyScenario("start-origins");
      await sleep(600);
      const scr = d.querySelector('[data-screen="origins"]');
      const box = d.querySelector("#origins-box");
      const stage = d.querySelector(".origins-stage");
      const card = d.querySelector(".prolog-frame .auth-card");
      const eye = d.querySelector(".origins-stage > .peek-btn, .peek-btn");
      const bodyEl = d.querySelector("#origins-box .origin-body");
      const choices = d.querySelector("#origins-box .choice-stack");
      if (!scr || scr.classList.contains("hidden")) row.errors.push("origins hidden");
      if (!box) row.errors.push("no #origins-box");
      if (!stage) row.errors.push("no .origins-stage");
      if (!eye) row.errors.push("no peek eye");
      const br = box?.getBoundingClientRect();
      const sr = stage?.getBoundingClientRect();
      const cr = card?.getBoundingClientRect();
      const er = eye?.getBoundingClientRect();
      const textR = bodyEl?.getBoundingClientRect();
      const choiceR = choices?.getBoundingClientRect();
      row.box = br ? { w: Math.round(br.width), h: Math.round(br.height) } : null;
      row.stage = sr ? { w: Math.round(sr.width), h: Math.round(sr.height) } : null;
      row.card = cr ? { w: Math.round(cr.width), h: Math.round(cr.height) } : null;
      row.eye = er
        ? { x: Math.round(er.left), y: Math.round(er.top), w: Math.round(er.width), h: Math.round(er.height) }
        : null;
      if (br && (br.width < 80 || br.height < 40)) row.errors.push("box too small");
      if (sr && (sr.width < 100 || sr.height < 80)) row.errors.push("stage too small");
      if (er && (er.width < 24 || er.height < 24)) row.errors.push("eye hit too small");
      if (id === "phone-landscape" && cr && sr) {
        const ratio = cr.width / Math.max(sr.width, 1);
        row.cardRatio = Math.round(ratio * 100) / 100;
        if (ratio < 0.52) row.errors.push("landscape card narrower than ~52% stage");
      }

      /* Eye must not cover readable prose / choices (2px slack for AA). */
      const eyeVsBody = overlapArea(er, textR);
      const eyeVsChoices = overlapArea(er, choiceR);
      row.overlap = { body: Math.round(eyeVsBody), choices: Math.round(eyeVsChoices) };
      if (eyeVsBody > 4) row.errors.push("eye overlaps origin-body (" + Math.round(eyeVsBody) + "px²)");
      if (eyeVsChoices > 4) row.errors.push("eye overlaps choices (" + Math.round(eyeVsChoices) + "px²)");
      if (id === "phone-landscape" && er && sr) {
        /* Tight top-right of stage (not centered / not inset like progress). */
        const mid = sr.left + sr.width / 2;
        if (er.left < mid) row.errors.push("landscape eye not in right half of stage");
        if (sr.right - er.right > 36) row.errors.push("landscape eye not near stage right");
        if (er.top - sr.top > 36) row.errors.push("landscape eye not near stage top");
      }
      if (id === "phone-landscape" && br && cr) {
        /* Equal near·hit·near: content inset from card L/R should match (±6px). */
        const leftGap = br.left - cr.left;
        const rightGap = cr.right - br.right;
        row.sideGaps = { left: Math.round(leftGap), right: Math.round(rightGap) };
        if (Math.abs(leftGap - rightGap) > 6) {
          row.errors.push(
            "landscape side gutters unequal L" + Math.round(leftGap) + " R" + Math.round(rightGap)
          );
        }
      }

      const body = d.querySelector("#origins-box .origin-body");
      const flowScroll = d.querySelector("#origins-box .origin-flow-scroll");
      const clip = d.querySelector("#origins-box .scroll-fade-clip");
      if (body) {
        body.style.minHeight = "1200px";
        body.innerHTML = "<p class='prose-beat origin-text'>" + "Odstavec. ".repeat(80) + "</p>" + body.innerHTML;
      }
      await sleep(200);
      const scroller = expect === "phone" ? flowScroll : body;
      if (scroller) {
        scroller.scrollTop = 80;
        scroller.dispatchEvent(new Event("scroll"));
        await sleep(120);
        row.fade = {
          top: scroller.classList.contains("fade-top"),
          bottom: scroller.classList.contains("fade-bottom"),
        };
      }
      const root = d.querySelector('[data-screen="origins"]') || d.documentElement;
      const csRoot = w.getComputedStyle(root);
      const floor = csRoot.getPropertyValue("--prolog-scroll-fade-floor").trim();
      const fadeLen = csRoot.getPropertyValue("--prolog-scroll-fade").trim();
      row.floor = floor;
      row.fadeLen = fadeLen;
      const fn = Number(floor);
      if (!Number.isFinite(fn) || fn < 0 || fn > 0.1) row.errors.push("bad floor: " + floor);

      const maskHost =
        expect === "desktop" && clip && scroller?.classList.contains("fade-top")
          ? clip
          : expect === "phone"
            ? d.querySelector("#origins-box .origin-flow")
            : null;
      if (maskHost && (expect === "phone" ? scroller?.classList.contains("fade-top") : true)) {
        const cs = w.getComputedStyle(maskHost);
        const mask = cs.webkitMaskImage || cs.maskImage || "";
        row.maskHost = maskHost.className;
        row.clipMask = mask.slice(0, 160);
        if (expect === "desktop" && scroller?.classList.contains("fade-top")) {
          if (!mask || mask === "none") row.errors.push("desktop clip should mask when fade-top");
        }
        if (/transparent/.test(mask) && !/0\\.4|0\\.5|0\\.58|var\\(--prolog-scroll-fade-floor\\)/.test(mask)) {
          row.errors.push("mask uses transparent edge (fade-to-black risk)");
        }
      }

      row.ok = row.errors.length === 0;
    } catch (e) {
      row.errors.push(String(e && e.message ? e.message : e));
    }
    report.push(row);
  }
  document.getElementById("out").textContent = JSON.stringify(report);
})();
</script>
</body></html>`
  );

  const fileUrl = `file://${harness}`;
  const run = spawnSync(
    brave,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--allow-file-access-from-files",
      "--virtual-time-budget=20000",
      `--window-size=1800,1000`,
      "--dump-dom",
      fileUrl,
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, timeout: 60000 }
  );

  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  if (run.error) return t.skip(String(run.error.message || run.error));
  const dom = run.stdout || "";
  const m = dom.match(/<pre id="out">([^<]*)<\/pre>/);
  if (!m) return t.skip("no #out in dump (iframe/file access blocked in headless)");
  let report;
  try {
    report = JSON.parse(m[1].replace(/&quot;/g, '"'));
  } catch (e) {
    assert.fail("bad JSON in #out: " + e.message);
  }
  assert.equal(report.length, VIEWPORTS.length);
  for (const row of report) {
    assert.equal(row.ok, true, `${row.id}: ${row.errors?.join("; ") || "fail"}`);
  }
});
