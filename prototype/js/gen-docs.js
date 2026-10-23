/*
 * Generuje číselné tabulky do docs/reference/*.md (mezi značkami <!-- gen:x --> … <!-- /gen:x -->).
 * Použití: node prototype/js/gen-docs.js [výstupní složka, výchozí docs/reference]
 * Čísla vždy pocházejí z kódu (js/data, js/systems) a simulace — ručně se needitují.
 */
const fs = require("fs");
const path = require("path");
const { ENEMIES } = require("./data/enemies.js");
const { BASE, RACE_MOD, PILGRIM } = require("./data/characters.js");
const { INVENTORY, itemCategory } = require("./data/items.js");
const MapData = require("./data/map.js");
const W = require("./systems/world.js");
const { TUNE, INCOMING, COST, GAIN } = require("./systems/combat.js");
const { PLAYERS, run } = require("./sim.js");

const OUT = path.resolve(process.argv[2] || path.join(__dirname, "../../docs/reference"));
const md = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const pct = (x) => `${Math.round(x * 100)} %`;

const blocks = {};

blocks.actions = md(
  ["akce", "zdroj", "efekt"],
  [
    ["Rychlý (`quick`)", "0", `zásah ${pct(TUNE.quickHit)} + DEX·1 %, dmg ATK×${TUNE.quickDmg}+${TUNE.quickPlus}; vs těžký +10 % zásah a −40 % příchozí; vs obrana −3 dmg`],
    ["Těžký (`heavy`)", `−${COST.heavy}`, `zásah ${pct(TUNE.heavyHit)} + DEX·1 %, dmg ATK×${TUNE.heavyDmg}+${TUNE.heavyPlus}; vs rychlý +15 % zásah; vs obrana +4 dmg`],
    ["Speciál (`special`)", `−${COST.special}`, `nemine, ignoruje obranu a DEF; dmg síla×${TUNE.specialDmg} (pacholek ATK, dřevorubec DEX×1,45, bylinkář INT×1,3, písař INT×1,1)`],
    ["Obrana (`guard`)", `+${GAIN.guard}`, "příchozí poškození podle matice níže; vs těžký protiúder"],
    ["Úhyb (`evade`)", `+${GAIN.evade}`, "příchozí podle matice; vs rychlý protiúder; příští útěk +30 %"],
    ["Pozorování (`observe`)", `+${GAIN.observe}`, "příchozí ×0,85; příští indicie +50 % šance přečtení"],
    ["Odvar (`potion`)", "0", "+14 HP, spotřebuje předmět z batohu, stojí tah"],
    ["Odvar předtuchy (`foresight`)", "0", "5 tahů +40 % šance přečtení, spotřebuje předmět, stojí tah"],
    ["Útěk (`flee`)", "0", "šance 35 % + DEX·2 % + bonus z úhybu (5–90 %); selhání = nepřítel útočí bez tvé obrany"],
    ["Ušetřit (`spare`)", "0", "jen když nepřítel nabídl vzdání; konec boje, ½ zlata, 70 % XP, bez kořisti"],
  ]
);

blocks.incoming = md(
  ["tvoje akce ↓ / záměr nepřítele →", "těžký úder", "rychlý výpad", "obrana"],
  Object.entries(INCOMING).map(([a, m]) => [`\`${a}\``, `×${m.heavy}`, `×${m.quick}`, `×${m.guard}`]).concat([["ostatní (útok, potion…)", "×1", "×1", "×1"]])
);

blocks.enemies = md(
  ["id", "jméno", "Lv", "typ", "HP", "DEF", "dmg těžký/rychlý/obrana", "váhy záměrů T/R/O", "adaptace", "klam", "vzdání", "zlato", "XP", "kořist"],
  Object.values(ENEMIES).map((e) => [
    `\`${e.id}\``, e.name, e.level, e.type, e.hp, e.def,
    `${e.dmg.heavy}/${e.dmg.quick}/${e.dmg.guard}`,
    `${e.tactics.weights.heavy}/${e.tactics.weights.quick}/${e.tactics.weights.guard}`,
    e.tactics.adapt || "—", e.tactics.feint ? pct(e.tactics.feint) : "—",
    e.surrenderAt ? `≤ ${pct(e.surrenderAt)} HP` : "—",
    `${e.reward.gold[0]}–${e.reward.gold[1]}`, e.reward.xp,
    e.reward.loot.length ? e.reward.loot.map((l) => `\`${l.id}\` ${pct(l.p)}`).join(", ") : "—",
  ])
);

