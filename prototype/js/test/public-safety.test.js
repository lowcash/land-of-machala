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

test("soukromý obsah není trackovaný a je v .gitignore", (t) => {
  const files = tracked();
  if (!files) return t.skip("není git repo");
  assert.deepEqual(files.filter((f) => f.startsWith("content-private/")), []);
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.ok(ignore.split("\n").includes("content-private/"), ".gitignore musí obsahovat content-private/");
  assert.ok(ignore.split("\n").includes("CONVERSATION.md"), ".gitignore musí obsahovat CONVERSATION.md");
});

test("žádný trackovaný soubor neobsahuje značku tajného textu ani klíče", (t) => {
  const files = tracked();
  if (!files) return t.skip("není git repo");
  const bad = [];
  for (const f of files) {
    if (!/\.(md|js|json|html|css|txt|svg|yml|yaml|env)$/i.test(f) || f.endsWith("public-safety.test.js")) continue;
    const txt = fs.readFileSync(path.join(root, f), "utf8");
    if (txt.includes(MARKER)) bad.push(`${f}: značka ${MARKER}`);
    if (/(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.test(txt)) bad.push(`${f}: vypadá jako klíč`);
  }
  assert.deepEqual(bad, []);
});
