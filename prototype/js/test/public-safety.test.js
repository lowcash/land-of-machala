const test = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const MARKER = "⟦tajné:"; // značka rozepsaného tajného textu (⟦tajné: text⟧); nesmí být v žádném trackovaném souboru. Dokumenty ji popisují bez dvojtečky.

function tracked() {
  try {
    return execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return null; // mimo git (např. export): test se přeskočí
  }
}

test("tajný obsah (docs/secret) nejde do veřejného exportu", () => {
  const { ALLOW } = require("../../../tools/export-public.js");
  assert.equal(ALLOW.some((a) => "docs/secret/x.md".startsWith(a + "/") || a === "docs/secret"), false, "docs/secret nesmí být v ALLOW");
});

test("deník autora (docs/JOURNAL.md) a plánování nejdou do veřejného exportu", () => {
  const { ALLOW } = require("../../../tools/export-public.js");
  const covered = (f) => ALLOW.some((a) => f === a || f.startsWith(a + "/"));
  for (const f of ["docs/JOURNAL.md", "docs/PLANNING.md", "docs/ideas/README.md", "docs/tasks/README.md"]) {
    assert.equal(covered(f), false, `${f} nesmí být v ALLOW exportu`);
  }
});

test("žádný trackovaný soubor neobsahuje značku tajného textu ani klíče", (t) => {
  const files = tracked();
  if (!files) return t.skip("není git repo");
  const bad = [];
  for (const f of files) {
    if (!/\.(md|js|json|html|css|txt|svg|yml|yaml|env)$/i.test(f) || f.endsWith("public-safety.test.js")) continue;
    const abs = path.join(root, f);
    if (!fs.existsSync(abs)) continue; /* smazáno ve working tree, ještě necommitnuto */
    const txt = fs.readFileSync(abs, "utf8");
    if (txt.includes(MARKER)) bad.push(`${f}: značka ${MARKER}`);
    if (/(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.test(txt)) bad.push(`${f}: vypadá jako klíč`);
  }
  assert.deepEqual(bad, []);
});