blocks.tune = "```js\n" + JSON.stringify({ ...TUNE, costs: COST, gains: GAIN }, null, 2) + "\n```";

const N = 1000;
const bots = ["vždy-quick", "vždy-heavy", "vždy-special", "vždy-guard", "vždy-evade", "náhodný", "čtenář", "informovaný"];
blocks.sim = md(
  ["nepřítel (pacholek Lv1)", ...bots.map((b) => b.replace("vždy-", "vždy "))],
  ["wolf", "boar", "bandit", "brigand"].map((e) => [`\`${e}\``, ...bots.map((b) => run(b, e, PLAYERS.mercenary, N).win.toFixed(0) + " %")])
) + `\n\n_${N} bojů na bota, seedy 1…${N}. „čtenář“ věří indicii jen při jistotě „tuším/jistě“, jinak hraje těžký + obrana. „informovaný“ zná skutečný záměr._`;

const ex = { player: { int: 10 }, familiarity: 0.15 };
blocks.read = md(
  ["podmínka (bandita, pacholek)", "čtenář výhry", "rozdíl proti INT 4"],
  (() => {
    const base = run("čtenář", "bandit", PLAYERS.mercenary, N).win;
    const rows = [
      ["INT 4", base],
      ["INT 10 + zkušenost 0,15", run("čtenář", "bandit", PLAYERS.mercenary, N, ex).win],
      ["INT 4 + odvar předtuchy", run("čtenář+odvar", "bandit", PLAYERS.mercenary, N, { items: { foresight: 1 } }).win],
    ];
    return rows.map(([l, w]) => [l, w.toFixed(0) + " %", (w - base >= 0 ? "+" : "") + (w - base).toFixed(0) + " p. b."]);
  })()
);

blocks.classes = md(
  ["povolání", "STR", "DEX", "VIT", "INT", "zdroj", "max zdroj"],
  [["poutník (bez volby)", PILGRIM], ...Object.entries(BASE)].map(([k, v]) => {
    const o = typeof k === "string" ? [k, v] : k;
    return [`\`${o[0]}\``, o[1].str, o[1].dex, o[1].vit, o[1].int, o[1].res, o[1].resMax];
  })
);
blocks.races = md(["rasa", "STR", "DEX", "VIT", "INT"], Object.entries(RACE_MOD).map(([k, v]) => [`\`${k}\` ${v.label}`, v.str, v.dex, v.vit, v.int]));

const { ORIGINS } = require("./data/origins.js");
const startTxt = (s) => (s.place ? `místo \`${s.place}\`` : `buňka (${s.cell[0]},${s.cell[1]})`);
const standingTxt = (st) => {
  const e = Object.entries(st || {});
  return e.length ? e.map(([k, v]) => `\`${k}\` ${v > 0 ? "+" : ""}${v}`).join(", ") : "—";
};
blocks.origins = md(
  ["id", "název", "start", "zlato", "banka", "věc", "standing", "výdrž"],
  Object.values(ORIGINS).map((o) => [
    `\`${o.id}\``,
    o.label,
    startTxt(o.start),
    o.gold,
    o.bank,
    o.item ? `\`${o.item}\`` : "—",
    standingTxt(o.standing),
    o.energyBonus ? `+${o.energyBonus}` : "—",
  ])
);

const CAT_TITLE = { weapons: "Zbraně", armor: "Zbroje a štíty", jewelry: "Šperky", consumables: "Spotřebiče", misc: "Ostatní" };
blocks.items = Object.keys(CAT_TITLE)
  .map((cat) => {
    const rows = INVENTORY.filter((i) => itemCategory(i) === cat);
    return `### ${CAT_TITLE[cat]} (${rows.length})\n\n` + md(["id", "název", "slot", "ATK", "DEF", "váha", "vzácnost", "poznámka"], rows.map((i) => [`\`${i.id}\``, i.name, i.slot, i.atk || "—", i.def || "—", i.weight, i.rarity, i.tip]));
  })
  .join("\n\n");

