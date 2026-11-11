/*
 * Kodex: annotace herního textu hesly. Čisté - bez DOMu a bez Math.random.
 * annotate obalí první výskyt (i skloňování) do <abbr class="kodex" data-kodex="id">;
 * nikdy uvnitř tagů, atributů ani už obaleného hesla.
 */
(function (root, factory) {
  const data = typeof require === "function"
    ? require("../data/kodex.js")
    : root.LOM;
  const api = factory(data);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Kodex: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function (data) {
  const { KODEX, KODEX_BY } = data;

  /** prefs.kodex !== false → zapnuto (výchozí). */
  function enabled(prefs) {
    if (!prefs) return true;
    return prefs.kodex !== false;
  }

  function markSeen(set, id) {
    if (set && id) set.add(id);
    return set;
  }

  function escAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** Seznam { id, form, re }; `skip` = id už obalená v tomto průchodu. Delší formy dřív. */
  function buildMatchers(skip, entries) {
    const list = [];
    for (const e of entries) {
      if (skip && skip.has(e.id)) continue;
      for (const form of e.forms) {
        if (!form) continue;
        list.push({
          id: e.id,
          form,
          re: new RegExp(escapeRe(form), "i"),
        });
      }
    }
    list.sort((a, b) => b.form.length - a.form.length);
    return list;
  }

  function isWordChar(ch) {
    return ch && /[\p{L}\p{N}_]/u.test(ch);
  }

  function isKodexOpen(tag) {
    return /^<abbr\b/i.test(tag) && /\bclass\s*=\s*["'][^"']*\bkodex\b/i.test(tag);
  }

  function isAbbrClose(tag) {
    return /^<\/abbr\b/i.test(tag);
  }

  /**
   * První bezpečný výskyt: jen text mimo tagy a mimo <abbr class="kodex">.
   * @returns {{ id: string, start: number, end: number, text: string } | null}
   */
  function findFirst(html, matchers) {
    if (!matchers.length) return null;
    let best = null;
    let i = 0;
    let inKodex = 0;
    let textStart = -1;

    const considerChunk = (start, end) => {
      if (inKodex > 0 || start < 0 || end <= start) return;
      const chunk = html.slice(start, end);
      for (const m of matchers) {
        const local = chunk.search(m.re);
        if (local < 0) continue;
        const matched = chunk.slice(local).match(m.re)[0];
        const abs = start + local;
        if (isWordChar(html[abs - 1]) || isWordChar(html[abs + matched.length])) continue;
        if (
          !best ||
          abs < best.start ||
          (abs === best.start && matched.length > best.text.length)
        ) {
          best = { id: m.id, start: abs, end: abs + matched.length, text: matched };
        }
      }
    };

    while (i < html.length) {
      if (html[i] === "<") {
        if (textStart >= 0) {
          considerChunk(textStart, i);
          textStart = -1;
        }
        const gt = html.indexOf(">", i);
        const tagEnd = gt < 0 ? html.length : gt + 1;
        const tag = html.slice(i, tagEnd);
        if (isKodexOpen(tag)) inKodex++;
        else if (isAbbrClose(tag) && inKodex > 0) inKodex--;
        i = tagEnd;
        continue;
      }
      if (textStart < 0) textStart = i;
      i++;
    }
    if (textStart >= 0) considerChunk(textStart, html.length);
    return best;
  }

  /** Id už přítomná jako data-kodex v HTML (ať se při druhém annotate neobalí znovu). */
  function idsInHtml(html) {
    const ids = new Set();
    const re = /data-kodex="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) ids.add(m[1]);
    return ids;
  }

  /**
   * Obalí první výskyt každého hesla v tomto HTML (jednou za id).
   * Globální `seenSet` se plní, ale **neblokuje** obalení čistého textu
   * (návrat na krok prologu znovu ukáže tečky). Už obalená id v HTML se přeskočí.
   */
  function annotate(html, seenSet, opts = {}) {
    if (!enabled(opts.prefs)) return html;
    if (typeof html !== "string" || !html) return html || "";
    const entries = opts.entries || KODEX;
    const set = seenSet || new Set();
    const here = idsInHtml(html); /* už v HTML + nově v tomto průchodu */
    let out = html;

    for (;;) {
      const open = buildMatchers(here, entries);
      if (!open.length) break;
      const hit = findFirst(out, open);
      if (!hit) break;
      const wrap = `<abbr class="kodex" data-kodex="${escAttr(hit.id)}">${hit.text}</abbr>`;
      out = out.slice(0, hit.start) + wrap + out.slice(hit.end);
      markSeen(here, hit.id);
      markSeen(set, hit.id);
    }
    return out;
  }

  return { annotate, markSeen, enabled, KODEX, KODEX_BY };
});