const TERR = { road: "cesta", plains: "pláně", forest: "les", hills: "kopce", chapel: "kaple" };
blocks.spots = md(
  ["terén", "šance, že políčko má místo", "kdy", "pool"],
  [["town / village a okolí (±" + W.SAFE_RADIUS + ")", "0 %", "—", "—"]].concat(
    Object.entries(W.SPOT_TABLE).flatMap(([t, rows]) => rows.map((r) => [`${TERR[t]} (\`${t}\`)`, pct(r.p), r.when === "night" ? "jen večer a v noci" : "stále", `\`${r.pool}\``]))
  )
);
blocks.pools = md(
  ["pool", "členové (váha)"],
  Object.entries(W.POOLS).map(([k, m]) => [`\`${k}\``, Object.entries(m).map(([e, v]) => `\`${e}\` ${v}`).join(", ") || "zatím žádný"])
);
blocks.levels = md(
  ["povolání", "za úroveň"],
  Object.entries(W.LEVEL_GAIN).map(([k, g]) => [`\`${k}\``, Object.entries(g).map(([a, v]) => `+${v} ${a.toUpperCase()}`).join(", ")])
) + "\n\nXP na další úroveň = `50 × úroveň` (Lv1→2: 50, Lv2→3: 100 …). Nová úroveň doplní HP.";
blocks.time = md(["fáze", "tiky", "noc?"], W.PHASES.map((p, i) => [`${p.icon} ${p.label}`, `${i * W.TICKS_PER_PHASE}–${(i + 1) * W.TICKS_PER_PHASE - 1}`, i >= 3 ? "ano" : "ne"])) +
  `\n\nDen má ${W.TICKS_PER_DAY} tiků. Krok po mapě = ${W.TIME_COST.step} tik, boj = ${W.TIME_COST.fight}, spánek v hospodě přeskočí na ráno. Start hry: odpoledne, den 1.`;


const { QUESTS } = require("./data/quests.js");
const ITEM_NAME = Object.fromEntries(INVENTORY.map((i) => [i.id, i.name]));
const rewardText = (r) => [r.gold ? `${r.gold} 🪙` : "", r.xp ? `${r.xp} XP` : "", ...(r.items || []).map((i) => ITEM_NAME[i])].filter(Boolean).join(", ") || "—";
blocks.quests = md(
  ["id", "název", "nabízí", "odevzdat", "cíle", "odměna"],
  QUESTS.map((q) => [
    `\`${q.id}\``, q.title,
    `${q.giver.npc} (${q.giver.place}) po otázce \`${q.giver.after}\``,
    q.turnIn.place ? `${q.turnIn.npc} (${q.turnIn.place})` : `${q.turnIn.npc}, políčko ${q.turnIn.cell}`,
    q.objectives.map((o) => (o.type === "kill" ? `zabít ${o.count}× \`${o.enemy}\` v terénu \`${o.terrain}\`` : o.type === "have" ? `mít ${o.count}× \`${o.item}\`` : `dojít na ${o.cell}`)).join("; "),
    q.choices ? q.choices.map((c) => `**${c.label}**: ${rewardText(c.reward)} (flag \`${c.flags.join(",")}\`)`).join("<br>") : rewardText(q.reward),
  ])
);

const KZ = require("./data/kauzy.js").KAUZY.zvon;
const TR = { true: "pravda", half: "napůl", false: "nepravda", none: "nerozhodne se" };
blocks.kzclaims = md(
  ["id", "kdo", "tvrdí", "typ", "ověření", "A", "B", "C"],
  Object.entries(KZ.claims).map(([id, c]) => [`\`${id}\``, KZ.npcs[c.by].name, c.text, c.tag, `${c.verify.via}: ${c.verify.where}`, TR[c.truth.A], TR[c.truth.B], TR[c.truth.C]])
);
blocks.kznpcs = md(
  ["NPC", "spolehlivost", "signál (šance)", "signál při napůl / lži"],
  Object.values(KZ.npcs).map((n) => [n.name, pct(n.rel), n.tell ? pct(n.tell) : "—", n.tell ? `${n.signals.a} / ${n.signals.b}` : "nikdy; jen vynechává"])
);
blocks.kzverdicts = md(
  ["verdikt", "kde", "podmínka", "dopad na důvěru", "zlato", "pozn."],
  Object.entries(KZ.verdicts).map(([id, v]) => [
    `\`${id}\` ${v.label}`, v.auto ? "po lhůtě" : v.at,
    v.needs ? Object.entries(v.needs).map(([k, x]) => (k === "bell" ? "zvon v batohu" : `${x} 🪙`)).join(", ") : "—",
    Object.entries(v.effects.trust).map(([n, d]) => `${n} ${d > 0 ? "+" : ""}${d}`).join(", "),
    v.effects.gold ? String(v.effects.gold) : "—", v.consumeBell ? "zvon se odevzdá" : "",
  ])
);

const { SCENARIOS, GROUPS } = require("./dev/scenarios.js");
const cell = (t) => String(t || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
blocks.scenes = md(
  ["skupina", "id", "název", "co zkusit"],
  [...SCENARIOS].sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)).map((sc) => [`${GROUPS.indexOf(sc.group) + 1} ${sc.group}`, `\`${sc.id}\``, cell(sc.label), cell(sc.note)])
);
/* doporučená trasa: jen pracovní sada Prolog */
const TOUR = [
  ["start-landing", "landing (private only)"],
  ["start-origins", "prolog choices"],
  ["start-confirm", "character summary + name"],
  ["start-morning", "wake hayloft + demo restart CTA"],
  ["morning-cottage", "wake cottage + Vstát"],
  ["morning-lodging", "wake lodging + Vstát"],
];
blocks.tour = md(
  ["#", "scéna", "proč"],
  TOUR.map(([id, why], i) => {
    const sc = SCENARIOS.find((x) => x.id === id);
    if (!sc) throw new Error("Trasa prohlídky: neznámá scéna " + id);
    return [i + 1, `\`${id}\` ${cell(sc.label)}`, why];
  })
);


const { SYSTEMS } = require("./dev/scenarios.js");
const ST_ICON = { funguje: "✅", maketa: "🟡", "chybí": "❌" };
blocks.systems = md(
  ["systém", "stav", "hotovo", "poznámka"],
  SYSTEMS.map((x) => [x.name, `${ST_ICON[x.status] || ""} ${x.status}`, `${x.pct} %`, x.note || ""])
);

/* Mapa 7×7 z js/data/map.js */
blocks.map = (() => {
  const { MAP_MAX, GRID, POI, TERRAIN_CS, ZONE_CS, terrainAt, zoneAt } = MapData;
  const legend = Object.entries(TERRAIN_CS).map(([k, cs]) => `\`${k}\` ${cs}`).join(" · ");
  const head = ["y\\x", ...Array.from({ length: MAP_MAX + 1 }, (_, x) => String(x))];
  const rows = [];
  for (let y = MAP_MAX; y >= 0; y--) {
    rows.push([String(y), ...GRID[MAP_MAX - y].map((t) => `\`${t}\``)]);
  }
  const grid = md(head, rows);
  const poi = md(
    ["id", "název", "(x,y)", "terén", "zóna"],
    Object.entries(POI).map(([id, p]) => {
      const [x, y] = p.cell;
      return [`\`${id}\``, p.label, `(${x},${y})`, `\`${terrainAt(x, y)}\``, ZONE_CS[zoneAt(x, y)]];
    })
  );
  return `Velikost ${MAP_MAX + 1}×${MAP_MAX + 1}. Osa Y ↑ sever. Spawn = město.\n\n**Legenda:** ${legend}\n\n**Zóny:** ${Object.entries(ZONE_CS).map(([k, cs]) => `\`${k}\` ${cs}`).join(" · ")}; v bezpečné zóně (město, vesnice, kaple) nejsou bojová místa (hlídá test); neutrální (cesty, dílny) má jen vzácné lapky; nebezpečná (louky, les, kopce) divočinu a v noci víc. Zóna zatím nemění pravidla, jen pojmenovává stav.\n\n${grid}\n\n### Body zájmu (POI)\n\n${poi}`;
})();

/* Evidence nápadů: frontmatter v docs/ideas/*.md → rejstřík */
const IDEAS_DIR = path.join(__dirname, "../../docs/ideas");
const IDEA_TYPES = ["system", "obsah", "svet", "ui", "tech", "produkce", "vyzkum", "sbirka"];
const IDEA_STATUSES = ["napad", "navrzeno", "planovano", "rozdelano", "hotovo", "zamitnuto"];
const IDEA_PHASES = ["fp1", "po-fp1", "po-serveru", "nekdy"];
const IDEA_SIZES = ["S", "M", "L"];
const PHASE_LABEL = { fp1: "FP1", "po-fp1": "Po FP1", "po-serveru": "Po serveru", nekdy: "Někdy" };
const TYPE_LABEL = { system: "systém", obsah: "obsah", svet: "svět", ui: "UI", tech: "tech", produkce: "produkce", vyzkum: "výzkum", sbirka: "sbírka" };

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const t = line.replace(/\s+#.*$/, "").trim();
    if (!t) continue;
    const i = t.indexOf(":");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean);
    }
    meta[key] = val;
  }
  return { meta, body: m[2].trim() };
}

function loadIdeas() {
  if (!fs.existsSync(IDEAS_DIR)) return [];
  return fs.readdirSync(IDEAS_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => {
      const raw = fs.readFileSync(path.join(IDEAS_DIR, f), "utf8");
      const parsed = parseFrontmatter(raw);
      if (!parsed) throw new Error("ideas: chybí frontmatter v " + f);
      return { file: f, slug: f.replace(/\.md$/, ""), ...parsed.meta, body: parsed.body };
    })
    .sort((a, b) => a.id.localeCompare(b.id, "cs"));
}

function ideaLink(idea) {
  return `[${idea.title}](${idea.id}.md)`;
}

function depsCell(idea) {
  const d = idea.depends;
  if (!d || (Array.isArray(d) && !d.length)) return "—";
  const list = Array.isArray(d) ? d : [d];
  return list.map((x) => `\`${x}\``).join(", ");
}

blocks.ideas = (() => {
  const ideas = loadIdeas();
  const active = ideas.filter((i) => i.status !== "hotovo" && i.status !== "zamitnuto");
  const done = ideas.filter((i) => i.status === "hotovo" || i.status === "zamitnuto");
  const counts = IDEA_TYPES.map((t) => `${TYPE_LABEL[t] || t}: ${ideas.filter((i) => i.type === t).length}`).join(" · ");
  const phaseCounts = IDEA_PHASES.map((p) => `${PHASE_LABEL[p]}: ${active.filter((i) => i.phase === p).length}`).join(" · ");
  let out = `**Celkem ${ideas.length}** (${counts}).\n\nAktivní podle fáze: ${phaseCounts}.\n`;
  for (const phase of IDEA_PHASES) {
    const inPhase = active.filter((i) => i.phase === phase);
    if (!inPhase.length) continue;
    out += `\n## ${PHASE_LABEL[phase]}\n`;
    for (const type of IDEA_TYPES) {
      const rows = inPhase.filter((i) => i.type === type);
      if (!rows.length) continue;
      out += `\n### ${TYPE_LABEL[type] || type}\n\n`;
      out += md(
        ["nápad", "druh", "stav", "velikost", "závislosti"],
        rows.map((i) => [ideaLink(i), TYPE_LABEL[i.type] || i.type, i.status, i.size, depsCell(i)])
      );
      out += "\n";
    }
  }
  out += `\n## Hotové a zamítnuté\n\n`;
  if (!done.length) out += "_Zatím nic._\n";
  else {
    out += md(
      ["nápad", "druh", "stav", "velikost", "závislosti"],
      done.map((i) => [ideaLink(i), TYPE_LABEL[i.type] || i.type, i.status, i.size, depsCell(i)])
    );
    out += "\n";
  }
  return out.trim() + "\n";
})();

function fill(file) {
  const f = path.isAbsolute(file) ? file : path.join(OUT, file);
  if (!fs.existsSync(f)) return console.log("přeskočeno (chybí):", f);
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(/<!-- gen:(\w+) -->[\s\S]*?<!-- \/gen:\1 -->/g, (m, k) => (blocks[k] ? `<!-- gen:${k} -->\n${blocks[k]}\n<!-- /gen:${k} -->` : m));
  fs.writeFileSync(f, s);
  console.log("aktualizováno:", f);
}

/** V textu označí první výskyty Kodex hesel jako «tvar»〔id〕 – kontrola tooltipů. */
function markKodexInText(text, KODEX) {
  if (!text) return { text: "", hits: [] };
  const forms = [];
  for (const e of KODEX) {
    for (const form of e.forms || []) {
      if (form) forms.push({ id: e.id, form, term: e.term });
    }
  }
  forms.sort((a, b) => b.form.length - a.form.length);
  const hits = [];
  const seen = new Set();
  let out = String(text);
  for (const f of forms) {
    if (seen.has(f.id)) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}_«])(${f.form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\p{L}\\p{N}_»])`, "iu");
    if (!re.test(out)) continue;
    out = out.replace(re, `«$1»〔${f.id}〕`);
    seen.add(f.id);
    hits.push(f.id);
  }
  return { text: out, hits };
}

/* Výpis herních textů ke kontrole tónu (soukromé: docs/story/, mimo ALLOW exportu). */
function writeTexty() {
  const { ORIGINS } = require("./data/origins.js");
  const { KODEX } = require("./data/kodex.js");
  const appSrc = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const htmlSrc = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const stepMatch = appSrc.match(/const ORIGIN_STEPS = (\[[\s\S]*?\n\]);/);
  let prolog = "_Nelze vyčíst ORIGIN_STEPS z app.js._\n";
  if (stepMatch) {
    try {
      // eslint-disable-next-line no-new-func
      const steps = Function(`"use strict"; return (${stepMatch[1]});`)();
      /* kódové klíče pick zůstávají (class/race/…); ve výpisu česky podle os postavy */
      const PICK_CS = { class: "živnost", race: "kraj", react: "reakce (zvon)", origin: "původ" };
      const CLASS_CS = { mercenary: "pacholek", tracker: "dřevorubec", chanter: "bylinkář", legist: "písař", none: "neobjednal" };
      prolog = steps
        .map((s, i) => {
          const pickCs = PICK_CS[s.pick] || s.pick;
          const marked = markKodexInText(s.text || "", KODEX);
          const lines = [`### Krok ${i + 1}: ${pickCs} (\`${s.pick}\`)`, "", marked.text];
          if (marked.hits.length) lines.push("", `_Kodex v kroku: ${marked.hits.map((id) => `\`${id}\``).join(", ")}_`);
          if (s.lead) {
            lines.push("", "**Lead podle živnosti:**");
            for (const [k, v] of Object.entries(s.lead)) {
              const lab = CLASS_CS[k] ? `${CLASS_CS[k]} (\`${k}\`)` : `\`${k}\``;
              const lm = markKodexInText(v, KODEX);
              lines.push(`- ${lab}: ${lm.text}`);
            }
          }
          lines.push("", "**Volby:**");
          for (const c of s.choices || []) {
            const bits = [c.say && `„${c.say}“`, c.act && `*${c.act}*`, c.hint && `(${c.hint})`].filter(Boolean);
            const cm = markKodexInText(bits.join(" "), KODEX);
            lines.push(`- ${cm.text}`);
          }
          return lines.join("\n");
        })
        .join("\n\n");
    } catch (e) {
      prolog = `_Chyba parsování ORIGIN_STEPS: ${e.message}_\n`;
    }
  }
  const originsBlock = Object.entries(ORIGINS)
    .map(([id, o]) => {
      const introM = markKodexInText(o.intro || "", KODEX);
      const greets = o.greet
        ? Object.entries(o.greet)
            .map(([place, lines]) => {
              const joined = (Array.isArray(lines) ? lines : [lines]).map((x) => markKodexInText(`„${x}“`, KODEX).text).join(" / ");
              return `- **${place}:** ${joined}`;
            })
            .join("\n")
        : "_bez greet_";
      const hitNote = introM.hits.length ? `\n\n_Kodex: ${introM.hits.map((x) => `\`${x}\``).join(", ")}_` : "";
      return `### \`${id}\` ${o.label || ""}\n\n${introM.text}${hitNote}\n\n${greets}`;
    })
    .join("\n\n");
  const kodexBlock = KODEX.map((e) => `- **${e.term}** (\`${e.id}\`): ${e.short}`).join("\n");
  /* UI labely z HTML + známé řetězce z app (tlačítka obrazovek) */
  const uiFromHtml = [...htmlSrc.matchAll(/>([^<]{2,80})</g)]
    .map((m) => m[1].replace(/\s+/g, " ").trim())
    .filter((t) => t && !t.startsWith("{{") && /[A-Za-zÁ-ž]/.test(t) && t.length < 60);
  const UI_KNOWN = [
    "Vstoupit do hry",
    "Projít prolog znovu",
    "Vstát",
    "Zkusit prolog znovu",
    "Pokračovat jako",
    "Odhlásit – jiná postava",
    "Vytvořit účet",
    "Už mám účet",
    "Hrát jako host",
    "Nemám účet",
    "Jak tě zvou",
    "Kdo jsi",
    "Chlap",
    "Ženská",
    "Ráno",
    "Vítej zpět",
    "Postava",
    "Nastavení",
    "FAQ",
    "Podmínky",
  ];
  const uiSet = new Set([...UI_KNOWN, ...uiFromHtml.filter((t) => /^(Vstoupit|Projít|Pokračovat|Odhlásit|Vytvořit|Hrát|Jak |Kdo |Chlap|Ženská|Nastavení|FAQ|Podmínky)/.test(t))]);
  const uiBlock = [...uiSet].sort((a, b) => a.localeCompare(b, "cs")).map((t) => `- ${t}`).join("\n");
  const out = `# Herní texty (výpis)

Generováno z dat a prologu (\`node prototype/js/gen-docs.js\`). **Soukromé.** Ve hře žádné em-dash \`—\`.
Pokročilá hesla: [slovnik.md](slovnik.md) (stejný zdroj: \`js/data/kodex.js\`).

**Značka Kodexu:** \`«tvar»〔id〕\` = ve hře tooltip (\`abbr.kodex\`). Kontroluj, že nic důležitého nechybí v Kodexu.

## Prolog

${prolog}

## Původy (intro + greet)

${originsBlock}

## UI (obrazovky)

Tlačítka a labely (kontrola tónu; ne úplný dump DOMu).

${uiBlock}

## Kodex (hesla)

${kodexBlock}
`;
  const dest = path.join(__dirname, "../../docs/story/texty.md");
  fs.writeFileSync(dest, out);
  console.log("aktualizováno:", dest);
}

/** Seznam pokročilých slov = Kodex (zdroj pravdy). Snadná kontrola významu. */
function writeSlovnik() {
  const { KODEX } = require("./data/kodex.js");
  const byKind = {};
  for (const e of KODEX) {
    const k = e.kind || "other";
    (byKind[k] || (byKind[k] = [])).push(e);
  }
  const sections = Object.keys(byKind)
    .sort()
    .map((k) => {
      const rows = byKind[k]
        .sort((a, b) => a.term.localeCompare(b.term, "cs"))
        .map((e) => `| ${e.term} | \`${e.id}\` | ${e.short.replace(/\|/g, "\\|")} |`)
        .join("\n");
      return `## ${k}\n\n| slovo | id | význam |\n|---|---|---|\n${rows}`;
    })
    .join("\n\n");
  const out = `# Slovník (Kodex)

Generováno z \`prototype/js/data/kodex.js\` (\`node prototype/js/gen-docs.js\`). **Soukromé.**
Jen význam slova (ne děj). Běžná slova (sud, kaple, pivo) sem nepatří.
Celé herní texty: [texty.md](texty.md).

${sections}
`;
  const dest = path.join(__dirname, "../../docs/story/slovnik.md");
  fs.writeFileSync(dest, out);
  console.log("aktualizováno:", dest);
}

function main() {
  ["combat.md", "characters.md", "items.md", "world.md", "quests.md", "kauza.md", "storybook.md", "map.md", "../STATUS.md"].forEach(fill);
  fill(path.join(IDEAS_DIR, "README.md"));
  writeTexty();
  writeSlovnik();
}

if (require.main === module) main();

module.exports = {
  parseFrontmatter,
  loadIdeas,
  IDEA_TYPES,
  IDEA_STATUSES,
  IDEA_PHASES,
  IDEA_SIZES,
  IDEAS_DIR,
  blocks,
  main,
};
