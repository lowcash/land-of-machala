/** Jméno hráče: jen jedno slovo (bez mezer / přízvisek); do HTML escapovat. */
function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Kostka: fondy staročeská / německá / polská / církevní; jen křestní (bez „od dolů“ apod.). */
function randomName() {
  const rng = LOM.createRng((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
  const pool = rng.weighted({ staroceska: 55, nemecka: 18, polska: 12, cirkevni: 15 });
  const gender = state.gender === "f" || state.gender === "m" ? state.gender : rng.chance(0.55) ? "m" : "f";
  return LOM.Names.makeName(rng, { pool, gender, withNick: false }).first;
}

/** Vstup jména: bez mezer a interpunkce (přízviska později z mechanik, ne z pole). */
function sanitizeHeroName(raw) {
  return String(raw || "")
    .replace(/[<>&"']/g, "")
    .replace(/\s+/g, "")
    .slice(0, 20);
}

/** Soft seed: písař čte plynně; ostatní zatím 0 (učení později). */
function literacyFromPicks() {
  return pickedClass() === "legist" ? 2 : 0;
}

/* PILGRIM / BASE / RACE_MOD / CLASS_INFO / RACE_INFO: js/data/characters.js */
const { PILGRIM, BASE, RACE_MOD, CLASS_INFO, RACE_INFO } = LOM;
const CLASS_LABEL = Object.fromEntries(Object.entries(CLASS_INFO).map(([k, v]) => [k, v.label]));
/* nevybrané povolání nebo rasa = neznámý poutník (picks drží výchozí hodnotu jen kvůli datům) */
const pickedClass = () => (state.prologDone.class ? state.picks.class : null);
const pickedRace = () => (state.prologDone.race ? state.picks.race : null);
const classLabelNow = () => CLASS_LABEL[pickedClass()] || "Povaleč";

const STAT_META = [
  { key: "hp", icon: "♥", label: "HP", title: "Život: když dojde na 0, padáš." },
  { key: "res", icon: "✦", label: "Res", title: "Zdroj v boji (energie; u bylinkáře mana). Mimo boj výdrž na cestu." },
  { key: "str", icon: "⚔", label: "STR", title: "Síla: fyzické poškození." },
  { key: "dex", icon: "◎", label: "DEX", title: "Obratnost: zásah a útěk." },
  { key: "vit", icon: "⬡", label: "VIT", title: "Vitalita: max HP a odolnost." },
  { key: "int", icon: "✧", label: "INT", title: "Intelekt: čtení záměru a jistota fám (ne kouzla)." },
  { key: "atk", icon: "⚔", label: "ATK", title: "Útok: poškození zbraní a síly." },
  { key: "def", icon: "⬡", label: "DEF", title: "Obrana: snižuje přijaté poškození." },
  { key: "gold", icon: "🪙", label: "Zlato", title: "Měšec: zlato u sebe (banka je jinde)." },
];

const STAT_BY = Object.fromEntries(STAT_META.map((m) => [m.key, m]));

/** Jednotný chip se ikonou - všude místo holého ATK/DEF/STR… */
function statChip(key, value, opts = {}) {
  const m = STAT_BY[key];
  if (!m) return `${key} ${value ?? ""}`;
  const tip = opts.tip || m.title;
  const cls = opts.plain ? "stat-chip" : "stat-icon";
  const val = value === undefined || value === null ? "" : value;
  /* bez hodnoty = jen ikona (ne text HP/STR) */
  return `<span class="${cls}" data-stat="${key}" title="${tip}" role="img" aria-label="${m.label}${val !== "" ? `: ${val}` : ""}. ${tip}"><span class="si" aria-hidden="true">${m.icon}</span>${val !== "" ? `<strong>${val}</strong>` : ""}</span>`;
}

function statChipBtn(key, value, opts = {}) {
  const m = STAT_BY[key];
  if (!m) return "";
  const val = value === undefined || value === null || value === "" ? "" : value;
  const tip = opts.tip || m.title;
  const label = val !== "" ? `${m.label}: ${val}` : m.label;
  const flash = opts.flash ? " is-flash" : "";
  return `<button type="button" class="stat-icon${flash}" data-stat="${key}" data-act="stat-tip" data-tip="${tip}" aria-label="${label}. ${tip}">
    <span class="si" aria-hidden="true">${m.icon}</span>${val !== "" ? `<strong>${val}</strong>` : ""}
    <span class="tip-bubble" role="tooltip">${tip}</span>
  </button>`;
}

function laneLabel(text) {
  return `<p class="place-offer-label">${text}</p>`;
}

/**
 * Jedno akční okno (bez lane/L/R wrapperů).
 * opts.stickyHtml = vždy viditelný pruh (např. Zpět u místa)
 */
function actionPanel(label, innerHtml, opts = {}) {
  /* reserveSticky = prázdný pruh (stejná výška jako Zpět), ať layout neskáče */
  const sticky = opts.stickyHtml
    ? `<div class="action-sticky">${opts.stickyHtml}</div>`
    : opts.reserveSticky
      ? `<div class="action-sticky is-spacer" aria-hidden="true"></div>`
      : "";
  /* sticky mimo scroll - obsah neprosvítá pod zpět; fade jen na .action-scroll */
  return `<div class="action-panel">
    ${sticky}
    <div class="action-scroll" data-action-body>
      <div class="action-body">
        ${label ? laneLabel(label) : ""}
        ${innerHtml}
      </div>
    </div>
  </div>`;
}

/** @deprecated alias - starý název v CSS komentářích */
function lanePanel(label, innerHtml) {
  return actionPanel(label, innerHtml);
}

/** Zlato - tip podle kontextu: Cena | Odměna | Měšec */
function goldAmt(n, opts = {}) {
  return statChipBtn("gold", String(n), { tip: opts.tip || "Cena" });
}

/** Sdílený back: stejný `btn-back` jako ve hře (ne nový link styl) */
function navBack({ label, goto, act }) {
  const attrs = goto ? `data-goto="${goto}"` : act ? `data-act="${act}"` : "";
  return `<button type="button" class="btn btn-back nav-back" ${attrs}>← ${label}</button>`;
}

/**
 * Jednotný chrome header: label (Prolog / Původ / …) + volitelné šipky / track.
 * opts: { label, backGoto?, backAct?, canBack?, fwdAct?, canFwd?, segsHtml?, sub? }
 */
function screenChrome(opts) {
  const label = opts.label || "";
  const hasNav = opts.backGoto || opts.backAct || opts.fwdAct || opts.segsHtml;
  const backAttrs = opts.backGoto
    ? `data-goto="${opts.backGoto}"`
    : opts.backAct
      ? `data-act="${opts.backAct}"`
      : "";
  const backBtn = backAttrs
    ? `<button type="button" class="btn btn-ghost progress-arrow" ${backAttrs} ${opts.canBack === false ? "disabled" : ""} title="Zpět" aria-label="Zpět">←</button>`
    : `<span class="progress-arrow-spacer" aria-hidden="true"></span>`;
  const fwdBtn = opts.fwdAct
    ? `<button type="button" class="btn btn-ghost progress-arrow" data-act="${opts.fwdAct}" ${opts.canFwd ? "" : "disabled"} title="Další" aria-label="Další">→</button>`
    : `<span class="progress-arrow-spacer" aria-hidden="true"></span>`;
  const center = `
    <div class="progress-center">
      <span class="progress-label">${label}</span>
      ${opts.segsHtml ? `<div class="progress-track" aria-hidden="true">${opts.segsHtml}</div>` : ""}
      ${opts.sub ? `<p class="chrome-sub">${opts.sub}</p>` : ""}
    </div>`;
  if (!hasNav && !opts.segsHtml) {
    return `<div class="progress-row screen-chrome"><div class="progress-center"><span class="progress-label">${label}</span>${opts.sub ? `<p class="chrome-sub">${opts.sub}</p>` : ""}</div></div>`;
  }
  return `<div class="progress-row screen-chrome"><div class="progress-nav">${backBtn}${center}${fwdBtn}</div></div>`;
}

/** Tip text se ikonami (ne „ATK/DEF“) */
function itemTipBits(item, extra = []) {
  const bits = [item.name];
  if (item.atk) bits.push(`${STAT_BY.atk.icon}+${item.atk}`);
  if (item.def) bits.push(`${STAT_BY.def.icon}+${item.def}`);
  if (item.tip) bits.push(item.tip);
  return bits.concat(extra);
}

/**
 * Jednotná dlaždice předmětu - inventář, picker na postavě, later boj.
 * opts: { on, act, disabled, tag }
 */
function itemTileHtml(item, opts = {}) {
  const on = !!opts.on;
  const tip = itemTipBits(item, opts.extraTips || []).join(" · ");
  const act = opts.act || "";
  const disabled = opts.disabled ? "disabled" : "";
  const rarity = item.rarity || "common";
  const slotType = item.slot || "misc";
  const cls = [
    "panel-tile",
    "inv-tile",
    "inv-cell",
    "item-tile",
    "has-tip",
    `rarity-${rarity}`,
    `type-${slotType}`,
    on ? "on" : "",
    opts.canAct ? "can-equip" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<button type="button" class="${cls}" ${act} ${disabled} data-tip="${tip}" data-slot="${slotType}" aria-label="${tip}">
    <span class="panel-tile-ico" aria-hidden="true">${item.icon || "•"}</span>
    <strong class="inv-cell-name rarity-${rarity}">${item.name}</strong>
    ${opts.tag ? `<em class="tag">${opts.tag}</em>` : on ? `<em class="tag">on</em>` : ""}
  </button>`;
}

/** v3-bohatší 3 beaty; roster zůstává 3×3 (6×6 = later) */
const ORIGIN_STEPS = [
  {
    pick: "class",
    text: "Jsi v krčmě. Dusno od kouře, je cítit pečená cibule a zatuchlina ze starých sudů. Na stole v rohu chrápe pijan a jinak je tu prázdno. Ve vsi se proslýchá, že z kaple zmizel zvon.\nSvatava před tebe postaví korbel: „Platíš hned? Na sekeru mám Karla z kovárny. Čím se živíš?“",
    /* volba: say = řeč (v uvozovkách), act = gesto (kurzíva), actAfter = gesto až po řeči; použij jen to, co k volbě přirozeně patří */
    choices: [
      { say: "Dělám, co se komu hodí. Platí to líp než pole.", act: "Pokrčíš rameny, ruka na pásu.", hint: "pacholek", class: "mercenary" },
      { say: "Kácím a chodím po lesích. Mně to stačí.", hint: "dřevorubec", class: "tracker" },
      { act: "Vytáhneš ze záňadří svazek sušených bylin a položíš ho na pult.", hint: "bylinkář", class: "chanter" },
      { say: "Umím číst a psát. Smlouvy čtu i drobným písmem.", hint: "písař", class: "legist" },
      { say: "Já si nic neobjednal.", cheek: true },
    ],
  },
  {
    pick: "race",
    lead: {
      mercenary: "„Hlavně ať se ti hodí zaplatit.“ Opřeš se o lavici tak, aby bylo vidět na dveře.",
      tracker: "Svatava jen přikývne a utře pult. Ze zvyku pootočíš hlavu ke dveřím.",
      chanter: "„K pivku se to hodí,“ usměje se Svatava. „Nech to tu.“ Chvíli mlčíš a posloucháš, jak na stole v rohu chrápe pijan.",
      legist: "Svatava sčítá zářezy na trámu u pultu. Díváš se a nic neříkáš.",
      none: "„Neobjednal,“ zopakuje Svatava. Zvedne korbel a vypije ho do dna, postaví ho prázdný na pult a vůbec ji to nerozhodí.",
    },
    text: "Pijan zvedne hlavu ze stolu a dívá se kamsi vedle tebe.\n„Hej, kdo tam? Odkud seš, co se u vás pije?“",
    choices: [
      /* znak kraje (pití/jídlo doma) — bez vysvětlení místa; hráč si znaky spojí sám */
      { say: "Tmavé pivo, chleba s kmínem a cibuli k tomu.", hint: "Machalští", race: "local", bridge: "„To znám,“ řekne pijan a spokojeně si ťukne do korbelu." },
      { say: "Slanou polévku po šichtě.", hint: "Solníci", race: "saltfolk", bridge: "„Z dolů. To je pak žízeň,“ zakašle pijan." },
      { say: "Kyselý kvas.", hint: "Slatiňané", race: "woodfolk", bridge: "„Kvas. To je ze slatí, ne?“ řekne pijan. „Tam prý stezky chodí, kam se jim zachce. Jako já.“" },
      { say: "Víno a pečeného kapra.", hint: "Brodáci", race: "riverfolk", bridge: "„Od vody. Tam prý chlap chytí rybu dřív, než si sundá boty,“ řekne pijan." },
      { say: "Mléko, ještě teplé.", hint: "Pasečané", race: "hillfolk", bridge: "„Mléko. Tam prý ovce ví o zimě dřív než pastýř,“ řekne pijan." },
    ],
  },
  {
    pick: "react",
    text: "Svatava mezitím odešla do sklepa pro další sud. Chvíli se nic neděje, pak přijde tupá rána. „Čert to vem, herdek, vždyť jsem to tu měla sotva tři dni!“\n„Co zas?“ řekne pijan a opře si hlavu o stůl. Pak se od kaple ozve zvon, jednou. Což je divné, protože žádný tam není. Co uděláš?",
    choices: [
      { say: "Vždyť v kapli žádný zvon není.", act: "Překvapeně vstaneš a vyjdeš ven.", react: "fight", bridge: "Venku mokrá tma a od kaple ticho, jako by tam zvon nikdy nevisel. Vrátíš se dovnitř s prázdnou. Boty máš od bláta." },
      { act: "Neuděláš nic. Počkáš, jestli se to ozve znovu.", react: "hide", bridge: "Chvíli čekáš. Zvon se už neozve." },
      { act: "Sevřeš dřevěný křížek pod košilí.", react: "ward", bridge: "Nic se nestane, a to tě uklidní míň, než čekáš." },
    ],
  },
  {
    pick: "origin",
    /* kraj = kultura Machalska; původ = proč jsi tady / jestli tě ve vsi znají */
    text: "Pijan zvedne hlavu ze stolu a podívá se na tebe, jako by tě viděl poprvé.\n„Jak ses sem vlastně dostal? Sem se chodívá za pivem.“",
    choices: [
      { say: "Přišel jsem vyrovnat účty.", hint: "dlužník", origin: "debtor" },
      { act: "Ukážeš ruce plné mozolů a spálenin od výhně.", hint: "učeň kováře", origin: "apprentice" },
      { say: "Hlídal jsem bránu. Už ne.", hint: "bývalý strážný", origin: "watchman" },
      { say: "Jen procházím. Zítra zas pokračuju dál.", hint: "poutník", origin: "wayfarer" },
      { act: "Stáhneš si kapuci hlouběji.", origin: "exile" },
      { say: "Ty mě nepoznáváš? Vždyť jsem odsud.", hint: "rodák", origin: "native" },
    ],
  },
];

/** Zvýraznění klíčových slov v logu */
const hl = (t) => `<span class="hl">${nbspCzech(t)}</span>`;

/**
 * České typo: nezalamovat jednopísmenné / krátké předložky a spojky
 * (a, i, k, o, s, u, v, z, na, do, …) - orphan prevention.
 * HTML tagy nechá být (pracuje po segmentech mimo <>).
 */
function nbspCzech(input, opts = {}) {
  if (!input || typeof input !== "string") return input;
  if (opts.tail) input = input.replace(/ ([^ <>]+)$/, "\u00A0$1"); /* poslední slovo nikdy samo na řádku */
  /* krátká slova (předložky, spojky, "se", "je"...) se vážou k NÁSLEDUJÍCÍMU slovu: nikdy nezůstanou na konci řádku */
  const short =
    "a|i|k|o|s|u|v|z|na|ke|ve|do|od|po|za|se|si|by|že|až|či|už|co|to|tu|ze|ani|ale|jak|jen|pro|bez|pod|nad|při|nebo|je|jsi|jsem|mu|ho|ti|mi|tě|ať|já|my|ty|on|ona|jde|má";
  const re = new RegExp(`(?<=^|[\\s\\u00A0>])(${short}) (?=\\S)`, "gi");
  const fix = (text) => text.replace(re, "$1\u00A0");
  return input.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, text) => (tag ? tag : fix(text)));
}

const TOWN_PROSE = nbspCzech(
  `Nacházíš se v centru města ${hl("Machala")}. Na náměstí voní čerstvý chléb, od studny se nese smích a někde v průjezdu štěká pes. Nad výhní žhne štít, u léčitele voní byliny. Město žije svým tempem.`
);

/** Akční tlačítko: název + krátká věta (story = větná volba) */
function actionBtn({
  title,
  hint,
  act,
  attrs = "",
  cls = "",
  disabled = false,
  type = "ghost",
  story = false,
}) {
  const kind =
    type === "primary"
      ? "btn-primary"
      : type === "back"
        ? "btn-back"
        : type === "ghost"
          ? "btn-ghost"
          : "";
  const storyCls = story ? "btn-story" : "";
  const hintHtml = hint
    ? story
      ? `<span class="btn-hint">(${hint})</span>`
      : `<span class="btn-hint">${hint}</span>`
    : "";
  return `<button type="button" class="btn btn-action ${kind} ${storyCls} ${cls}" ${act ? `data-act="${act}"` : ""} ${attrs} ${disabled ? "disabled" : ""}>
    <strong>${nbspCzech(title)}</strong>
    ${hintHtml ? hintHtml.replace(/>([^<]+)</, (_, t) => `>${nbspCzech(t)}<`) : ""}
  </button>`;
}

/* jednotná provizorní sada ručních SVG (resources/locations/placeholder/); starší AI obrázky jsou v resources/legacy/ */
const BG_DIR = "../resources/locations/placeholder/";
const BG = Object.fromEntries(
  ["city", "healer", "smith", "bank", "forest", "plains", "hills", "mountains", "road", "village", "chapel", "tavern", "townhall", "gate", "market", "camp", "default", "landing"].map((k) => [k, `${BG_DIR}${k}.svg`])
);

/* nepřátelé: provizorní SVG podle id, jinak vlk */
const enemyImg = (id) => `../resources/enemies/placeholder/${["wolf", "boar", "bandit", "brigand"].includes(id) ? id : "wolf"}.svg`;

/* Mini-mapa - data v js/data/map.js (docs/reference/map.md) */
const MAP_MAX = LOM.MAP_MAX;
const TERRAIN_CS = LOM.TERRAIN_CS;
const TERRAIN_BG = LOM.TERRAIN_BG;
const terrainAt = LOM.terrainAt;
const cellLabel = LOM.cellLabel;

function mapKey(x, y) {
  return `${x},${y}`;
}

function discoverCell(x, y) {
  state.discovered[mapKey(x, y)] = true;
}

function isInTownZone(x = state.mapX, y = state.mapY) {
  return terrainAt(x, y) === "town";
}

const PLACE = {
  healer: {
    title: "Léčitelka",
    npc: "Lidmila",
    line: `Nabízí se tedy zajít k ${hl("Lidmile")}, až budeš potřebovat záplatu`,
    hint: "navštívit léčitelku",
    bg: "healer",
    /* scéna (full) + greeting (foe vpravo) - ne jedna smíchaná věta. Text smí být pole variant (viz variants.js). */
    prose: [
      `Voní bylinky. V rohu suší snopy, na stole leží čisté obvazy. Na polici visí obrázek paní z pohraničí.`,
      `Ve vzduchu visí kouř z kadidla. Na polici cinkají lahvičky; Lidmila právě drtila kořeny.`,
      `U okna se suší svazky heřmánku a v hrnci něco tiše bublá. Obrázek paní z pohraničí se dívá z police.`,
    ],
    greeting: [`„Posaď se. Kde to bolí?“`, `„Ukaž. A klidně to řekni dvakrát.“`, `„Zase ty? Ruce mám od bylin, ale poslouchám.“`],
    /* priority: heal → protijed → buffy */
    services: [
      { id: "heal", name: "Ošetření", descHtml: () => statChipBtn("hp", null), price: 50 },
      { id: "antidote", name: "Protijed", desc: "Proti jedu", price: 40 },
      { id: "str", name: "Požehnání síly", descHtml: () => `+5 ${statChipBtn("str", null)}`, price: 100 },
      { id: "vit", name: "Požehnání výdrže", descHtml: () => `+5 ${statChipBtn("vit", null)}`, price: 100 },
    ],
  },
  smith: {
    title: "Zbrojíř",
    npc: "Karel",
    line: `A co teprve ${hl("Karel")} u kovadliny, když ti chybí ostří?`,
    hint: "navštívit zbrojíře",
    bg: "smith",
    prose: `Žár a kov. Na stojanu chladne nedokončená čepel. Karel tiskne nos k železu, když přemýšlí.`,
    greeting: [`„Na co máš?“`, `„Ocel drží, lidé méně. Co potřebuješ?“`, `„Zdař Bůh. Co do výhně?“`],
    /* priority: prodat → koupit → opravit */
    services: [
      { id: "sell_gear", name: "Prodat věc", desc: "Stub · výkup", price: 0 },
      { id: "buy_wood", name: "Dřevěný meč", descHtml: () => `${statChipBtn("atk", "+5")}`, price: 50 },
      { id: "buy_iron", name: "Železný meč", descHtml: () => `${statChipBtn("atk", "+8")}`, price: 150 },
      { id: "buy_long", name: "Dlouhý meč", descHtml: () => `${statChipBtn("atk", "+10")}`, price: 220 },
      { id: "repair", name: "Oprava", desc: "Condition", price: 30 },
    ],
  },
  bank: {
    title: "Zástava",
    npc: "Gertruda",
    line: `Do ${hl("Zástavy")} si můžeš uložit zlato; trezor drží víc než měšec`,
    hint: "otevřít účet",
    bg: "bank",
    prose: `Ticho trezoru. Tlusté dveře, zápach vosku a kovu. Na pultě leží zástavní lístky s lhůtami.`,
    greeting: [`„Uložit, nebo vybrat?“`, `„Vše podle smlouvy. Smlouva ovšem také.“`, `„Lhůta běží. Co potřebujete?“`],
    /* priority: uložit → vybrat */
    services: [
      { id: "dep_all", name: "Uložit vše", desc: "Do Zástavy", price: 0 },
      { id: "dep_50", name: "Uložit", descHtml: () => goldAmt(50), price: 0 },
      { id: "wd_50", name: "Vybrat", descHtml: () => goldAmt(50), price: 0 },
      { id: "wd_all", name: "Vybrat vše", desc: "Ze Zástavy", price: 0 },
    ],
  },
  tavern: {
    title: "Hostinec U Přívozu",
    npc: "Svatava z Přívozu",
    line: `U ${hl("Svatavy")} teče pěna a drby, když chceš chvíli vydechnout`,
    hint: "vejít do hostince",
    bg: "tavern",
    role: "hostinská",
    prose: [
      `Smích a pěna. Mokré stoly, kočka na sudu. Dudák hraje, dokud mu někdo platí, a pak ještě chvíli.`,
      `Krb praská, u stolu se hádají o kostky. U kamen někdo zpívá o dvě tóny vedle.`,
      `Je tu hluk, kouř a vůně pečeně. Svatava počítá drobné, jako by to byl zvyk.`,
    ],
    greeting: [`„Sedněte, ať neděláte průvan. Platit budete tak jako tak.“`, `„Pivo, nebo drb?“`, `„Zase ty. Sedni.“`],
    /* další osoby na místě (hostitel `npc` je vždy první); when: { phases, chance } */
    people: [
      {
        id: "regular",
        name: "Štamgast",
        generated: true,
        role: "u okna",
        when: { phases: ["evening", "night"] },
        greeting: [`„Sedni si, nekouše. Pivo ano, já ne.“`, `„Hm? Aha. Tak si přisedni.“`],
        bye: [`„Hm.“`, `„Však se uvidíme. Já tu budu.“`],
        talk: [
          { id: "r_beer", title: `Zeptat se na ${hl("pivo")}`, hint: "znalec", ask: `„Jak je tu pivo?“`, ans: [`„Dá se pít. Hlavně pomalu a hlavně dlouho.“`, `„Chutná po minulosti. Po cizí.“`] },
          { id: "r_seat", title: `Zeptat se na ${hl("židli")}`, hint: "jeho místo", ask: `„Sedíš tu každý večer?“`, ans: `„Třicet let. Ta židle už zná můj tvar líp než manželka.“` },
          { id: "r_hills", title: `Zeptat se na ${hl("kopce")}`, hint: "drobná fáma bez dopadu", ask: `„Neslyšel jsi něco z kopců?“`, ans: `„Prý tam někdo viděl světýlko. Nebo svatojánskou mušku. Nebo opilce.“` },
        ],
      },
    ],
    /* priority: spánek → pití → drby → hra */
    services: [
      { id: "rest", name: "Spát", descHtml: () => `Heal · ${goldAmt(20)}`, price: 20 },
      {
        id: "ale",
        name: "Pivo",
        descHtml: () => `+${statChipBtn("str", null)} −${statChipBtn("dex", null)}`,
        price: 8,
      },
      { id: "rumor", name: "Drb", descHtml: () => goldAmt(5), price: 5 },
      { id: "inspect_cask", name: "Prohlédnout sud ve sklepě", desc: "prasklé dno · stopa", price: 0, when: () => kauzaStarted() && !!kauzaState().claims.c1 },
      { id: "stash", name: "Úschovna", descHtml: () => `${state.stash.items.length}/${LOM.Stash.TUNE.stashCap} věcí · ${goldAmt(LOM.Stash.TUNE.stashFeePerDay)}/den`, price: 0 },
      { id: "dice", name: "Kostky", desc: "Hra", price: 0 },
    ],
  },
  gate: {
    title: "Městská brána",
    npc: "Petr",
    line: `U ${hl("brány")} postává Petr a hlídá, co už dávno nikdo nechce ukrást`,
    hint: "promluvit se strážným",
    bg: "gate",
    prose: [
      `Těžká brána, bedna na sezení. Strážný Petr tiskne oštěp, jako by ho někdo chtěl vzít.`,
      `Brána vrže ve větru. Petr stojí zpříma. U soklu mostu stojí soška ochránce od vody, ruka se k ní sama táhne.`,
      `Prach, stín věže a bedna u zdi. Petr si rovná čapku. „Hlídám bránu. Hlídám bránu.“`,
    ],
    greeting: [`„Hlídám bránu. Hlídám bránu. Co chceš?“`, `„Jméno. Ne, počkej, to nechci. Co chceš?“`, `„Kdo tam? Aha. Ty.“`],
    services: [],
  },
  townhall: {
    title: "Radnice",
    npc: "Gustav",
    line: `Na ${hl("radnici")} sedí Gustav za stohem listin a razítek`,
    hint: "úřad, listiny, dražba",
    bg: "townhall",
    prose: `Chodba voní inkoustem a prachem. Za okénkem se hromadí listiny, nad nimi razítko jako zbraň.`,
    greeting: [`„Číslo? Ne, počkejte, nemáme čísla. Co potřebujete?“`, `„Dotaz? Odpovím na otázku, kterou jste položil.“`, `„Formulář máme. Na odpovědi.“`],
    services: [
      { id: "lookup_priest", name: "Nahlédnout do farní knihy", desc: "Poplatek za vzduch v knihách", price: 5, when: () => kauzaStarted() },
      { id: "lookup_deed", name: "Nahlédnout do kupní listiny", desc: "Prodej zvonu a vklady", price: 5, when: () => kauzaStarted() },
      { id: "pay_debt", name: "Doplatit farnosti za střechu", descHtml: () => `Zvon se vrátí z hutí`, price: 150, when: () => kauzaStarted() && !kauzaState().verdict },
    ],
  },
  market: {
    title: "Tržiště",
    npc: "Hanuš z Brodu",
    line: `Na ${hl("tržišti")} Hanuš mává a smlouvá, dokud máš co nabídnout`,
    hint: "projít stánky",
    bg: "market",
    prose: `Stánky a hluk. Vůně chleba a ryb se mísí s křikem cen.`,
    greeting: [`„Naposledy! Jenom pro vás! A pro příští zákazníky taky naposledy.“`, `„Levně! Dnes, a zítra taky.“`, `„Vzorek všeho. A nic právě teď.“`],
    /* priority: prodat → jídlo → potion */
    services: [
      { id: "sell_misc", name: "Prodat", descHtml: () => `${goldAmt(2)}`, price: 0 },
      { id: "bread", name: "Chléb", desc: "Heal", price: 5 },
      { id: "ration", name: "Suchý chléb", desc: "Do batohu (na cestu, do úkolů)", price: 5 },
      { id: "potion", name: "Odvar", desc: "Potion", price: 20 },
      { id: "shovel", name: "Lopata", desc: "Zakopat věci mimo město", price: 15 },
    ],
  },
};

/** Věty při vstupu/odchodu - jen dialog (L/R barvy = kdo mluví, bez „Jméno:“). you/foe smí být pole variant. */
const PLACE_BEATS = {
  healer: {
    openTalk: {
      you: `„Lidmilo, můžu se na chvíli zeptat?“`,
      foe: [`„Povídej. Jen nesahej na lahvičky.“`, `„Poslouchám. Ruce mám zrovna od bylin.“`, `„Ptej se. Léky počkají.“`],
    },
    openServices: {
      you: `„Ukaž mi, co nabízíš.“`,
      foe: `„Vyber si. Ošetření první, platba i v naturáliích.“`,
    },
    closeServices: {
      you: `„Zatím nic, díky.“`,
      foe: `„Jak chceš. Jsem tu.“`,
    },
    closeTalk: {
      you: `„Díky, Lidmilo. Zatím.“`,
      foe: `„Když něco, stačí říct.“`,
    },
  },
  smith: {
    openTalk: {
      you: `„Karle, mám otázku.“`,
      foe: `„Mluv. Ocel drží.“`,
    },
    openServices: {
      you: `„Co máš na prodej a opravu?“`,
      foe: `„Prodej, nákup, oprava? Co dřív?“`,
    },
    closeServices: {
      you: `„Ještě se rozmyslím.“`,
      foe: `„Až se rozhodneš, zaklepu.“`,
    },
    closeTalk: {
      you: `„Díky, Karle.“`,
      foe: `„Jak chceš.“`,
    },
  },
  bank: {
    openTalk: {
      you: `„Můžu se zeptat na trezor?“`,
      foe: `„Ano. Vše podle smlouvy.“`,
    },
    openServices: {
      you: `„Chci pracovat s účtem.“`,
      foe: `„Uložit, nebo vybrat? Lhůta běží.“`,
    },
    closeServices: {
      you: `„Zatím ne.“`,
      foe: `„Trezor počká. Smlouva také.“`,
    },
    closeTalk: {
      you: `„Díky.“`,
      foe: `„Jak si přeješ.“`,
    },
  },
  tavern: {
    openTalk: {
      you: [`„Svatavo, co je nového?“`, `„Co se povídá, Svatavo?“`],
      foe: [`„Sedněte a poslouchejte.“`, `„Přisuňte si židli, ať neděláte průvan.“`, `„Nového? Jen staré, ale s pěnou.“`],
    },
    openServices: {
      you: `„Co tu jde koupit?“`,
      foe: `„Spánek, pivo, drby? Co dřív?“`,
    },
    closeServices: {
      you: `„Ještě ne.“`,
      foe: `„Když budete chtít, zamávám.“`,
    },
    closeTalk: {
      you: `„Díky, Svatavo.“`,
      foe: `„Jak chcete.“`,
    },
  },
  gate: {
    openTalk: { you: `„Petře, máš chvilku?“`, foe: `„Hlídám bránu. Hlídám bránu.“` },
    closeTalk: { you: `„Tak já půjdu.“`, foe: `„Jdi. Jdi.“` },
  },
  townhall: {
    openTalk: { you: `„Dobrý den, mohl bych se zeptat?“`, foe: `„Dotaz? Formulář máme jen na odpovědi.“` },
    openServices: { you: `„Potřeboval bych nahlédnout do listin.“`, foe: `„Nahlédnutí je zpoplatněno. Vzduch v knihách není zadarmo.“` },
    closeServices: { you: `„Zatím nic, díky.“`, foe: `„Listiny počkají. Listiny vždycky počkají.“` },
    closeTalk: { you: `„Děkuju.“`, foe: `„Není zač. Ani razítko.“` },
  },
  market: {
    openTalk: {
      you: `„Hanuši, mám otázku.“`,
      foe: `„Naposledy! No?“`,
    },
    openServices: {
      you: `„Ukaž zboží.“`,
      foe: `„Prodej, chléb, odvar, jenom pro vás!“`,
    },
    closeServices: {
      you: `„Ještě se podívám jinde.“`,
      foe: `„Až se rozhodneš, volej. Naposledy.“`,
    },
    closeTalk: {
      you: `„Díky, Hanuši.“`,
      foe: `„Jak chceš.“`,
    },
  },
};

const RUMORS = [
  "Solník z dolů: v horách žíla soli, ale vyhnali ho vlci.",
  "Starosta prý má tunel z radnice do Zástavy.",
  "V noci z kanálů lezou krysy s červenýma očima.",
  "Hostinská ředí pivo vodou z řeky.",
];

/* katalog předmětů: js/data/items.js (sloty: armor hlava→obuv + hold + jewelry; weight = nosnost batohu) */
const INVENTORY = LOM.INVENTORY;

const ITEM_BY = Object.fromEntries(INVENTORY.map((i) => [i.id, i]));
const BAG_SLOTS = 16;
const BAG_WEIGHT_MAX = 28;

function itemWeight(id) {
  return ITEM_BY[id]?.weight ?? 1;
}

function makeStartBag() {
  const slots = Array(BAG_SLOTS).fill(null);
  /* rozumný začátek (~5 kg z 28): je s čím hrát a zbývá místo na kořist i zvon */
  const start = ["potion", "potion", "ration", "daisy", "foresight", "gloves"];
  start.forEach((id, i) => {
    if (i < BAG_SLOTS) slots[i] = id;
  });
  return slots;
}

function bagWeight() {
  return state.bag.reduce((sum, id) => sum + (id ? itemWeight(id) : 0), 0);
}

function bagFreeIndex() {
  return state.bag.findIndex((x) => x == null);
}

function bagCanFit(id) {
  if (bagFreeIndex() < 0) return false;
  return bagWeight() + itemWeight(id) <= BAG_WEIGHT_MAX + 1e-6;
}

function bagPut(id, atIndex) {
  if (atIndex != null && atIndex >= 0 && atIndex < BAG_SLOTS) {
    if (state.bag[atIndex] != null) return false;
    if (bagWeight() + itemWeight(id) > BAG_WEIGHT_MAX + 1e-6) return false;
    state.bag[atIndex] = id;
    return true;
  }
  if (!bagCanFit(id)) return false;
  const i = bagFreeIndex();
  state.bag[i] = id;
  return true;
}

function bagSwap(from, to) {
  if (from === to || from < 0 || to < 0 || from >= BAG_SLOTS || to >= BAG_SLOTS) return;
  const a = state.bag[from];
  state.bag[from] = state.bag[to];
  state.bag[to] = a;
}

const EQUIP_SLOTS = [
  "head",
  "shoulders",
  "neck",
  "body",
  "hands",
  "wrists",
  "legs",
  "feet",
  "weapon",
  "shield",
  "trinket",
];

/** Verze prototyupu - bump při smysluplném releasu; © rok = aktuální. */
const APP_VERSION = "0.1.1";
const APP_YEAR = new Date().getFullYear();

/**
 * Client prefs - localStorage (device).
 * Server/User prefs až když účet musí syncovat napříč zařízeními.
 * Klíč: lom.prefs.
 */
const PREFS_KEY = "lom.prefs";
function defaultPrefs() {
  return { music: 60, sfx: 80, muted: false, hotkeys: true, kodex: true, lang: "cs" };
}
function loadPrefs() {
  const fallback = defaultPrefs();
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    const hotkeys = p.hotkeys !== false;
    return {
      music: Math.min(100, Math.max(0, Number(p.music) ?? 60)),
      sfx: Math.min(100, Math.max(0, Number(p.sfx) ?? 80)),
      muted: !!p.muted,
      hotkeys,
      kodex: p.kodex !== false,
      lang: p.lang === "en" ? "en" : "cs",
    };
  } catch {
    return fallback;
  }
}
function savePrefs() {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        music: state.audio.music,
        sfx: state.audio.sfx,
        muted: state.audio.muted,
        hotkeys: !!state.prefs.hotkeys,
        kodex: state.prefs.kodex !== false,
        lang: state.prefs.lang || "cs",
      })
    );
  } catch {
    /* private mode / quota - ignore */
  }
}
function saveAudioPrefs() {
  savePrefs();
}
function coarsePointer() {
  return window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches;
}
function showHotkeyUi() {
  return !!state.prefs?.hotkeys && !coarsePointer();
}
function combatHint(key, text) {
  if (!showHotkeyUi()) return text;
  return `${key} · ${text}`;
}
function dockFooterHtml() {
  const kbd = showHotkeyUi();
  const tip = (label, n) => (kbd ? `${label} (klávesa ${n})` : label);
  /* kbd vždy v DOM (is-off = visibility) - footer nemění výšku */
  const k = (n) => `<kbd class="${kbd ? "" : "is-off"}" aria-hidden="${kbd ? "false" : "true"}">${n}</kbd>`;
  return `
    <button type="button" class="dock-ico" data-act="open-char" title="${tip("Postava", 1)}" aria-label="Postava"><span aria-hidden="true">👤</span><em>Postava</em>${k(1)}</button>
    <button type="button" class="dock-ico" data-act="open-inv" title="${tip("Inventář", 2)}" aria-label="Inventář"><span aria-hidden="true">🎒</span><em>Inventář</em>${k(2)}</button>
    <button type="button" class="dock-ico${state.notebookNew ? " has-dot" : ""}" data-act="open-quests" title="${tip("Úkoly", 3)}" aria-label="Úkoly${state.notebookNew ? " (nová fáma v Zápisníku)" : ""}"><span aria-hidden="true">📜</span><em>Úkoly</em>${k(3)}</button>
    <button type="button" class="dock-ico" data-act="open-map" title="${tip("Mapa", 4)}" aria-label="Mapa"><span aria-hidden="true">🗺</span><em>Mapa</em>${k(4)}</button>
    <button type="button" class="dock-ico" data-act="open-settings" title="${tip("Nastavení", 5)}" aria-label="Nastavení"><span aria-hidden="true">⚙</span><em>Nastavení</em>${k(5)}</button>`;
}

const makeState = () => ({
  screen: "landing",
  auth: "register",
  originStep: 0,
  picks: { class: "mercenary", race: "local", origin: null },
  name: "",
  gender: "m", /* m | f; kostka jmen a pozdější skloňování */
  literacy: 0, /* 0 neumí / 1 slabě / 2 plynně (písař start 2) */
  gold: 80,
  bank: 20,
  place: null,
  placeThread: [], // konverzace na místě - append, ne přepis
  panelTab: "quests", // panel Úkoly: quests | notebook
  notebookNew: false, // přibyla fáma od posledního otevření Zápisníku (puntík)
  kzReply: null, // čeká odpověď hráče na právě slyšenou fámu: { cid, ctx: "place"|"cell", place?, at? }
  placeTalkPath: [], // vnořený dialog - stack id uzlů
  placeTalkDone: {}, // placeKey → { [askId]: true }
  placeView: "hub", // hub | talk | services - o 1 úroveň zpět
  invDiscardIdx: null,
  equipPickSlot: null, // Postava: otevřený slot picker
  equipConfirm: null, // { itemId } - potvrzení změny výzbroje
  mode: "town", // town | place | exits
  mapX: 3,
  mapY: 3,
  discovered: { "3,3": true },
  log: TOWN_PROSE,
  combat: null,
  /* armor + hold + jewelry (lean WoW); batoh = pevný grid */
  bag: makeStartBag(),
  equipped: {
    head: "cap",
    shoulders: null,
    neck: null,
    body: "tunic",
    hands: null,
    wrists: null,
    legs: null,
    feet: "boots",
    weapon: "ladle",
    shield: "shield",
    trinket: null,
  },
  level: 1,
  xp: 12,
  xpNext: 50,
  guest: false,
  originReached: 0,
  prologDone: { class: false, race: false, origin: false },
  prologBridges: {} /* krok prologu → věta, kterou navazuje další krok */,
  prologStory: false /* postava vznikla průchodem prologu (Postava = shrnutí a jméno), ne ručním výběrem */,
  origin: null,
  standing: {},
  freeHealAfterDeath: false,
  prologReact: null,
  prologReply: null,
  prologCheek: 0 /* kolikrát hráč v prologu odseknul; zatím jen počítadlo drzosti */,
  flashGear: false,
  flashStats: false,
  flashKeys: [], /* jen změněné attributy při flash */
  confirmDelete: false,
  deleteTyped: "",
  /* výdrž na mapě - odděleně od combat resource */
  travel: { energy: 14, energyMax: 14 },
  audio: (() => {
    const p = loadPrefs();
    return { music: p.music, sfx: p.sfx, muted: p.muted };
  })(),
  prefs: (() => {
    const p = loadPrefs();
    return { hotkeys: p.hotkeys, lang: p.lang };
  })(),
  lootLeaveConfirm: false,
  /* nested panely: klik mimo / × = o úroveň výš (ne rovnou zavřít root) */
  panelStack: [],
  /* stub - ikony v kontextu; real clock / weather later */
  weather: { label: "jasno", icon: "🌤" }, // maketa
  clock: LOM.newClock(),
  hp: null, // null = plné HP (trvalé HP mezi boji)
  seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0,
  steps: 0, // počítadlo hodů (obcházení)
  spots: null, // pevná místa setkání (LOM.buildSpots); staví se líně ze semínka
  encounter: null, // čekající setkání { enemyId, seed, spotId }
  corpseSkip: null, // "x,y" těla, které jsi vědomě nechal ležet
  quests: LOM.Quests.newLog(), // stav questů (LOM.QUESTS)
  kauza: null, // stav kauzy Zvon (LOM.Kauza); vzniká líně ze seedu
  cellThread: [], // dialog na políčku mapy (kaple, tábor)
  prevX: null,
  prevY: null,
  corpses: [], // zůstavené věci po smrti
  stash: LOM.Stash.newStash(), // úschovna v hospodě (js/systems/stash.js)
  piles: [], // odložené (open) a zakopané (buried) hromádky na mapě
  pileSeq: 0,
  cellMenu: null, // null | drop | bury | pile - výběr věci na políčku mapy
  visits: {}, // placeKey → kolikrát jsi tam vešel (varianty vět)
  vc: {}, // klíč věty → kolikrát už zazněla (varianty vět)
  placeWho: "host", // s kým na místě mluvíš (id osoby z PLACE.people, "host" = npc)
  /* kolikrát jsi porazil daný druh (zkušenost zlepšuje čtení záměru) a drobné příznaky voleb */
  kills: {},
  flags: {},
  /* dev přepínače (viz LOM.TOGGLES) */
  dev: { reveal: true },
  activeScenario: null,
});
const state = makeState();

/* ===== Uložená hra (localStorage) =====
 * Pravidla a formát: js/systems/save.js (LOM.Save). Tady jen I/O a napojení na stav.
 * Ukládá se jen ve městě/na mapě (screen "town"), nikdy v boji, na úvodu a v dev scénách. */
const SAVE_DEBOUNCE_MS = 300;
let saveTimer = null;

/** Platné uložení z localStorage ({ state }) nebo null (nic / poškozené / jiná verze). */
function readSave() {
  try {
    const raw = localStorage.getItem(LOM.Save.STORAGE_KEY);
    if (!raw) return null;
    const r = LOM.Save.deserialize(raw);
    return r.ok ? r : null;
  } catch (_) {
    return null;
  }
}

function saveGame() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (state.screen !== "town" || state.activeScenario || state.noSave) return;
  try {
    localStorage.setItem(LOM.Save.STORAGE_KEY, LOM.Save.serialize(state));
  } catch (_) {
    /* plné úložiště / zakázané cookies: hra běží dál bez ukládání */
  }
}

function scheduleSave() {
  if (saveTimer || state.screen !== "town" || state.activeScenario || state.noSave) return;
  saveTimer = setTimeout(saveGame, SAVE_DEBOUNCE_MS);
}

function deleteSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.removeItem(LOM.Save.STORAGE_KEY);
  } catch (_) {}
}

window.addEventListener("pagehide", saveGame);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGame();
});

/** Nový prázdný stav (audio, prefs a dev zůstávají), volitelně s přenesenými poli. */
function resetState(carry = {}) {
  const keep = { audio: state.audio, prefs: state.prefs, dev: state.dev, ...carry };
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, makeState(), keep);
}

/** Načte uložení do `state` a vstoupí do hry; boj se neobnovuje (reload = konec boje). */
function continueGame() {
  const r = readSave();
  if (!r) {
    toast("Uloženou hru se nepodařilo načíst.");
    syncContinue();
    return;
  }
  const d = r.state;
  d.bag = d.bag.map((id) => (id && ITEM_BY[id] ? id : null));
  EQUIP_SLOTS.forEach((k) => {
    if (d.equipped[k] && !ITEM_BY[d.equipped[k]]) d.equipped[k] = null;
  });
  if (d.place && !PLACE[d.place]) d.place = null;
  if (!d.place) d.mode = d.mode === "exits" ? "exits" : "town";
  d.screen = "town";
  d.placeView = "hub";
  resetState(d);
  state.combat = null;
  clearUiScrollMem();
  closeLootModal();
  openPanel(null);
  state.log = state.mode === "place" && state.place ? placeProse(state.place) : TOWN_PROSE;
  setScreen("town");
}

/** Úvod: tlačítko Pokračovat s jménem a úrovní, je-li platné uložení. */
function syncContinue() {
  const box = $("auth-continue");
  if (!box) return;
  const r = state.screen === "landing" ? readSave() : null;
  box.classList.toggle("hidden", !r);
  if (!r) {
    box.innerHTML = "";
    return;
  }
  const d = r.state;
  box.innerHTML = `<button type="button" class="btn btn-primary wide" data-act="continue-game">Pokračovat</button>
    <span class="tip">${escapeHtml(d.name || "Poutník")} · úroveň ${d.level} · ${(d.prologDone?.class && CLASS_LABEL[d.picks.class]) || "Povaleč"}</span>`;
}

const FLOW_SEGS = ORIGIN_STEPS.length + 1; /* prolog kroky + Původ */

function flowSegsHtml(activeIdx) {
  return Array.from({ length: FLOW_SEGS }, (_, i) => {
    const cls = `progress-seg${i === activeIdx ? " active" : ""}${i < activeIdx ? " done" : ""}`;
    return `<span class="${cls}" aria-hidden="true"></span>`;
  }).join("");
}

function $(id) {
  return document.getElementById(id);
}

/** DEV lišta = overlay; měříme --dev-pad (nekrátí viewport) */
function syncDevPad() {
  const bar = document.querySelector(".proto-bar");
  const root = document.documentElement;
  if (!document.body.classList.contains("has-dev") || !bar || bar.hidden) {
    root.style.setProperty("--dev-pad", "0px");
    return;
  }
  root.style.setProperty("--dev-pad", `${bar.offsetHeight}px`);
}

/** Veřejný export přepíše na true: ukázka končí po prologu (bez landingu a bez pokračování do hry). */
const PUBLIC_DEMO = true;

/** Ráno po prologu: do seníku jsme se večer nějak doplazili (ne Svatavina zásluha), pak následek volby u zvonu. */
const MORNING_BASE = {
  native: "Domů ses večer nějak doplazil, i když si nepamatuješ jak.",
  default: "Probudíš se v seníku za krčmou. Doplazil ses tam večer nějak sám, víc si nepamatuješ.",
};
const MORNING_REACT = {
  fight: " Na botách máš zaschlé bláto od kaple, kde nic nebylo.",
  hide: " Zvon se už neozval, nebo sis ho nezapamatoval.",
  ward: " Křížek držíš pořád v dlani.",
};
const MORNING_NOORDER = "Šel ses vyspat do seníku za krčmou, když už ses nic neobjednal.";
const prologMorning = () =>
  (state.prologDone.class ? MORNING_BASE[state.picks.origin] || MORNING_BASE.default : MORNING_NOORDER) + (MORNING_REACT[state.prologReact] || "");

/** Konec ukázky: ráno po prologu a tečka, hra dál nepokračuje. */
function openDemoEnd(text) {
  const el = document.createElement("aside");
  el.className = "loot-overlay";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Konec ukázky");
  el.innerHTML = `<div class="loot-sheet confirm-sheet">
      <strong>Ráno</strong>
      <p>${nbspCzech(text)}</p>
      <p class="muted">Tím ukázka prologu končí. Hra dál pokračuje jen ve vývojové verzi.</p>
      <div class="loot-actions"><button type="button" class="btn btn-primary" data-act="demo-restart">Zkusit prolog znovu</button></div>
    </div>`;
  document.body.appendChild(el);
}

const DEV_BAR_KEY = "lom.devBarCollapsed";
const DEV_VIS_KEY = "lom.dev";
const DEV_KNOB_SEC = {
  class: "postava",
  race: "postava",
  level: "postava",
  hp: "postava",
  gold: "postava",
  bag: "postava",
  view: "svet",
  at: "svet",
  phase: "svet",
  spots: "svet",
  quests: "svet",
  corpse: "svet",
  variant: "svet",
  enemy: "boj",
  enemyHp: "boj",
  encounter: "boj",
};

function loadDevBarPrefs() {
  const out = { collapsed: true, sections: { postava: false, svet: false, boj: false, ladeni: false, stav: true } };
  try {
    const raw = localStorage.getItem(DEV_BAR_KEY);
    if (raw === "1" || raw === "0") {
      out.collapsed = raw === "1";
      return out;
    }
    if (raw) {
      const j = JSON.parse(raw);
      if (typeof j.collapsed === "boolean") out.collapsed = j.collapsed;
      if (j.sections && typeof j.sections === "object") {
        for (const k of Object.keys(out.sections)) if (typeof j.sections[k] === "boolean") out.sections[k] = j.sections[k];
      }
    }
  } catch (_) {}
  return out;
}

function saveDevBarPrefs(prefs) {
  try {
    localStorage.setItem(DEV_BAR_KEY, JSON.stringify(prefs));
  } catch (_) {}
}

/** file: / localhost výchozí; ?dev=0 skryje, ?dev=1 ukáže; lom.dev přepíná Ctrl+Shift+D. */
function shouldShowDevBar() {
  try {
    const q = new URLSearchParams(location.search).get("dev");
    if (q === "0") return false;
    if (q === "1") return true;
    const stored = localStorage.getItem(DEV_VIS_KEY);
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch (_) {}
  const host = location.hostname;
  return location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function applyDevVisibility(show) {
  const bar = document.querySelector(".proto-bar");
  document.body.classList.toggle("has-dev", !!show);
  if (bar) {
    bar.hidden = !show;
    bar.toggleAttribute("hidden", !show);
  }
  syncDevPad();
}

function initDevBar() {
  const bar = document.querySelector(".proto-bar");
  const detailBtn = $("dev-detail");
  const panel = $("dev-detail-panel");
  if (!bar || !detailBtn || !panel) return;

  let prefs = loadDevBarPrefs();
  const applyCollapsed = () => {
    bar.classList.toggle("is-collapsed", prefs.collapsed);
    panel.hidden = prefs.collapsed;
    detailBtn.setAttribute("aria-expanded", String(!prefs.collapsed));
    syncDevPad();
  };
  const applySections = () => {
    bar.querySelectorAll("details.dev-sec[data-sec]").forEach((el) => {
      const id = el.dataset.sec;
      el.open = !!prefs.sections[id];
    });
  };

  detailBtn.addEventListener("click", () => {
    prefs.collapsed = !prefs.collapsed;
    saveDevBarPrefs(prefs);
    applyCollapsed();
  });
  bar.querySelectorAll("details.dev-sec[data-sec]").forEach((el) => {
    el.addEventListener("toggle", () => {
      prefs.sections[el.dataset.sec] = el.open;
      saveDevBarPrefs(prefs);
      syncDevPad();
    });
  });

  applyDevVisibility(shouldShowDevBar());
  applySections();
  applyCollapsed();
  if (window.ResizeObserver) new ResizeObserver(syncDevPad).observe(bar);

  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d"))) return;
    if (e.target.matches?.("input, textarea, select")) return;
    e.preventDefault();
    const next = !document.body.classList.contains("has-dev");
    try {
      localStorage.setItem(DEV_VIS_KEY, next ? "1" : "0");
    } catch (_) {}
    applyDevVisibility(next);
  });
}

function setGameBg(key) {
  const url = BG[key] || BG.default;
  document.querySelectorAll(".game-screen .landing-bg").forEach((el) => {
    el.style.backgroundImage = `linear-gradient(90deg, rgba(10,6,4,0.62), rgba(10,6,4,0.22) 42%, rgba(10,6,4,0.58)), url("${url}")`;
  });
}

const ENEMY_INTRO = {
  wolf: "Les zhoustne. Z křoví vystoupí vlk.",
  boar: "Křoví praská, z podrostu vyrazí divočák.",
  bandit: "Na cestě se zvedne bandita a opře se o kyj. „Peníze, nebo život.“",
  brigand: "Zpoza kamenů vystoupí zbojník. Nespěchá. Ví, že ty ano.",
};

function bagCount(id) {
  return state.bag.filter((x) => x === id).length;
}

function bagConsume(id) {
  const i = state.bag.indexOf(id);
  if (i >= 0) state.bag[i] = null;
}

/** Indicie pro hráče (+ skutečný záměr v dev režimu). */
function combatMeta(c) {
  const hint = LOM.hintText(c.hint);
  return state.dev.reveal ? `${hint} ${LOM.devLine(c)}` : hint;
}

/**
 * Pravidla boje žijí v js/systems/combat.js; tady jen sestavení vstupu a napojení na UI.
 * opts: { enemyId, seed, hpPct, resPct, enemyHpPct, loot }
 */
function startCombat(introLines, opts = {}) {
  const s = statsNow();
  const enemyId = opts.enemyId || "wolf";
  const seed = opts.seed ?? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const rng = LOM.createRng(seed);
  const c = LOM.createCombat({
    enemyId,
    player: {
      hp: opts.hpPct != null ? Math.max(1, Math.round(s.hpMax * opts.hpPct)) : Math.max(1, playerHp()),
      hpMax: s.hpMax,
      res: Math.round(s.resMax * (opts.resPct ?? 1)),
      resMax: s.resMax,
      atk: s.atk,
      def: s.def,
      dex: s.dex,
      int: s.int,
      classId: pickedClass(),
    },
    items: { heal: bagCount("potion"), foresight: bagCount("foresight") },
    familiarity: (state.kills[enemyId] || 0) * 0.015,
    rng,
  });
  if (opts.enemyHpPct != null) c.enemyHp = Math.max(1, Math.round(c.enemyMax * opts.enemyHpPct));
  Object.assign(c, { rng, seed, turns: [], busy: false, hotkeysArmed: true, forceLoot: opts.loot || null });
  state.combat = c;
  state.mode = "town";
  state.place = null;
  clearPlaceThread();
  state.placeView = "hub";
  const intro = (introLines && introLines.length ? introLines : [ENEMY_INTRO[enemyId]]).join(" ");
  c.turns.push({ you: intro, foe: null, meta: combatMeta(c) });
  if (opts.ambush) {
    const ev = LOM.ambush(c, rng);
    const lines = LOM.combatLines(ev, c);
    c.turns.push({ you: "Přepadl tě!", foe: lines.foe, meta: c.over ? null : combatMeta(c) });
  }
  state.log = renderCombatLogHtml();
  restoreCombatActionsHtml();
}

function renderCombatLogHtml() {
  const c = state.combat;
  if (!c?.turns?.length) return "";
  /* L = ty, R = protivník; scene = full-width (výsledek/loot) */
  const recent = c.turns.slice(-8);
  const last = recent.length - 1;
  const bubbles = [];
  recent.forEach((t, i) => {
    const isLast = i === last;
    const isPrev = i === last - 1;
    const youCls = isLast && !t.foe && !t.scene ? " fresh" : isPrev ? " dim" : "";
    const foeCls = isLast && t.foe ? " fresh" : isPrev && t.foe ? " dim" : "";
    const metaCls = isLast && t.meta ? " fresh" : isPrev ? " dim" : "";
    const sceneCls = isLast && t.scene ? " fresh" : isPrev && t.scene ? " dim" : "";
    if (t.scene) bubbles.push(`<p class="log-bubble scene result${sceneCls}">${t.scene}</p>`);
    if (t.you) bubbles.push(`<p class="log-bubble you${youCls}">${t.you}</p>`);
    if (t.foe) bubbles.push(`<p class="log-bubble foe${foeCls}">${t.foe}</p>`);
    if (t.meta) bubbles.push(`<p class="log-bubble meta${metaCls}">${t.meta}</p>`);
    if (t.sys) bubbles.push(`<p class="log-bubble sys${isLast ? " fresh" : ""}">${t.sys}</p>`);
  });
  return `<div class="log-duel" data-count="${recent.length}">${bubbles.join("")}</div>`;
}

function pushCombatTurn(partial) {
  if (!state.combat) return;
  state.combat.turns.push(partial);
  state.log = renderCombatLogHtml();
}

function gearBonus() {
  let atk = 0;
  let def = 0;
  for (const slot of EQUIP_SLOTS) {
    const id = state.equipped[slot];
    if (!id) continue;
    const item = INVENTORY.find((i) => i.id === id);
    if (!item) continue;
    atk += item.atk || 0;
    def += item.def || 0;
  }
  return { atk, def };
}

function combatFx(kind) {
  const screen = document.querySelector("[data-screen='combat']");
  if (!screen) return;
  screen.classList.remove("fx-strike", "fx-guard", "fx-hurt");
  void screen.offsetWidth;
  screen.classList.add(`fx-${kind}`);
  setTimeout(() => screen.classList.remove(`fx-${kind}`), 500);
}

function statsNow() {
  const b =
    state.prologDone.class && BASE[state.picks.class] ? BASE[state.picks.class] : PILGRIM;
  const r =
    state.prologDone.race && RACE_MOD[state.picks.race]
      ? RACE_MOD[state.picks.race]
      : { str: 0, dex: 0, vit: 0, int: 0 };
  const gear = gearBonus();
  const lg = state.prologDone.class ? LOM.LEVEL_GAIN[state.picks.class] || {} : {};
  const lv = Math.max(0, state.level - 1);
  const gain = (k) => (lg[k] || 0) * lv;
  const vit = b.vit + r.vit + gain("vit");
  const baseAtk = b.str + r.str + gain("str");
  const baseDef = Math.floor(vit * 0.5);
  return {
    str: b.str + r.str + gain("str"),
    dex: b.dex + r.dex + gain("dex"),
    vit,
    int: b.int + r.int + gain("int"),
    res: b.res,
    resMax: b.resMax,
    hpMax: 40 + vit * 2,
    atk: baseAtk + gear.atk,
    def: baseDef + gear.def,
    baseAtk,
    baseDef,
    gear,
  };
}

/** Trvalé HP hráče (null = plné). */
function playerHp() {
  const max = statsNow().hpMax;
  return state.hp == null ? max : Math.max(0, Math.min(max, state.hp));
}

function worldRng() {
  return LOM.createRng((state.seed + Math.imul(++state.steps, 2654435761)) >>> 0);
}

function bonusRowHtml(bonuses) {
  if (!bonuses?.length) return `<p class="tip">Bez úprav atributů.</p>`;
  /* stejné tipovatelné chipy jako jinde */
  return `<div class="bonus-row">${bonuses
    .map((b) => statChipBtn(b.key, b.delta))
    .join("")}</div>`;
}

function renderConfirmPicks() {
  const raceGrid = $("race-grid");
  const classGrid = $("class-grid");
  const originGrid = $("origin-grid");
  const raceBlurb = $("race-blurb");
  const classBlurb = $("class-blurb");
  const originBlurb = $("origin-blurb");
  const raceBonus = $("race-bonus");
  const classBonus = $("class-bonus");
  const originEffects = $("origin-effects");
  document.querySelectorAll('input[name="gender"]').forEach((el) => {
    el.checked = el.value === (state.gender === "f" ? "f" : "m");
  });
  if (raceGrid) {
    raceGrid.innerHTML = Object.entries(RACE_INFO)
      .map(
        ([id, info]) =>
          `<button type="button" class="pick-tile${state.prologDone.race && state.picks.race === id ? " selected" : ""}" data-act="pick-race" data-race="${id}">
            <span class="pick-ico" aria-hidden="true">${info.icon}</span>
            <span class="pick-label">${info.label}</span>
          </button>`
      )
      .join("");
  }
  if (classGrid) {
    classGrid.innerHTML = Object.entries(CLASS_INFO)
      .map(
        ([id, info]) =>
          `<button type="button" class="pick-tile${state.prologDone.class && state.picks.class === id ? " selected" : ""}" data-act="pick-class" data-class="${id}">
            <span class="pick-ico" aria-hidden="true">${info.icon}</span>
            <span class="pick-label">${info.label}</span>
          </button>`
      )
      .join("");
  }
  if (originGrid) {
    originGrid.innerHTML = Object.entries(LOM.ORIGINS)
      .map(
        ([id, info]) =>
          `<button type="button" class="pick-tile${state.prologDone.origin && state.picks.origin === id ? " selected" : ""}" data-act="pick-origin" data-origin="${id}">
            <span class="pick-ico" aria-hidden="true">${info.icon}</span>
            <span class="pick-label">${info.label}</span>
          </button>`
      )
      .join("");
  }
  const r = RACE_INFO[state.picks.race];
  const c = CLASS_INFO[state.picks.class];
  const o = state.picks.origin ? LOM.ORIGINS[state.picks.origin] : null;
  if (raceBlurb) {
    raceBlurb.textContent = state.prologDone.race
      ? r?.blurb || ""
      : "Bez volby = neutrální poutník (6/6/6/6).";
  }
  if (classBlurb) {
    classBlurb.textContent = state.prologDone.class
      ? c?.blurb || ""
      : "Bez volby = neutrální poutník.";
  }
  if (originBlurb) {
    originBlurb.textContent = state.prologDone.origin
      ? o?.blurb || ""
      : "Bez volby = bez startovních vztahů a bonusů.";
  }
  if (raceBonus) {
    raceBonus.innerHTML = state.prologDone.race && r ? bonusRowHtml(r.bonuses) : "";
  }
  if (classBonus) {
    classBonus.innerHTML = state.prologDone.class && c ? bonusRowHtml(c.bonuses) : "";
  }
  document.querySelectorAll("#origin-class .bonus-label").forEach((el) => (el.hidden = !(state.prologDone.class && c)));
  if (originEffects) {
    originEffects.textContent = state.prologDone.origin && o ? o.effectsLine || "" : "";
  }
  /* mobil: zvolené v summary (desktop skrývá CSS) */
  const raceSum = document.querySelector("#origin-race > summary");
  const classSum = document.querySelector("#origin-class > summary");
  const originSum = document.querySelector("#origin-origin > summary");
  const story = !!state.prologStory;
  $("screen-confirm-box")?.classList.toggle("confirm-summary", story);
  const again = $("prolog-again");
  if (again) again.hidden = !story;
  if (story && !state.prologDone.class && classBlurb) {
    classBlurb.textContent = "Pořádnou práci nemáš. Zato znáš hospody, zadní vrátka a co se šeptá.";
  }
  if (raceSum) {
    raceSum.innerHTML = state.prologDone.race
      ? `${story ? "Kraj" : "Vyber svůj kraj"} <em class="acc-picked">${r?.icon || ""} ${r?.label || ""}</em>`
      : "Vyber svůj kraj";
  }
  if (classSum) {
    classSum.innerHTML = state.prologDone.class
      ? `${story ? "Živnost" : "Vyber svou živnost"} <em class="acc-picked">${c?.icon || ""} ${c?.label || ""}</em>`
      : story
        ? `Živnost <em class="acc-picked">🍺 Povaleč</em>`
        : "Vyber svou živnost";
  }
  if (originSum) {
    originSum.innerHTML = state.prologDone.origin
      ? `${story ? "Původ" : "Vyber svůj původ"} <em class="acc-picked">${o?.icon || ""} ${o?.label || ""}</em>`
      : "Vyber svůj původ";
  }
  const chrome = $("origin-chrome");
  if (chrome) {
    chrome.innerHTML = screenChrome({
      label: "Postava",
      backGoto: "origins",
      canBack: true,
      fwdAct: "origin-fwd",
      canFwd: false,
      segsHtml: flowSegsHtml(FLOW_SEGS - 1),
      sub: state.prologStory ? "Tvůj příběh začíná" : "Vytvoř svého hrdinu",
    });
  }
  const box = $("confirm-stats");
  if (box) {
    box.innerHTML = statIconsHtml(statsNow(), state.flashKeys || []);
  }
  syncOriginAccordions();
  updateStartGate();
  bindScrollFade(document.querySelector(".origin-scroll"));
}

const missingPicks = () =>
  state.prologStory ? [] : [!state.prologDone.race && "kraj", !state.prologDone.class && "živnost", !state.prologDone.origin && "původ"].filter(Boolean);

function closeStartModal() {
  $("start-modal")?.classList.add("hidden");
}

/** Potvrzení, když hráč něco nevybral: řekne, co se stane, a nechá ho vrátit se. */
function openStartModal(missing) {
  let el = $("start-modal");
  if (!el) {
    el = document.createElement("aside");
    el.id = "start-modal";
    el.className = "loot-overlay hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Začít bez voleb");
    el.addEventListener("click", (e) => {
      if (e.target === el) closeStartModal();
    });
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="loot-sheet confirm-sheet">
      <strong>Začít bez těchto voleb?</strong>
      <p>Nevybráno: <strong>${missing.join(", ")}</strong>. Začneš jako neznámý poutník s neutrálními staty a bez startovních bonusů. Za hry už to nezměníš.</p>
      <div class="loot-actions">
        <button type="button" class="btn btn-ghost" data-act="start-back">Zpět k výběru</button>
        <button type="button" class="btn btn-primary" data-act="start-confirm">Začít takto</button>
      </div>
    </div>`;
  el.classList.remove("hidden");
  el.querySelector("[data-act=start-back]").focus();
}

/** Poznámka u tlačítka Vstoupit do hry (nevybrané volby) */
function updateStartGate() {
  const btn = document.querySelector('[data-act="start-game"]');
  if (!btn) return;
  /* vstoupit jde bez voleb (zůstanou neznámé), ale ne bez jména */
  const missing = missingPicks();
  const hasName = !!sanitizeHeroName($("input-name")?.value);
  btn.disabled = !hasName;
  const note = $("origin-cta-note");
  if (note) note.textContent = !hasName ? "Vyber si jméno hrdiny (kostka ti pomůže)." : missing.length ? `Nevybráno: ${missing.join(", ")}. Zůstane neznámé.` : "";
}

/**
 * Vždy jedna otevřená sekce: focus, jinak první nehotová.
 * focus: "race" | "class" | "origin" | undefined
 */
function syncOriginAccordions(focus) {
  const raceEl = $("origin-race");
  const classEl = $("origin-class");
  const originEl = $("origin-origin");
  if (!raceEl || !classEl) return;
  const openOnly = (which) => {
    raceEl.open = which === "race";
    classEl.open = which === "class";
    if (originEl) originEl.open = which === "origin";
  };
  if (focus === "race" || focus === "class" || focus === "origin") {
    openOnly(focus);
    return;
  }
  if (state.prologStory) {
    raceEl.open = classEl.open = true;
    if (originEl) originEl.open = true;
    return;
  }
  if (!state.prologDone.race) openOnly("race");
  else if (!state.prologDone.class) openOnly("class");
  else if (!state.prologDone.origin) openOnly("origin");
  else openOnly("race"); /* vše hotovo (např. scéna ze storybooku): ať není nic zavřené naslepo */
}

function updateStatsPreview() {
  renderConfirmPicks();
}

function fillPlayerBox(id, opts = {}) {
  const s = statsNow();
  const name = escapeHtml(state.name || "Poutník");
  const hp = opts.hp ?? playerHp();
  const resMax = opts.resMax ?? s.resMax;
  const res = opts.res ?? resMax;
  const resTip = opts.resTip || STAT_BY.res.title;
  const resIco = opts.resIcon || STAT_BY.res.icon;
  const el = $(id);
  if (!el) return;
  const flash = opts.flashGear ? " flash" : "";
  const flashKeys = state.flashKeys || [];
  /* HP / res / Lv · ATK/DEF ikony; XP jen v Postavě */
  el.innerHTML = `
    <div class="thumb hero" title="${name}"></div>
    <div class="box-body">
      <div class="box-title clip"><strong>${name}</strong> <span class="muted">Lv ${state.level} · ${classLabelNow()}</span></div>
      <div class="bar hp"><span class="bar-ico has-tip" data-tip="${STAT_BY.hp.title}" aria-label="HP">${STAT_BY.hp.icon}</span><i style="--p:${(hp / s.hpMax) * 100}%"></i><em>${hp}/${s.hpMax}</em></div>
      <div class="bar mp"><span class="bar-ico has-tip" data-tip="${resTip}" aria-label="${resTip}">${resIco}</span><i style="--p:${(res / resMax) * 100}%"></i><em>${res}/${resMax}</em></div>
      <div class="gear-strip${flash}">
        ${statChipBtn("atk", s.atk, { flash: flashKeys.includes("atk") })}
        ${statChipBtn("def", s.def, { flash: flashKeys.includes("def") })}
      </div>
    </div>`;
}

/**
 * Toast = drobné potvrzení / chyba (důležité události příběhu jdou do logu přes logSys).
 * Doba = clamp(3500, 45 ms × znaků, 9000); hover/touch = pauza; klik / × = zavřít; max 3 najednou.
 */
const TOAST_MAX = 3;
const toastMs = (text) => Math.min(9000, Math.max(3500, Math.round(String(text).length * 45)));

function attachToast(el, ms) {
  const host = $("toast-host") || document.body;
  if (ms == null) ms = toastMs(el.textContent);
  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    if (el.classList.contains("leaving")) return;
    el.classList.add("leaving");
    el.classList.remove("show");
    setTimeout(() => el.remove(), 240);
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(dismiss, ms);
  };
  el.setAttribute("role", "status");
  const x = document.createElement("button");
  x.type = "button";
  x.className = "toast-dismiss";
  x.setAttribute("aria-label", "Zavřít");
  x.textContent = "×";
  x.addEventListener("click", (e) => {
    e.stopPropagation();
    dismiss();
  });
  el.appendChild(x);
  el.addEventListener("click", dismiss);
  el.addEventListener("pointerenter", () => clearTimeout(timer));
  el.addEventListener("pointerleave", arm);
  /* nejstarší pryč, ať se jich nehromadí víc než TOAST_MAX */
  const live = [...host.querySelectorAll(".toast:not(.leaving)")];
  while (live.length >= TOAST_MAX) live.shift()._dismiss();
  el._dismiss = dismiss;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  arm();
}

function toast(msg, ms) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  attachToast(el, ms);
}

function toastHtml(html, ms) {
  const el = document.createElement("div");
  el.className = "toast toast-rich";
  el.innerHTML = html;
  attachToast(el, ms);
}

function statIconsHtml(s, flashKeys = []) {
  const vals = {
    hp: s.hpMax,
    res: `${s.resMax}`,
    str: s.str,
    dex: s.dex,
    vit: s.vit,
    int: s.int,
  };
  return ["hp", "res", "str", "dex", "vit", "int"]
    .map((k) => statChipBtn(k, vals[k], { flash: flashKeys.includes(k) }))
    .join("");
}

function statSnapshot() {
  const s = statsNow();
  return {
    hp: s.hpMax,
    res: s.resMax,
    str: s.str,
    dex: s.dex,
    vit: s.vit,
    int: s.int,
    atk: s.atk,
    def: s.def,
  };
}

function flashChangedStats(before) {
  const after = statSnapshot();
  const keys = Object.keys(after).filter((k) => before[k] !== after[k]);
  state.flashKeys = keys;
  state.flashStats = keys.length > 0;
  state.flashGear = keys.includes("atk") || keys.includes("def");
  setTimeout(() => {
    state.flashKeys = [];
    state.flashStats = false;
    state.flashGear = false;
    document.querySelectorAll(".is-flash, .flash").forEach((n) => {
      n.classList.remove("is-flash", "flash");
    });
  }, 900);
}

function equippedLabel(slot) {
  const id = state.equipped[slot];
  if (!id) return "–";
  const item = INVENTORY.find((i) => i.id === id);
  if (!item) return "–";
  const bonus = [];
  if (item.atk) bonus.push(`${STAT_BY.atk.icon}+${item.atk}`);
  if (item.def) bonus.push(`${STAT_BY.def.icon}+${item.def}`);
  return bonus.length ? `${item.name} (${bonus.join(" ")})` : item.name;
}

function toggleEquip(itemId, opts = {}) {
  const reopen = opts.reopen ?? "character";
  const item = INVENTORY.find((i) => i.id === itemId);
  if (!item || !EQUIP_SLOTS.includes(item.slot)) return;
  const slot = item.slot;
  const beforeGear = gearBonus();
  const beforeSnap = statSnapshot();
  const on = state.equipped[slot] === itemId;
  if (on) {
    if (!bagCanFit(itemId)) {
      toast("Inventář je plný nebo moc těžký.");
      return;
    }
    state.equipped[slot] = null;
    bagPut(itemId);
  } else {
    const bagIdx = state.bag.indexOf(itemId);
    if (bagIdx < 0) {
      toast("Nemáš ten předmět v batohu.");
      return;
    }
    const prev = state.equipped[slot];
    state.bag[bagIdx] = null;
    if (prev) {
      if (!bagPut(prev)) {
        state.bag[bagIdx] = itemId;
        toast("Není místo na sundané.");
        return;
      }
    }
    state.equipped[slot] = itemId;
  }
  const afterGear = gearBonus();
  toastHtml(`
    <span class="toast-line">
      <span class="toast-ico" aria-hidden="true">${item.icon || "•"}</span>
      <strong>${on ? "Sundáno" : "Nasazeno"}</strong>
      <span>${item.name}</span>
    </span>
    <span class="toast-chips gear-strip">
      ${statChipBtn("atk", `${beforeGear.atk}→${afterGear.atk}`)}
      ${statChipBtn("def", `${beforeGear.def}→${afterGear.def}`)}
    </span>`);
  flashChangedStats(beforeSnap);
  state.equipPickSlot = null;
  render();
  if (reopen) openPanel(reopen);
}

function unequipSlot(slot, opts = {}) {
  const reopen = opts.reopen ?? "character";
  const id = state.equipped[slot];
  if (!id) {
    state.equipPickSlot = null;
    openPanel(reopen);
    return;
  }
  toggleEquip(id, { reopen });
}

function setAuth(mode) {
  state.auth = mode;
  $("auth-register")?.classList.toggle("hidden", mode !== "register");
  $("auth-signin")?.classList.toggle("hidden", mode !== "signin");
  const chrome = $("auth-chrome");
  if (chrome) {
    chrome.innerHTML = screenChrome({
      label: mode === "signin" ? "Přihlášení" : "Registrace",
      sub: mode === "signin" ? "Vítej zpět" : "Vytvoř svého hrdinu",
    });
  }
}

/** Scroll lane / panel - klíč = stav; jiný stav = nahoře, stejný = pamatovat */
const laneScrollMem = {};
let laneScrollKey = null;
const panelScrollMem = {};

function clearUiScrollMem() {
  Object.keys(laneScrollMem).forEach((k) => delete laneScrollMem[k]);
  Object.keys(panelScrollMem).forEach((k) => delete panelScrollMem[k]);
  laneScrollKey = null;
}

/** Úvod: jeden citát, při každém návratu na úvod jiný (lidová moudrost, slavná věta, repliky z města). */
const LANDING_QUOTES = [
  { q: "„Mlčeti zlato.“", by: "lidové rčení" },
  { q: "„Musíme obdělávat svou zahradu.“", by: "Voltaire, Candide" },
  { q: "„Posaď se. Kde to bolí?“", by: "Lidmila, léčitelka" },
  { q: "„Platit budete tak jako tak.“", by: "Svatava z Přívozu, hostinská" },
];
let landingQuoteIdx = -1;
let landingQuoteShown = false;
function showLandingQuote() {
  landingQuoteShown = true;
  const q = $("landing-quote");
  const by = $("landing-quote-by");
  if (!q || !by) return;
  let i = Math.floor(Math.random() * LANDING_QUOTES.length);
  if (i === landingQuoteIdx) i = (i + 1) % LANDING_QUOTES.length;
  landingQuoteIdx = i;
  q.textContent = LANDING_QUOTES[i].q;
  by.textContent = `– ${LANDING_QUOTES[i].by}`;
  revealText(q, { step: 55, max: 900 });
  revealText(by, { step: 40, max: 500, delay: 700 });
}

function setScreen(name) {
  const reveal = name === "landing" && (state.screen !== "landing" || !landingQuoteShown);
  if (state.screen !== name) {
    lastOriginStep = -1;
    lastRevealed = "";
  }
  /* DEV / přechod sekcí: jiná obrazovka = reset scrollů a panelů; stejná = pamatovat */
  if (state.screen !== name) {
    clearUiScrollMem();
    state.panelStack = [];
    state.equipPickSlot = null;
    state.equipConfirm = null;
    const overlay = $("panel");
    if (overlay) {
      overlay.querySelectorAll(".panel-under").forEach((n) => n.remove());
      overlay.classList.add("hidden");
    }
  }
  state.screen = name;
  document.querySelectorAll("[data-screen]").forEach((el) => {
    el.classList.toggle("hidden", el.getAttribute("data-screen") !== name);
  });
  document.querySelectorAll(".dev-btn").forEach((btn) => {
    const match =
      btn.dataset.goto === name &&
      (!btn.dataset.auth || btn.dataset.auth === state.auth || name !== "landing");
    btn.classList.toggle("active", match || (name === "landing" && btn.dataset.auth === state.auth));
  });
  if (name === "confirm") updateStatsPreview();
  render();
  if (reveal) showLandingQuote();
}

function laneStateKey() {
  if (state.mode === "place" && state.place) {
    return `place:${state.place}:${state.placeView || "hub"}`;
  }
  return String(state.mode || "town");
}

function scrollLogToEnd() {
  const id = state.screen === "combat" ? "combat-log" : "town-log";
  const el = $(id);
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}

/** Kodex: každý řádek logu (<p>) se anotuje jednou a výsledek se pamatuje, ať přerenderování neztratí tooltip. */
function kodexLog(html) {
  if (!LOM.Kodex.enabled(state.prefs)) return html;
  if (!state.kodexSeen) state.kodexSeen = new Set();
  if (!state.kodexCache) state.kodexCache = new Map();
  return html.replace(/<p\b[^>]*>[\s\S]*?<\/p>/g, (chunk) => {
    let out = state.kodexCache.get(chunk);
    if (out === undefined) {
      out = LOM.Kodex.annotate(chunk, state.kodexSeen, { prefs: state.prefs });
      if (state.kodexCache.size > 200) state.kodexCache.clear();
      state.kodexCache.set(chunk, out);
    }
    return out;
  });
}

/**
 * Náběh textu: slova se objeví postupně (fade). Rozdělí jen mezery, ne nezlomitelné (nbsp drží pohromadě).
 * Celé to trvá nejvýš ~1,1 s bez ohledu na délku; `prefers-reduced-motion` efekt vypne.
 */
function revealText(el, { step = 26, max = 1100, delay = 0 } = {}) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    /* Kodex: heslo necháme vcelku (tooltip + tečky), bez náběhu po slovech */
    if (n.parentElement?.closest?.("abbr.kodex")) continue;
    nodes.push(n);
  }
  const total = nodes.reduce((a, n) => a + n.nodeValue.split(/[ \t\n]+/).filter(Boolean).length, 0);
  const per = Math.min(step, max / Math.max(total, 1));
  let i = 0;
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    for (const part of n.nodeValue.split(/([ \t\n]+)/)) {
      if (!part) continue;
      if (/^[ \t\n]+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
        continue;
      }
      const w = document.createElement("span");
      w.className = "w";
      w.style.setProperty("--d", `${delay + Math.round(i++ * per)}ms`);
      w.textContent = part;
      frag.appendChild(w);
    }
    n.replaceWith(frag);
  }
}

let lastRevealed = "";

function setLog(html) {
  state.log = html;
  html = kodexLog(html);
  const id = state.screen === "combat" ? "combat-log" : "town-log";
  const el = $(id);
  if (el) {
    el.innerHTML = html;
    /* nová vyprávěná věta (ne opakovaný render téhož textu) se vypíše postupně */
    const bubbles = el.querySelectorAll(".log-bubble");
    const fresh =
      id === "town-log" /* boj zůstává svižný, bez náběhu */
        ? el.querySelector(".log-bubble.fresh.scene, .log-bubble.fresh.foe") || (bubbles.length === 1 ? bubbles[0] : null)
        : null;
    if (fresh && fresh.textContent !== lastRevealed) {
      lastRevealed = fresh.textContent;
      revealText(fresh);
    }
    scrollLogToEnd();
  }
}

function isLootOpen() {
  const el = $("loot-modal");
  return !!(el && !el.classList.contains("hidden"));
}

function refreshInvOrLoot() {
  if (isLootOpen()) renderLootModal();
  else if ($("panel")?.dataset.kind === "inventory") openPanel("inventory", { keepStack: true });
}

/** Klik mimo / × / Esc = o 1 úroveň výš (equip confirm→list→panel→stack→zavřít). */
function closePanelStep() {
  if (state.invDiscardIdx != null) {
    state.invDiscardIdx = null;
    refreshInvOrLoot();
    return;
  }
  if (state.confirmDelete) {
    state.confirmDelete = false;
    openPanel("settings", { keepStack: true });
    return;
  }
  if (state.equipConfirm) {
    state.equipConfirm = null;
    openPanel("character", { keepStack: true });
    return;
  }
  if (state.equipPickSlot) {
    state.equipPickSlot = null;
    openPanel("character", { keepStack: true });
    return;
  }
  const prev = state.panelStack.pop();
  if (prev) openPanel(prev, { keepStack: true });
  else openPanel(null);
}

function mainPanelSheet() {
  return $("panel")?.querySelector(".panel-sheet:not(.panel-under)");
}

/** Stejná klávesa / dock znovu = zavřít panel. */
function togglePanel(kind) {
  const overlay = $("panel");
  if (overlay && !overlay.classList.contains("hidden") && overlay.dataset.kind === kind) {
    openPanel(null);
    return;
  }
  openPanel(kind);
}

/**
 * Panely: otevření root maže stack.
 * opts.pushFrom = ulož aktuální panel do stacku (návrat o úroveň).
 * opts.keepStack = ponech stack (při návratu ze stacku).
 */
function openPanel(kind, opts = {}) {
  const overlay = $("panel");
  capturePanelScroll();
  if (!kind) {
    state.equipPickSlot = null;
    state.equipConfirm = null;
    state.confirmDelete = false;
    state.confirmSaveDelete = false;
    state.panelStack = [];
    overlay.querySelectorAll(".panel-under").forEach((n) => n.remove());
    overlay.classList.add("hidden");
    delete overlay.dataset.kind;
    overlay.classList.remove("is-fullscreen");
    return;
  }
  const cur = overlay.dataset.kind;
  const sheetNow = mainPanelSheet();
  if (opts.pushFrom && cur && cur !== kind && !overlay.classList.contains("hidden") && sheetNow) {
    state.panelStack.push(cur);
    /* pod novým panelem ztlumený klon - bez id (jinak $() bere under a dismiss rozbije stack) */
    overlay.querySelectorAll(".panel-under").forEach((n) => n.remove());
    const under = sheetNow.cloneNode(true);
    under.classList.add("panel-under");
    under.setAttribute("aria-hidden", "true");
    under.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    under.querySelectorAll("button, input, select, textarea, a").forEach((el) => {
      el.setAttribute("disabled", "");
      el.setAttribute("tabindex", "-1");
    });
    sheetNow.before(under);
  } else if (!opts.pushFrom && !opts.keepStack) {
    state.panelStack = [];
    overlay.querySelectorAll(".panel-under").forEach((n) => n.remove());
  } else if (opts.keepStack) {
    overlay.querySelectorAll(".panel-under").forEach((n) => n.remove());
  }
  const sheet = mainPanelSheet();
  const title = sheet?.querySelector("#panel-title") || $("panel-title");
  const body = sheet?.querySelector("#panel-body") || $("panel-body");
  const foot = sheet?.querySelector("#panel-foot") || $("panel-foot");
  if (!sheet || !title || !body || !foot) return;
  overlay.classList.remove("hidden");
  overlay.dataset.kind = kind;
  /* landing / prolog / původ - bez herního footeru → overlay přes celou obrazovku */
  const preGame =
    state.screen === "landing" || state.screen === "origins" || state.screen === "confirm";
  overlay.classList.toggle("is-fullscreen", preGame);
  foot.classList.add("hidden");
  foot.innerHTML = "";

  if (kind === "inventory") {
    title.textContent = "Inventář";
    const w = bagWeight();
    const cells = state.bag
      .map((id, idx) => {
        if (!id) {
          return `<div class="bag-slot empty" data-bag-slot="${idx}" data-drop="bag" aria-label="Prázdné místo ${idx + 1}"></div>`;
        }
        const item = ITEM_BY[id];
        if (!item) return `<div class="bag-slot empty" data-bag-slot="${idx}" data-drop="bag"></div>`;
        return `<div class="bag-slot" data-bag-slot="${idx}" data-drop="bag" data-item-id="${id}">
          ${itemTileHtml(item, {
            extraTips: [`${itemWeight(id)} kg`],
            act: `draggable="true" data-drag-bag="${idx}"`,
          })}
        </div>`;
      })
      .join("");
    const discardIdx = state.invDiscardIdx;
    const discardItem = discardIdx != null ? ITEM_BY[state.bag[discardIdx]] : null;
    const discardModal =
      discardItem
        ? `<div class="equip-pop-layer confirm-layer" role="presentation">
        <div class="equip-popover" role="dialog" aria-label="Zahodit">
          <header class="equip-pop-head"><h3>Zahodit?</h3>
            <button type="button" class="panel-close" data-act="inv-discard-no" aria-label="Ne"></button>
          </header>
          <p class="equip-confirm-line">Zahodit ${discardItem.icon || ""} <strong>${discardItem.name}</strong>?</p>
          <div class="equip-confirm-actions">
            <button type="button" class="btn btn-danger" data-act="inv-discard-yes">Zahodit</button>
            <button type="button" class="btn btn-ghost" data-act="inv-discard-no">Nechat</button>
          </div>
        </div>
      </div>`
        : "";
    body.innerHTML = `
      <div class="panel-scroll" data-scroll="inventory"><div class="inv-grid inv-grid-bag">${cells}</div></div>
      <div class="inv-foot">
        <p class="bag-meta">${w.toFixed(1)} / ${BAG_WEIGHT_MAX} kg · ${state.bag.filter(Boolean).length}/${BAG_SLOTS}</p>
        <div class="gear-strip">${statChipBtn("gold", String(state.gold))}</div>
      </div>
      ${discardModal}`;
  }
  if (kind === "quests") {
    title.textContent = "Úkoly";
    const statusLabel = { active: "aktivní", ready: "odevzdat", available: "dostupné", done: "hotovo" };
    const order = { ready: 0, active: 1, available: 2, done: 3 };
    const defs = Object.values(QUEST_DEF).sort((a, b) => order[LOM.Quests.statusOf(state.quests, a.id)] - order[LOM.Quests.statusOf(state.quests, b.id)]);
    const marks = LOM.Quests.marks(state.quests, questCtx());
    /* Zápisník je vlastní záložka (ne karta pod questy); skrytý, dokud nepadne první fáma */
    const hasNotebook = kauzaHasClaims();
    if (!hasNotebook) state.panelTab = "quests";
    const tab = state.panelTab === "notebook" ? "notebook" : "quests";
    if (tab === "notebook") state.notebookNew = false;
    syncNotebookDot();
    const tabs = hasNotebook
      ? `<div class="panel-tabs" role="tablist" aria-label="Úkoly a Zápisník">
        <button type="button" role="tab" class="panel-tab${tab === "quests" ? " is-on" : ""}" aria-selected="${tab === "quests"}" data-act="panel-tab" data-tab="quests">Úkoly</button>
        <button type="button" role="tab" class="panel-tab${tab === "notebook" ? " is-on" : ""}${state.notebookNew ? " has-dot" : ""}" aria-selected="${tab === "notebook"}" data-act="panel-tab" data-tab="notebook">Zápisník${state.notebookNew ? `<span class="sr-only"> (nová fáma)</span>` : ""}</button>
      </div>`
      : "";
    if (tab === "notebook") {
      body.innerHTML = `${tabs}
      <div class="panel-scroll panel-stack" data-scroll="notebook">
        <p class="muted q-hint nb-intro">Tady je, co ti kdo řekl a co jsi s tím udělal.</p>
        ${notebookHtml()}
      </div>`;
    } else body.innerHTML = `${tabs}
      <div class="panel-scroll panel-stack" data-scroll="quests">
        ${defs
          .map((q) => {
            const st = LOM.Quests.statusOf(state.quests, q.id);
            const prog = st === "available" || st === "done" ? [] : LOM.Quests.progressOf(state.quests, q.id, questCtx());
            const objs = prog
              .map((p) => {
                const lost = p.obj.type === "have" && !p.done && marks.find((m) => m.id === q.id && m.kind === "lost");
                return `<li class="${p.done ? "done" : ""}">${p.done ? "✓" : "○"} ${p.obj.text}${p.max > 1 ? ` <em>${p.cur}/${p.max}</em>` : ""}${lost ? ` <em class="q-lost">💀 leží v tvém těle na (${lost.x},${lost.y})</em>` : ""}</li>`;
              })
              .join("");
            const where =
              st === "available"
                ? `Nabízí ${q.giver.npc} (${PLACE[q.giver.place].title}). Zeptej se v rozhovoru.`
                : st === "active" || st === "ready"
                  ? `Odevzdat: ${q.turnIn.cell ? `${q.turnIn.npc}, ${cellLabel(...q.turnIn.cell)} (${q.turnIn.cell})` : `${q.turnIn.npc}, ${PLACE[q.turnIn.place].title}`}`
                  : "";
            const rewardSrc = q.reward || {};
            const rew = [
              rewardSrc.xp != null ? `<span class="stat-icon"><span class="si" aria-hidden="true">✦</span><strong>${rewardSrc.xp} XP</strong></span>` : "",
              rewardSrc.gold ? goldAmt(rewardSrc.gold, { tip: "Odměna" }) : "",
              ...(rewardSrc.items || []).map((i) => `<span class="q-loot">${ITEM_BY[i].icon} ${ITEM_BY[i].name}</span>`),
              q.choices ? `<span class="muted">odměna podle volby</span>` : "",
            ]
              .filter(Boolean)
              .join("");
            const actions =
              st === "active" || st === "ready"
                ? `<button type="button" class="btn btn-ghost q-act" data-act="quest-abandon" data-quest="${q.id}">Zrušit úkol</button>`
                : "";
            return `
        <article class="panel-card quest-card q-${st}">
          <div class="panel-card-top">
            <span class="panel-tile-ico" aria-hidden="true">${st === "ready" ? "❓" : st === "available" ? "❗" : "📜"}</span>
            <strong>${q.title}</strong>
            <em class="tag">${statusLabel[st]}</em>
          </div>
          <span class="q-obj">${q.brief}</span>
          ${objs ? `<ul class="q-objs">${objs}</ul>` : ""}
          ${where ? `<span class="muted q-hint">${where}</span>` : ""}
          <div class="q-rew gear-strip">${st === "done" ? `<span class="muted">odevzdáno${q.choices ? ` · ${q.choices.find((c) => c.id === state.quests[q.id]?.choice)?.label || ""}` : ""}</span>` : rew}</div>
          ${actions ? `<div class="q-actions">${actions}</div>` : ""}
        </article>`;
          })
          .join("")}
      </div>`;
  }
  if (kind === "character") {
    const s = statsNow();
    title.textContent = "Postava";
    const SLOT_UI = {
      neck: { cls: "equip-neck", label: "Náhrdelník" },
      head: { cls: "equip-head", label: "Přilba" },
      shoulders: { cls: "equip-shoulders", label: "Ramena" },
      weapon: { cls: "equip-weapon", label: "Zbraň" },
      body: { cls: "equip-body", label: "Tělo" },
      shield: { cls: "equip-shield", label: "Štít" },
      hands: { cls: "equip-hands", label: "Rukavice" },
      legs: { cls: "equip-legs", label: "Nohavice" },
      wrists: { cls: "equip-wrists", label: "Zápěstí" },
      feet: { cls: "equip-feet", label: "Obuv" },
      trinket: { cls: "equip-trinket", label: "Šperk" },
    };
    const pick = state.equipPickSlot;
    const equipTiles = EQUIP_SLOTS
      .map((slot) => {
        const ui = SLOT_UI[slot];
        const id = state.equipped[slot];
        const item = id && INVENTORY.find((i) => i.id === id);
        const open = pick === slot ? " pick-open" : "";
        const tip = item
          ? itemTipBits(item, ["klik změní"]).join(" · ")
          : `${ui.label}: prázdné · klik vybere`;
        return `<button type="button" class="equip-slot can-equip has-tip ${ui.cls}${item ? " on" : ""}${open}" data-act="char-slot" data-slot="${slot}" data-tip="${tip}" aria-expanded="${pick === slot}" aria-label="${tip}">
          <span class="panel-tile-ico" aria-hidden="true">${item?.icon || "·"}</span>
          <strong class="equip-slot-label">${ui.label}</strong>
          <span class="inv-cell-name">${item ? item.name : "–"}</span>
        </button>`;
      })
      .join("");
    let popHtml = "";
    if (pick && SLOT_UI[pick]) {
      /* jen to, co máš v batohu + právě nasazené */
      const ownedIds = new Set(state.bag.filter(Boolean));
      if (state.equipped[pick]) ownedIds.add(state.equipped[pick]);
      const candidates = [...ownedIds]
        .map((id) => ITEM_BY[id])
        .filter((i) => i && i.slot === pick);
      const equippedId = state.equipped[pick];
      const conf = state.equipConfirm;
      let bodyPop = "";
      if (conf?.itemId) {
        /* úroveň 2: jen dotaz - seznam skrytý (nemáte) */
        const next = INVENTORY.find((i) => i.id === conf.itemId);
        const prev = equippedId && INVENTORY.find((i) => i.id === equippedId);
        const same = equippedId === conf.itemId;
        const line = same
          ? `Sundat ${next?.icon || ""} <strong>${next?.name || "?"}</strong>?`
          : prev
            ? `Vyměnit ${prev.icon} <strong>${prev.name}</strong> → ${next?.icon || ""} <strong>${next?.name || "?"}</strong>?`
            : `Nasadit ${next?.icon || ""} <strong>${next?.name || "?"}</strong>?`;
        bodyPop = `
          <div class="equip-confirm" role="dialog" aria-label="Potvrdit výzbroj">
            <p class="equip-confirm-line">${line}</p>
            <div class="equip-confirm-actions">
              <button type="button" class="btn btn-primary" data-act="equip-confirm-yes">Ano</button>
              <button type="button" class="btn btn-ghost" data-act="equip-confirm-no">Ne</button>
            </div>
          </div>`;
      } else {
        bodyPop = candidates.length
          ? `<div class="inv-grid inv-grid-square">${candidates
              .map((i) =>
                itemTileHtml(i, {
                  on: equippedId === i.id,
                  canAct: true,
                  act: `data-act="equip-ask" data-item="${i.id}"`,
                  extraTips: equippedId === i.id ? ["klik sundá / vymění"] : ["vybrat"],
                })
              )
              .join("")}</div>`
          : `<p class="tip">V inventáři nic pro tento slot.</p>`;
      }
      popHtml = `
        <div class="equip-pop-layer" role="presentation">
          <div class="equip-popover" role="dialog" aria-label="${SLOT_UI[pick].label}">
            <header class="equip-pop-head">
              <h3>${SLOT_UI[pick].label}</h3>
              <button type="button" class="panel-close" data-act="${
                conf?.itemId ? "equip-confirm-no" : "char-slot-close"
              }" aria-label="${conf?.itemId ? "Zpět na výběr" : "Zavřít výběr"}"></button>
            </header>
            ${bodyPop}
          </div>
        </div>`;
    }
    const clsLabel = CLASS_INFO[pickedClass()]?.label || "Povaleč";
    const raceLabel = RACE_INFO[pickedRace()]?.label || "neznámý původ";
    body.innerHTML = `
      <div class="panel-head">
        <p><strong>${escapeHtml(state.name || "Poutník")}</strong> · ${clsLabel} · ${raceLabel}</p>
        <div class="bar bar-xp"><span>Lv ${state.level}</span><i style="--p:${(state.xp / state.xpNext) * 100}%"></i><em>${state.xp}/${state.xpNext} XP</em></div>
        <div class="gear-strip">
          ${statChipBtn("atk", s.atk, {
            tip: `Útok ${s.atk} · základ ${s.baseAtk} · výzbroj +${s.gear.atk}`,
            flash: (state.flashKeys || []).includes("atk"),
          })}
          ${statChipBtn("def", s.def, {
            tip: `Obrana ${s.def} · základ ${s.baseDef} · výzbroj +${s.gear.def}`,
            flash: (state.flashKeys || []).includes("def"),
          })}
          ${statChipBtn("gold", String(state.gold))}
        </div>
      </div>
      <div class="panel-scroll panel-stack" data-scroll="character">
        <section class="panel-section">
          <h3 class="panel-section-title">Atributy</h3>
          <div class="stat-icons">${statIconsHtml(s, state.flashKeys || [])}</div>
        </section>
        <div class="char-split">
          <section class="panel-section">
            <h3 class="panel-section-title">Výzbroj</h3>
            <div class="equip-doll">${equipTiles}</div>
          </section>
          <section class="panel-section">
            <h3 class="panel-section-title">Dovednosti</h3>
            <p class="muted">Strom schopností podle povolání, brzy.</p>
          </section>
        </div>
      </div>
      ${popHtml}`;
  }
  if (kind === "map") {
    title.textContent = "Mapa";
    const marks = LOM.Quests.marks(state.quests, questCtx());
    const signs = LOM.spotSigns(ensureSpots(), state.mapX, state.mapY, state.clock);
    const QICON = { lost: "💀", turnin: "❓", giver: "❗", target: "📍" };
    const cells = [];
    for (let y = MAP_MAX; y >= 0; y--) {
      for (let x = 0; x <= MAP_MAX; x++) {
        const known = !!state.discovered[mapKey(x, y)];
        const here = state.mapX === x && state.mapY === y;
        const t = terrainAt(x, y);
        const isCity = t === "town";
        const corpse = state.corpses.find((c) => c.x === x && c.y === y);
        const pile = LOM.Stash.pileAt(state.piles, x, y, "open");
        const here_marks = marks.filter((m) => m.x === x && m.y === y);
        const zone = here_marks.some((m) => m.kind === "zone");
        const sign =
          signs.find((sg) => state.mapX + sg.dx === x && state.mapY + sg.dy === y) ||
          (state.dev.spots && LOM.spotAt(ensureSpots(), x, y, { day: state.clock.day, tick: 3 * LOM.TICKS_PER_PHASE }) ? { spot: ensureSpots().find((p) => p.x === x && p.y === y) } : null);
        const cls = [
          "map-cell",
          known || corpse ? `known ${t}` : "fog",
          here ? "here" : "",
          isCity && known ? "landmark city" : "",
          zone ? "q-zone" : "",
        ]
          .filter(Boolean)
          .join(" ");
        let mark = "";
        if (here) mark = `<span class="map-dot" aria-hidden="true"></span>`;
        else if (known && isCity) mark = `<span class="map-ico" aria-hidden="true">🏛</span>`;
        else if (known && t === "village") mark = `<span class="map-ico dim" aria-hidden="true">🏘</span>`;
        else if (known && t === "chapel") mark = `<span class="map-ico dim" aria-hidden="true">✝</span>`;
        const q = ["lost", "turnin", "giver", "target"].map((k) => here_marks.find((m) => m.kind === k)).find(Boolean);
        if (q && !here) mark = `<span class="map-ico q" aria-hidden="true">${QICON[q.kind]}</span>`;
        else if (q && here) mark += `<span class="map-ico q corner" aria-hidden="true">${QICON[q.kind]}</span>`;
        if (corpse && !here) mark = `<span class="map-ico corpse" aria-hidden="true">💀</span>`;
        else if (corpse) mark += `<span class="map-ico corpse corner" aria-hidden="true">💀</span>`;
        if (pile && !corpse && !here) mark = `<span class="map-ico" aria-hidden="true">📦</span>`;
        else if (pile && !corpse) mark += `<span class="map-ico corner" aria-hidden="true">📦</span>`;
        if (sign && !corpse) mark = `<span class="map-ico warn" aria-hidden="true">⚠</span>`;
        const tip = [
          known ? `${cellLabel(x, y)} (${x},${y})` : "Neprozkoumáno",
          corpse ? "Tvé věci leží tady" : "",
          pile ? "Odložené věci" : "",
          sign ? `Stopy: ${SIGN_TEXT[sign.spot.enemyId]}` : "",
          ...here_marks.map((m) => m.text),
        ]
          .filter(Boolean)
          .join(" · ");
        cells.push(`<div class="${cls}" title="${tip}">${mark}</div>`);
      }
    }
    const notes = marks.filter((m) => m.kind !== "zone");
    body.innerHTML = `
      <div class="panel-scroll panel-stack map-wrap" data-scroll="map">
        <p class="map-meta">Jsi zde: <strong>${cellLabel(state.mapX, state.mapY)}</strong> · (${state.mapX},${state.mapY}) · ${TERRAIN_CS[terrainAt(state.mapX, state.mapY)]}</p>
        <div class="map-grid" role="img" aria-label="Mapa okolí Machaly">${cells.join("")}</div>
        <p class="map-legend"><span>🏛 město</span><span>■ objevené</span><span>■ mlha</span><span>● jsi zde</span><span>⚠ stopy (jen ve dne)</span>${state.corpses.length ? "<span>💀 tvé věci</span>" : ""}${state.piles.some((p) => p.kind === "open") ? "<span>📦 odloženo</span>" : ""}${marks.length ? "<span>❗ nabídka</span><span>❓ odevzdat</span><span>📍 cíl</span><span>▨ oblast úkolu</span>" : ""}</p>
        ${notes.length || state.piles.length ? `<ul class="map-notes">${notes.map((m) => `<li>${QICON[m.kind]} (${m.x},${m.y}) ${m.text}</li>`).join("")}${state.piles.map((p) => `<li>${p.kind === "buried" ? "⛏ zakopáno na" : "📦 odloženo na"} (${p.x},${p.y}): ${p.items.map((it) => ITEM_BY[it.id]?.icon || "").join(" ")}</li>`).join("")}</ul>` : ""}
      </div>`;
  }
  if (kind === "settings") {
    title.textContent = "Nastavení";
    const a = state.audio || { music: 60, sfx: 80, muted: false };
    const inGame = state.screen === "town" || state.screen === "combat";
    const typed = state.deleteTyped || "";
    const canDelete = typed.trim().toUpperCase() === "SMAZAT";
    const delModal = state.confirmDelete
      ? `<div class="equip-pop-layer confirm-layer" role="presentation">
          <div class="equip-popover" role="dialog" aria-label="Smazat účet">
            <header class="equip-pop-head"><h3>Smazat účet</h3>
              <button type="button" class="panel-close" data-act="delete-cancel" aria-label="Zrušit"></button>
            </header>
            <p class="equip-confirm-line">Napiš <strong>SMAZAT</strong>. Účet se <em>deaktivuje</em> (14 dnů na obnovení), ne okamžitý výmaz.</p>
            <input class="delete-confirm-input" type="text" data-act="delete-type" value="${typed.replace(/"/g, "&quot;")}" placeholder="SMAZAT" autocomplete="off" />
            <div class="equip-confirm-actions">
              <button type="button" class="btn btn-danger" data-act="delete-confirm" ${canDelete ? "" : "disabled"}>Smazat účet</button>
              <button type="button" class="btn btn-ghost" data-act="delete-cancel">Nechat</button>
            </div>
          </div>
        </div>`
      : "";
    body.innerHTML = `
      <div class="panel-scroll panel-stack" data-scroll="settings">
        <ul class="list">
          <li class="settings-account">
            <strong>Účet</strong>
            <span class="tip">${state.guest ? "Host" : "Přihlášen"}</span>
            ${inGame ? `<button type="button" class="btn btn-ghost" data-act="logout">Odhlásit</button>` : ""}
          </li>
          <li class="settings-lang">
            <strong>Jazyk</strong>
            <div class="lang-switch" role="group" aria-label="Jazyk">
              <button type="button" class="lang-btn is-on" data-act="lang-cs" aria-pressed="true" title="Čeština">🇨🇿 CS</button>
              <button type="button" class="lang-btn" data-act="lang-en" disabled title="English (brzy)" aria-pressed="false">🇬🇧 EN</button>
            </div>
          </li>
          <li class="settings-audio">
            <strong>Zvuk</strong>
            <label class="check settings-mute"><input type="checkbox" data-act="audio-mute" ${a.muted ? "checked" : ""} /> Ztlumit vše</label>
            <label class="settings-slider">Hudba
              <input type="range" min="0" max="100" value="${a.music}" data-act="audio-music" ${a.muted ? "disabled" : ""} />
              <em>${a.muted ? "–" : a.music}</em>
            </label>
            <label class="settings-slider">Zvuky
              <input type="range" min="0" max="100" value="${a.sfx}" data-act="audio-sfx" ${a.muted ? "disabled" : ""} />
              <em>${a.muted ? "–" : a.sfx}</em>
            </label>
          </li>
          ${
            coarsePointer()
              ? ""
              : `<li class="settings-controls">
            <strong>Ovládání</strong>
            <label class="check"><input type="checkbox" data-act="pref-hotkeys" ${state.prefs.hotkeys ? "checked" : ""} /> Klávesové zkratky</label>
            <span class="tip">Footer 1–5 · v boji Q/W/E/R/F/X.</span>
          </li>`
          }
          <li class="settings-controls">
            <strong>Text</strong>
            <label class="check"><input type="checkbox" data-act="pref-kodex" ${state.prefs.kodex !== false ? "checked" : ""} /> Nápovědy ke slovům</label>
            <span class="tip">Staré a méně známé slovo je podtržené tečkami; ukaž na ně nebo ťukni.</span>
          </li>
          ${
            readSave()
              ? `<li class="settings-danger">
            <strong>Uložená hra</strong>
            <span class="tip">Ukládá se samo v tomto prohlížeči.</span>
            ${
              state.confirmSaveDelete
                ? `<span class="tip">Opravdu smazat? Postup nejde vrátit.</span>
            <div class="equip-confirm-actions">
              <button type="button" class="btn btn-danger" data-act="save-delete-confirm">Smazat uloženou hru</button>
              <button type="button" class="btn btn-ghost" data-act="save-delete-cancel">Nechat</button>
            </div>`
                : `<button type="button" class="btn btn-danger wide" data-act="save-delete">Smazat uloženou hru</button>`
            }
          </li>`
              : ""
          }
          <li class="settings-links">
            <button type="button" class="btn btn-ghost" data-act="open-ranks">Žebříčky</button>
            <button type="button" class="btn btn-ghost" data-act="open-legal" data-legal="faq">FAQ</button>
            <button type="button" class="btn btn-ghost" data-act="open-legal" data-legal="terms">Podmínky</button>
          </li>
          ${
            inGame && !state.guest
              ? `<li class="settings-danger">
            <strong>Nebezpečná zóna</strong>
            <span class="tip">Deaktivace · 14 dnů na obnovení.</span>
            <button type="button" class="btn btn-danger wide" data-act="delete-account">Smazat účet</button>
          </li>`
              : ""
          }
        </ul>
      </div>
      ${delModal}`;
  }
  if (kind === "ranks") {
    title.textContent = "Žebříčky";
    const rows = [
      { rank: 1, name: "Břetislav", cls: "Válečník", level: 12, wins: 84 },
      { rank: 2, name: "Milada", cls: "Lovec", level: 11, wins: 71 },
      { rank: 3, name: "Bořivoj", cls: "Mág", level: 10, wins: 66 },
      { rank: 4, name: "Zdislava", cls: "Lovec", level: 9, wins: 52 },
      { rank: 5, name: "Ctibor", cls: "Válečník", level: 8, wins: 41 },
      { rank: 6, name: escapeHtml(state.name || "Ty"), cls: classLabelNow(), level: state.level, wins: 1, you: true },
    ];
    body.innerHTML = `
      <div class="panel-scroll" data-scroll="ranks">
        <table class="ranks-table">
          <thead><tr><th>#</th><th>Hrdina</th><th>Povolání</th><th>Lv</th><th>Výhry</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (r) => `<tr class="${r.you ? "is-you" : ""}">
                <td>${r.rank}</td>
                <td>${r.name}</td>
                <td>${r.cls}</td>
                <td>${r.level}</td>
                <td>${r.wins}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }
  if (kind === "legal") {
    /* indie: jedna stránka Podmínky místo firemního obchodního řádu + privacy */
    const docs = {
      faq: {
        title: "FAQ",
        html: `<div class="faq-acc">
            <details class="faq-item" name="faq">
              <summary>Co když zemřu?</summary>
              <p>Respawn ve městě; zlato v bance zůstane.</p>
            </details>
            <details class="faq-item" name="faq">
              <summary>Host vs účet?</summary>
              <p>Host = lokalně; účet = cloud (produkce).</p>
            </details>
            <details class="faq-item" name="faq">
              <summary>Inventář v boji?</summary>
              <p>Můžeš prohlížet; výzbroj a spotřebu měň přes Postavu / akci s odvarem.</p>
            </details>
            <details class="faq-item" name="faq">
              <summary>Jak nasadím výzbroj?</summary>
              <p>Panel Postava → klik na slot → výběr → potvrzení.</p>
            </details>
            <details class="faq-item" name="faq">
              <summary>Atributy (STR / DEX / VIT / INT)</summary>
              <p>Ikony u rasy a povolání = stejné chipy jako ve hře. Tip na chipu = krátký popis.</p>
              <p>STR → fyzické poškození · DEX → zásah a útěk · VIT → max HP a DEF · INT → čtení záměru a jistota fám. Zdroj (Res) = energie v boji; bylinkář má mana.</p>
            </details>
            <details class="faq-item" name="faq">
              <summary>Jak se počítá ATK / DEF?</summary>
              <p>ATK ≈ STR + bonus zbraně/výzbroje. DEF ≈ floor(VIT × 0.5) + zbroj. Přesnější vzorce a metriky doladíme; teď rough prototyp.</p>
            </details>
            <details class="faq-item" name="faq">
              <summary>Boj: co dělat?</summary>
              <p>Sleduj telegraph nepřítele. Rychlý / Těžký / Obrana mají výhody podle záměru. Spam jen útok ≠ optimum. Detail: docs/reference/combat.md.</p>
            </details>
          </div>`,
      },
      terms: {
        title: "Podmínky",
        html: `<p>Land of Machala je indie textová hra. Účet slouží jen tobě, bez botů a obchodu za reálné peníze.</p>
          <p>Pro provoz držíme e-mail a herní data; nesdílíme je k marketingu. Účet <strong>deaktivuješ</strong> ve hře (Nastavení → Smazat). Data se skryjí. Do <strong>14 dnů</strong> lze požádat o obnovení; pak trvalý výmaz. Službu můžeme upravit nebo ukončit.</p>
          <p class="muted">Virtuální předměty nemají hotovostní hodnotu mimo hru.</p>`,
      },
    };
    const doc = docs[state.legalDoc] || docs.faq;
    title.textContent = doc.title;
    body.innerHTML = `<div class="panel-scroll panel-stack" data-scroll="legal">${doc.html}</div>`;
  }
  restorePanelScroll();
}

function choiceIsPicked(choice) {
  if (choice.cheek) return !state.prologDone.class && (state.prologCheek || 0) > 0;
  if (choice.class) return state.prologDone.class && state.picks.class === choice.class;
  if (choice.race) return state.prologDone.race && state.picks.race === choice.race;
  if (choice.origin) return state.prologDone.origin && state.picks.origin === choice.origin;
  if (choice.react) return state.prologReact === choice.react;
  return false;
}

/** Okraj seznamu, který jde scrollovat, se zeslabí (fade): ukáže, že pokračuje nahoru či dolů. */
function bindScrollFade(el) {
  if (!el) return;
  const update = () => {
    el.classList.toggle("fade-top", el.scrollTop > 2);
    el.classList.toggle("fade-bottom", el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };
  if (!el.dataset.fade) {
    el.dataset.fade = "1";
    el.addEventListener("scroll", update, { passive: true });
  }
  update();
  requestAnimationFrame(update);
}

/** Tělo volby v prologu: gesto (kurzíva) a/nebo řeč v uvozovkách, v libovolném pořadí. */
function choiceBodyHtml(c) {
  const act = (t) => `<em class="choice-act">${nbspCzech(t)}</em>`;
  const parts = [];
  if (c.act) parts.push(act(c.act));
  if (c.say) parts.push(`„${nbspCzech(c.say)}“`);
  if (c.title) parts.push(nbspCzech(c.title, { tail: true }));
  if (c.actAfter) parts.push(act(c.actAfter));
  return parts.join(" ");
}

let lastOriginStep = -1;

function renderOrigins() {
  const step = ORIGIN_STEPS[state.originStep];
  const box = $("origins-box");
  if (!box || !step) return;
  const letters = ["A", "B", "C", "D", "E", "F"];
  const maxReached = Math.max(state.originStep, state.originReached || 0);
  state.originReached = maxReached;
  /* po první volbě šipky; → i na Původ (poslední seg flow) */
  const showArrows = maxReached > 0 || state.prologDone.class || state.prologDone.race;
  const canBack = showArrows && state.originStep > 0;
  const canFwd =
    showArrows &&
    (state.originStep < maxReached ||
      (state.originStep === ORIGIN_STEPS.length - 1 && maxReached >= state.originStep));
  const chrome = showArrows
    ? screenChrome({
        label: "Prolog",
        backAct: "origin-back",
        canBack,
        fwdAct: "origin-fwd",
        canFwd,
        segsHtml: flowSegsHtml(state.originStep),
      })
    : screenChrome({ label: "Prolog", segsHtml: flowSegsHtml(state.originStep) });
  const stepChanged = lastOriginStep !== state.originStep;
  lastOriginStep = state.originStep;
  /* mezivěta po reakci na zvon: krok „domov“ na ni navazuje */
  const lead = step.lead ? step.lead[pickedClass() || "none"] : "";
  const bridge = state.prologBridges?.[state.originStep - 1] || ""; /* Svatavina odpověď nebo následek předchozí volby */
  if (!state.kodexSeen) state.kodexSeen = new Set();
  const bodyRaw = [bridge, lead, step.text]
    .filter(Boolean)
    .join("\n")
    .split("\n")
    .map((para) => `<p class="prose-beat origin-text">${nbspCzech(para, { tail: true })}</p>`)
    .join("");
  const bodyHtml = LOM.Kodex.annotate(bodyRaw, state.kodexSeen, { prefs: state.prefs });
  box.innerHTML = `
    ${chrome}
    <div class="origin-body">${bodyHtml}</div>
    ${state.prologReply && step.pick === "class" ? `<p class="prose-beat origin-reply">${nbspCzech(state.prologReply)}</p>` : ""}
    <div class="choice-stack">
      ${step.choices
        .map((c, i) => {
          const picked = choiceIsPicked(c);
          const letter = letters[i] || String(i + 1);
          return `<button type="button" class="choice btn-action${picked ? " picked" : ""}" style="--i:${i}" data-origin-choice="${i}" aria-pressed="${picked}">
            <strong><span class="choice-letter">${letter}</span> ${choiceBodyHtml(c)}</strong>
            ${c.hint ? `<span class="btn-hint">${c.hint}</span>` : ""}
          </button>`;
        })
        .join("")}
    </div>
    `;
  box.classList.toggle("step-in", stepChanged);
  if (stepChanged) revealText(box.querySelector(".origin-body"));
  bindScrollFade(box.querySelector(".choice-stack"));
}

/**
 * prose + thread[] - konverzace se appenduje (ne přepisuje).
 * Každý turn: { you?, foe?, scene?, fresh? }
 */
function townLogHtml(prose, threadOrFeedback) {
  const parts = [];
  if (prose) parts.push(`<p class="log-bubble scene">${prose}</p>`);
  const thread = normalizeThread(threadOrFeedback);
  const last = thread.length - 1;
  thread.forEach((fb, i) => {
    const isLast = i === last;
    const youFresh = isLast && fb.you && fb.fresh !== "foe" ? " fresh" : "";
    const foeFresh = isLast && fb.foe && fb.fresh !== "you" ? " fresh" : "";
    const sceneFresh = isLast && fb.scene ? " fresh" : "";
    if (fb.scene) parts.push(`<p class="log-bubble scene${sceneFresh}">${fb.scene}</p>`);
    if (fb.you) parts.push(`<p class="log-bubble you${youFresh}">${fb.you}</p>`);
    if (fb.foe) parts.push(`<p class="log-bubble foe${foeFresh}">${fb.foe}</p>`);
    if (fb.sys) parts.push(`<p class="log-bubble sys${isLast ? " fresh" : ""}">${fb.sys}</p>`);
  });
  return `<div class="log-duel log-town">${parts.join("")}</div>`;
}

function normalizeThread(threadOrFeedback) {
  if (!threadOrFeedback) return [];
  if (Array.isArray(threadOrFeedback)) {
    return threadOrFeedback.map((t) => normalizeFeedback(t)).filter((t) => t.you || t.foe || t.scene || t.sys);
  }
  const one = normalizeFeedback(threadOrFeedback);
  return one.you || one.foe || one.scene || one.sys ? [one] : [];
}

function normalizeFeedback(feedback) {
  if (!feedback) return {};
  if (typeof feedback === "string") return { you: feedback, fresh: "you" };
  return {
    you: feedback.you || null,
    foe: feedback.foe || null,
    scene: feedback.scene || null,
    sys: feedback.sys || null,
    fresh: feedback.fresh || (feedback.foe ? "foe" : feedback.you ? "you" : feedback.scene ? "scene" : null),
  };
}

/* Varianty vět (js/systems/variants.js): pickV je čisté (smí se volat z renderu), sayV zvedá čítač (jen z obsluhy akcí). */
const pickV = (key, text, n = 0) => LOM.Variants.pick(text, state.seed, key, n);
function sayV(key, text) {
  if (!Array.isArray(text)) return text;
  const n = state.vc[key] || 0;
  state.vc[key] = n + 1;
  return pickV(key, text, n);
}
const sayBeat = (key, beat) => (beat ? { ...beat, you: sayV(`${key}:you`, beat.you), foe: sayV(`${key}:foe`, beat.foe) } : beat);
const visitN = (placeKey) => state.visits[placeKey] || 0;

/** Popis místa (varianta podle návštěvy); na bráně se Petr večer „vymění“ (dvojník: skoro stejný, jen drobný detail). */
function placeProse(placeKey) {
  const p = PLACE[placeKey];
  const prose = p ? pickV(`prose:${placeKey}`, p.prose, visitN(placeKey)) : "";
  if (placeKey === "gate" && LOM.isNight(state.clock)) {
    return `${prose} Je to Petr. Jenom možná s dýmkou. Nebo ji měl vždycky?`;
  }
  return prose;
}

/** Osoby přítomné na místě: hostitel (`npc`) vždy, další podle `when` ({ phases, chance }; šance se hází ze seedu a dne). */
function placePeople(placeKey) {
  const p = PLACE[placeKey];
  if (!p) return [];
  const phase = LOM.phaseOf(state.clock).id;
  const others = (p.people || []).filter((x) => {
    const w = x.when || {};
    if (w.phases && !w.phases.includes(phase)) return false;
    if (w.chance != null && LOM.Variants.hash(state.seed, `here:${placeKey}:${x.id}:${state.clock.day}`, 0) / 4294967296 >= w.chance) return false;
    return true;
  });
  return [{ id: "host", name: p.npc, role: p.role || "", host: true }, ...others.map((x) => (x.generated ? regularOf(placeKey, x) : x))];
}
/** Vedlejší postava s generovaným jménem (people[].generated): stálá po celý den, seed ze seedu hry, místa a dne. */
function regularOf(placeKey, x) {
  const key = `${placeKey}:${x.id}:${state.clock.day}`;
  if (!state.regulars) state.regulars = {};
  if (!state.regulars[key]) {
    if (!state.usedNames) state.usedNames = new Set();
    const rng = LOM.createRng(LOM.Variants.hash(state.seed, `regular:${key}`, 0));
    state.regulars[key] = LOM.Names.makeRegular(rng, { used: state.usedNames });
  }
  const r = state.regulars[key];
  return { ...x, name: escapeHtml(r.name.full), persona: r };
}
/** Osoba, se kterou právě mluvíš (když odešla, tak hostitel). */
function curPerson(placeKey = state.place) {
  const list = placePeople(placeKey);
  return list.find((x) => x.id === state.placeWho) || list[0];
}

function placeLogHtml(placeKey) {
  const p = PLACE[placeKey];
  if (!p) return townLogHtml("", state.placeThread);
  return townLogHtml(placeProse(placeKey), state.placeThread);
}

function pushPlaceTurn(partial) {
  state.placeThread.push(normalizeFeedback(partial));
  if (state.placeThread.length > 10) state.placeThread.shift();
}

function clearPlaceThread() {
  state.placeThread = [];
}

/**
 * Důležitá událost (fáma, ověření, verdikt, úkol, úroveň, lhůta) = trvalá řádka `.log-bubble.sys`
 * v aktuálním vlákně: boj → bojový log, místo → placeThread, jinak cellThread (mapa / náměstí).
 * Nevolá render() (smí se volat i z něj); volající po ní překreslí. Pokud je přes hru panel
 * (nebo není log), zůstane navíc krátký toast, ať to hráč nepřehlédne.
 */
function logSys(html, icon = "📓") {
  const sys = `<span class="sys-ico" aria-hidden="true">${icon}</span><span>${html}</span>`;
  let logged = true;
  if (state.screen === "combat" && state.combat) {
    state.combat.turns.push({ you: null, foe: null, meta: null, sys });
    state.log = renderCombatLogHtml();
  } else if (state.screen !== "town") {
    logged = false;
  } else if (state.mode === "place" && state.place) {
    pushPlaceTurn({ sys, fresh: "sys" });
  } else {
    state.cellThread.push(normalizeFeedback({ sys, fresh: "sys" }));
    if (state.cellThread.length > 6) state.cellThread.shift();
  }
  const panelOpen = !$("panel")?.classList.contains("hidden");
  if (!logged || panelOpen) {
    const tmp = document.createElement("span");
    tmp.innerHTML = html;
    toast(`${icon} ${tmp.textContent}`);
  }
}

const DIALOG_DELAY_MS = 520;

/** you hned; foe se zpožděním (jako bojový log) */
function pushDialogBeat(beat) {
  if (!beat?.you) {
    render();
    return;
  }
  const youLine = beat.you;
  pushPlaceTurn({ you: youLine, fresh: "you" });
  render();
  if (!beat.foe) return;
  setTimeout(() => {
    if (state.mode !== "place") return;
    const last = state.placeThread[state.placeThread.length - 1];
    if (last && last.you === youLine && !last.foe) {
      last.foe = beat.foe;
      last.fresh = "foe";
      render();
    }
  }, DIALOG_DELAY_MS);
}

/** Dialog strom: všechny volby najednou; children = vnořená úroveň */
const PLACE_ASK = {
  healer: [
    {
      id: "news",
      title: `Zeptat se, co je ${hl("nového")}`,
      hint: "zprávy z města",
      ask: `„Co je nového ve městě?“`,
      ans: [`„Stejný den jako včera. Drž se bran.“`, `„Nic, co by se nedalo ošetřit. Zatím.“`, `„Město dýchá, ale špatně spí.“`],
      children: [
        {
          id: "news_night",
          title: `Zeptat se na ${hl("noc")}`,
          hint: "hlídky",
          ask: `„A v noci?“`,
          ans: `„Hlídky jsou nervózní. Pes u brány štěká do tmy.“`,
        },
      ],
    },
    {
      id: "wolves",
      title: `Zeptat se na ${hl("vlky")} za hradbami`,
      hint: "zranění · jed",
      ask: `„A co ti vlci za hradbami?“`,
      ans: `„Rány od nich mají jedovatý zápach. Něco je štve z lesa.“`,
      children: [
        {
          id: "wolves_cure",
          title: `Zeptat se na ${hl("protijed")}`,
          hint: "léčba",
          ask: `„Máš na to protijed?“`,
          ans: `„Ano, v nabídce. Bez něj se rána kazí.“`,
        },
        {
          id: "wolves_where",
          title: `Zeptat se, ${hl("kde")} je potkat`,
          hint: "les",
          ask: `„Kde je nejčastěji potkáš?“`,
          ans: `„Severní cesta do hvozdu. Nechoď sám.“`,
        },
      ],
    },
    {
      id: "help",
      title: `Nabídnout ${hl("pomoc")}`,
      hint: "možný úkol",
      ask: `„Můžu nějak pomoci?“`,
      ans: `„Ano. Vlci z lesa trhají pocestné a rány jim hnisají. Dva z nich a budu klidnější. Zaplatím.“`,
    },
    {
      id: "strange",
      title: `Zeptat se na ${hl("divné")} věci u kaple`,
      hint: "noc · pověsti",
      ask: `„Neslyšel jsi něco divného u kaple?“`,
      ans: `„Vlci utíkají z lesa a v noci je u kaple cosi divného.“`,
      claim: "c5",
    },
    {
      id: "herbs",
      title: `Zeptat se na ${hl("byliny")}`,
      hint: "sběr",
      ask: `„Sbíráš ještě byliny z okolí?“`,
      ans: [`„Když někdo donese čerstvé, rád směním za odvar.“`, `„Čerstvé sbírám jen já. Ale na dobrou radu se nezlobím.“`],
    },
  ],
  smith: [
    {
      id: "work",
      title: `Zeptat se na ${hl("práci")}`,
      hint: "nálada kováře",
      ask: `„Jak jde kování?“`,
      ans: `„Ocel drží, lidé méně.“`,
    },
    {
      id: "jobs",
      title: `Zeptat se na ${hl("zakázky")}`,
      hint: "práce za odměnu",
      ask: `„Máš nějaké zakázky?“`,
      ans: `„Někdo nosí rezavé čepele. Chci je na rozbor.“`,
      children: [
        {
          id: "jobs_pay",
          title: `Zeptat se na ${hl("odměnu")}`,
          hint: "zlato",
          ask: `„Co za to dáváš?“`,
          ans: `„Pár mincí a ostření zdarma. Donášku beru.“`,
        },
      ],
    },
    {
      id: "steel",
      title: `Zeptat se na vlky a ${hl("ocel")}`,
      hint: "rady do lesa",
      ask: `„Zvládne ocel ty vlky?“`,
      ans: `„Zuby drásají i kroužky. Sežeň lepší ocel, než půjdeš do lesa.“`,
    },
  ],
  bank: [
    {
      id: "letter",
      title: `Zeptat se na ${hl("poštu")}`,
      hint: "možný úkol",
      ask: `„Nemáte něco k doručení?“`,
      ans: `„Zapečetěný dopis do vsi Lada. Cesta na jih je klidná. Doručíš?“`,
    },
    {
      id: "bell",
      title: `Zeptat se na ${hl("zvon")} z kaple`,
      hint: "listiny · vklad",
      ask: `„Nevíte něco o zvonu z kaple?“`,
      ans: `„Zástava na zvon neběží. Hotovost z prodeje měla dojít sem.“`,
      claim: "c4",
      when: () => kauzaStarted(),
    },
    {
      id: "vault",
      title: `Zeptat se na ${hl("trezor")}`,
      hint: "bezpečnost zlata",
      ask: `„Je trezor opravdu bezpečný?“`,
      ans: `„Tvé zlato spí bezpečněji než ty.“`,
    },
    {
      id: "fees",
      title: `Zeptat se na ${hl("poplatky")}`,
      hint: "cena úschovy",
      ask: `„Kolik berete za úschovu?“`,
      ans: `„Úschova je zdarma. Výběr taky, dokud nejsi mrtvý.“`,
    },
  ],
  tavern: [
    {
      id: "prolog_fight",
      title: `Připomenout ${hl("noc")} se sudem`,
      hint: "prolog · šel jsi ven",
      when: () => state.prologReact === "fight",
      ask: `„Tehdy jsem šel ven za zvonem. Nic jsem nenašel.“`,
      ans: `„Viděla jsem tě jít. Vrátil ses s prázdnou, jako ten zvon. Sud pořád leží ve sklepě.“`,
    },
    {
      id: "prolog_hide",
      title: `Připomenout ${hl("noc")} se sudem`,
      hint: "prolog · zůstal jsi",
      when: () => state.prologReact === "hide",
      ask: `„Tehdy jsem zůstal sedět. Sud i zvon, obojí najednou.“`,
      ans: `„Sedět umíš. Sud je ve sklepě. A zvon? Lidi šeptají. Ptej se.“`,
    },
    {
      id: "prolog_ward",
      title: `Připomenout ${hl("noc")} se sudem`,
      hint: "prolog · křížek",
      when: () => state.prologReact === "ward",
      ask: `„Tehdy jsem sevřel křížek. Sud stejně praskl.“`,
      ans: `„Modlitba sud neslepí. Podívej se dolů, až budeš chtít vědět, odkud byly mince.“`,
    },
    {
      id: "rumors",
      title: `Zeptat se na ${hl("drby")}`,
      hint: "fámy u stolu",
      ask: `„Co se šeptá u stolu?“`,
      ans: `„Ten sud praskl a od kaple zvonil zvon, kterého tam není. Peníze na sud prý od farnosti.“`,
      claim: "c1",
    },
    {
      id: "bread",
      title: `Zeptat se na ${hl("chléb")}`,
      hint: "zásoby · úkol",
      ask: `„Nemáš čerstvý chléb?“`,
      ans: `„Dodávka z pekárny se ztratila. Kdybys donesl kůrku od Emy…“`,
      children: [
        {
          id: "bread_ema",
          title: `Zeptat se na ${hl("Emu")}`,
          hint: "pekárna",
          ask: `„Kde najdu Emu?“`,
          ans: `„Na tržišti. Řekni, že tě posílá Svatava.“`,
        },
      ],
    },
    {
      id: "lady",
      title: `Zeptat se na cestu do ${hl("Lady")}`,
      hint: "mapa · tip",
      ask: `„Která cesta do Lady je klidnější?“`,
      ans: `„Jižní. Petr u brány má dopis.“`,
    },
  ],
  gate: [
    {
      id: "zvon",
      title: `Zeptat se na ${hl("zvon")} z kaple`,
      hint: "co se povídá",
      ask: `„Slyšel jsi něco o zvonu z kaple?“`,
      ans: `„Farář ho prodal. Ví to celé město.“`,
      claim: "c2",
    },
    {
      id: "watch",
      title: `Zeptat se na ${hl("hlídky")}`,
      hint: "kdo kdy stojí na bráně",
      ask: `„Kdo tu hlídá v noci?“`,
      ans: [`„Já. Nebo ten druhý. Je to jedno.“`, `„Já. A ve tmě taky já. Je to stejný Petr.“`, `„Střídáme se. Já a… no, já.“`],
    },
    {
      id: "licence",
      title: `Zeptat se na ${hl("lovecký lístek")}`,
      hint: "razítko na vlka",
      ask: `„Potřebuju lístek na lov vlka?“`,
      ans: `„Lístek. Razítko. Radnice. Tak to chodí.“`,
    },
  ],
  townhall: [
    {
      id: "hours",
      title: `Zeptat se na ${hl("úřední hodiny")}`,
      hint: "kdy otevřeno",
      ask: `„Kdy tu je otevřeno?“`,
      ans: `„Vždy, když tu někdo sedí. Dnes tu sedím já.“`,
    },
    {
      id: "fee",
      title: `Zeptat se na ${hl("poplatky")}`,
      hint: "nahlédnutí do listin",
      ask: `„Kolik stojí nahlédnutí do knih?“`,
      ans: `„Pět grošů za knihu. Poplatek za vzduch a za pohled.“`,
    },
    {
      id: "auction",
      title: `Zeptat se na ${hl("lhůtu")} zvonu`,
      hint: "přelití v hutích",
      ask: `„Slyšel jsem, že zvon mají přelít.“`,
      ans: `„Pět dní od oznámení. Kdo doplatí střechu, Matěj zvon vrátí. Jinak jde do pece.“`,
      when: () => kauzaStarted(),
    },
  ],
  market: [
    {
      id: "prices",
      title: `Zeptat se na ${hl("ceny")}`,
      hint: "trh dnes",
      ask: `„Jak jsou dnes ceny?“`,
      ans: `„Chléb drží, odvary zdražily.“`,
    },
    {
      id: "forest",
      title: `Zeptat se na zboží z ${hl("lesa")}`,
      hint: "výkup trofejí",
      ask: `„Kupuješ něco z lesa?“`,
      ans: `„Zuby vlka. Kůži taky, když není plná blech.“`,
    },
  ],
};

/** Klíč hotových otázek: hostitel = klíč místa, další osoba = „místo:osoba“. */
const talkKey = (placeKey) => (curPerson(placeKey)?.host ? placeKey : `${placeKey}:${state.placeWho}`);
function talkNodesAt(placeKey) {
  const who = curPerson(placeKey);
  let nodes = (who && !who.host ? who.talk : PLACE_ASK[placeKey]) || [];
  for (const id of state.placeTalkPath || []) {
    const n = nodes.find((x) => x.id === id);
    nodes = n?.children || [];
  }
  nodes = nodes.filter((n) => !n.when || n.when());
  /* po rozuzlení fámy se u toho, kdo ji řekl, objeví „Vrátit se k věci“ (jednou; věty podle dřívějšího názoru a dopadu) */
  if (!state.placeTalkPath?.length && (!who || who.host)) nodes = nodes.concat(kauzaFollowNodes(placeKey));
  return nodes;
}

/** Uzly „Vrátit se k věci“ pro fámy s místem `placeKey` (jen rozuzlené a ještě nevyužité). */
function kauzaFollowNodes(placeKey) {
  if (!kauzaStarted()) return [];
  const k = state.kauza;
  return Object.keys(k.claims)
    .filter((cid) => KZ.claims[cid].place === placeKey)
    .map((cid) => ({ cid, f: LOM.Kauza.follow(k, cid) }))
    .filter((x) => x.f.available)
    .map(({ cid, f }) => ({ id: `kzback:${cid}`, title: "Vrátit se k věci", hint: f.hint, ask: f.you, ans: f.pool, follow: cid }));
}

function talkOptionsHtml(placeKey) {
  const done = state.placeTalkDone[talkKey(placeKey)] || {};
  const nodes = talkNodesAt(placeKey).filter((n) => !done[n.id]);
  if (!nodes.length) return "";
  return nodes
    .map((n) =>
      actionBtn({
        title: n.title,
        hint: n.hint,
        act: "place-ask",
        attrs: `data-ask="${n.id}"`,
        story: true,
      })
    )
    .join("");
}

function dirHint(dx, dy) {
  const nx = state.mapX + dx;
  const ny = state.mapY + dy;
  if (terrainAt(nx, ny) == null) return "okraj mapy";
  const sp = !LOM.isNight(state.clock) && LOM.spotAt(ensureSpots(), nx, ny, state.clock);
  return `${cellLabel(nx, ny)} (${nx},${ny})${sp ? ` · ⚠ ${SIGN_TEXT[sp.enemyId]}` : ""}`;
}

function travelProse() {
  const t = terrainAt(state.mapX, state.mapY);
  /* souřadnice / název = kontext box; log = jen atmosféra */
  const flavor = {
    town: "Ulice hučí, někde cinká kovárna.",
    village: "Nízké chalupy a pach slámy.",
    road: "Prach cesty a stopy vozů.",
    plains: "Široký horizont, vítr v trávě.",
    forest: "Stíny mezi kmeny. Něco zapraská.",
    hills: "Kamení pod nohama, výhled daleko.",
    chapel: "Ticho a chlad kamenné kaple.",
  };
  return flavor[t] || "Krajina kolem mlčí.";
}

function refillTravel() {
  state.travel.energy = state.travel.energyMax;
}

function moveMap(dx, dy) {
  const nx = state.mapX + dx;
  const ny = state.mapY + dy;
  if (terrainAt(nx, ny) == null) {
    toast("Tudy dál nejde.");
    return false;
  }
  if (state.travel.energy <= 0) {
    toast("Došla výdrž. Vrať se do města odpočinout.");
    return false;
  }
  state.travel.energy -= 1;
  state.prevX = state.mapX;
  state.prevY = state.mapY;
  state.mapX = nx;
  state.mapY = ny;
  state.clock = LOM.advanceClock(state.clock, LOM.TIME_COST.step);
  state.cellThread = [];
  state.cellMenu = null;
  discoverCell(nx, ny);
  [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([ox, oy]) => {
    if (terrainAt(nx + ox, ny + oy)) discoverCell(nx + ox, ny + oy);
  });
  /* vstup na město = hub (služby), ne zůstat v režimu směrů */
  if (isInTownZone() && state.mode === "exits") {
    state.mode = "town";
    state.place = null;
    state.log = TOWN_PROSE;
    refillTravel();
    toast("Vstupuješ do města. Výdrž doplněna.");
  } else if (!isInTownZone()) {
    checkSpotEncounter();
  }
  state.corpseSkip = null;
  questEvent("arrive");
  pilesArrive();
  if (corpseHere()) toast("Tady leží tvé věci.");
  return true;
}

const ENCOUNTER_TEXT = {
  wolf: "Z podrostu se ozve zavrčení. Cestu ti zastoupí vlk.",
  boar: "Křoví praská. Z hustníku vyrazí divočák.",
  bandit: "Na cestě stojí bandita s kyjem a nevypadá, že chce jen pozdravit.",
  brigand: "Zpoza kamenů vystoupí zbojník. Nespěchá. Ví, že ty ano.",
};

function ensureSpots() {
  if (!state.spots) state.spots = LOM.buildSpots(state.seed, terrainAt);
  return state.spots;
}

/** Vstup na políčko s aktivním místem = setkání (stejné místo ve stejný den = stejný souboj). */
function checkSpotEncounter() {
  const spot = LOM.spotAt(ensureSpots(), state.mapX, state.mapY, state.clock);
  state.encounter = spot ? { enemyId: spot.enemyId, spotId: spot.id, seed: LOM.spotFightSeed(state.seed, spot, state.clock.day) } : null;
}

/** Stopy na sousedních políčkách (jen ve dne): [{ word, label, enemy }] */
function spotSignsNow() {
  return LOM.spotSigns(ensureSpots(), state.mapX, state.mapY, state.clock);
}

const SIGN_TEXT = { wolf: "stopy vlka", boar: "ryté kořeny po divočákovi", bandit: "kouř z ohniště", brigand: "kouř z ohniště a zbroj na větvi" };

function corpseHere() {
  return state.corpses.find((c) => c.x === state.mapX && c.y === state.mapY) || null;
}


/* ---------- kauza Zvon (pravidla: js/systems/kauza.js, data: js/data/kauzy.js) ---------- */
const KZ = LOM.KAUZY.zvon;
const LOOKUP_CLAIM = { lookup_priest: "c2", lookup_deed: "c4" };
const OMEN_FLAVOR = {
  chanter: " Jako bylinkář cítíš, že chlad vane z místa, kde zvon visel. Nebo ti to jen připadá.",
  tracker: " Dřevorubec v tobě slyší, že les se od kaple vzdaluje. Zvěř ví víc než lidé.",
  mercenary: " Pacholek v tobě nechává tuhle hrůzu spíš chladnou. Přesto sis zvedl límec.",
  legist: " Písař v tobě hledá pečeť, zápis, důvod. Nic tu není. Zůstává jen chlad.",
};

function kauzaState() {
  if (!state.kauza) state.kauza = LOM.Kauza.newKauza(state.seed);
  return state.kauza;
}
const kauzaStarted = () => !!state.kauza && LOM.Kauza.started(state.kauza);
/** Zápisník: stačí seed fáma (bez lhůty). Lhůta/služby = kauzaStarted. */
const kauzaHasClaims = () => !!state.kauza && LOM.Kauza.hasClaims(state.kauza);

/** Hláška do dialogu: na místě do threadu místa, na políčku do cellThread. */
function kzSay(partial) {
  if (state.mode === "place") feedback(partial);
  else {
    state.cellThread.push(normalizeFeedback(partial));
    if (state.cellThread.length > 6) state.cellThread.shift();
  }
}

/** Text řádky o výsledku ověření (do logu až po scéně, ať drží pořadí). */
function kzStatusLine(cid, r) {
  const t = r.status === "refuted" ? "✗ vyvráceno" : r.status === "open" ? "nic nevyřešeno" : r.truth === "half" ? "◐ napůl pravda" : "✓ ověřeno";
  return `${KZ.claims[cid].text} · <strong>${t}</strong>`;
}

/** Nová fáma: puntík u Úkolů a řádka do logu; `defer` = řádku vrátí v `r.sys`, volající ji zapíše po dialogu. */
function kauzaHear(cid, via, { defer = false } = {}) {
  const r = LOM.Kauza.hear(kauzaState(), cid, { day: state.clock.day, via });
  if (r.isNew) {
    state.notebookNew = true;
    const sys = `Zápisník, nová fáma: ${KZ.claims[cid].text}`;
    if (defer) r.sys = sys;
    else logSys(sys);
  }
  return r;
}

/** Ušetřený bandita: drobná stopa (ne jádro kauzy; c6 je teď od Ondry u hutí). */
function kauzaOnSpare(enemyId) {
  if (enemyId !== "brigand" && enemyId !== "bandit") return null;
  return null;
}

function kauzaLookup(id) {
  const k = kauzaState();
  const cid = LOOKUP_CLAIM[id];
  const rec = k.claims[cid];
  if (!rec) {
    kzSay("Nevíš, na co se ptát. Nejdřív se poslechni po městě.");
    return;
  }
  if (rec.status === "verified" || rec.status === "refuted") {
    kzSay("Tohle už máš ověřené.");
    return;
  }
  if (!spend(servicePrice("townhall", { id, price: 5 }))) return;
  const r = LOM.Kauza.verify(k, cid, { via: "clerk", day: state.clock.day });
  kzSay({ scene: r.text, fresh: "scene" });
  logSys(kzStatusLine(cid, r));
}

function kauzaVerdict(id) {
  const k = kauzaState();
  const v = KZ.verdicts[id];
  const ctx = { at: v.at, hasBell: bagCount("bell") > 0, gold: state.gold };
  if (!LOM.Kauza.canVerdict(k, id, ctx)) {
    toast(v.needs?.gold && state.gold < v.needs.gold ? `Nemáš dost zlata · ${STAT_BY.gold.icon}${state.gold} / ${STAT_BY.gold.icon}${v.needs.gold}` : "Tohle teď nejde.");
    return false;
  }
  const r = LOM.Kauza.chooseVerdict(k, id, ctx, state.clock.day);
  state.gold += r.effects.gold;
  r.effects.flags.forEach((f) => (state.flags[f] = true));
  if (r.effects.consumeBell) {
    bagConsume("bell");
    k.facts.bellGone = true;
  }
  kzSay({ scene: r.epilogue, fresh: "scene" });
  logSys(`Verdikt: <strong>${v.label}</strong>${r.effects.gold ? ` · ${STAT_BY.gold.icon}${r.effects.gold > 0 ? "+" : ""}${r.effects.gold}` : ""}`);
  render();
  return true;
}

/** Po uplynutí lhůty rozhodne svět; volá se z render() (jako questRefresh). */
function kauzaTick() {
  if (!kauzaStarted()) return;
  const r = LOM.Kauza.checkDeadline(state.kauza, state.clock);
  if (!r) return;
  r.effects.flags.forEach((f) => (state.flags[f] = true));
  logSys(r.epilogue, "⏳");
}

const CERT_CLS = { ověřeno: "ok", vyvráceno: "bad", jistě: "sure", tuším: "maybe", nejasné: "vague" };

/** Čeká odpověď na fámu tady? (rozhovor na místě / políčko mapy); nevynucuje se, odejít jde kdykoli. */
function kzReplyActive(ctx) {
  const r = state.kzReply;
  if (!r || r.ctx !== ctx) return false;
  if (ctx === "place") return state.mode === "place" && state.placeView === "talk" && state.place === r.place;
  return state.mode !== "place" && state.mapX === r.at[0] && state.mapY === r.at[1];
}

/** Volby odpovědi (věřím / pochybuju / poznamenám si); text střídá varianty, podtext prozrazuje záměr. */
function kzReplyHtml() {
  const r = state.kzReply;
  return LOM.Kauza.replies(kauzaState())
    .map((o) => {
      const key = `kzreply:${r.cid}:${o.id}`;
      return actionBtn({ title: pickV(key, o.you, state.vc[key] || 0), hint: o.hint, act: "kz-reply", attrs: `data-reply="${o.id}"`, story: true });
    })
    .join("");
}

/** Hráč odpověděl na fámu: názor se zapíše, NPC zareaguje jednou větou (neutrální = bez reakce). */
function kauzaReply(stance) {
  const r = state.kzReply;
  if (!r) return;
  state.kzReply = null;
  const k = kauzaState();
  const opt = LOM.Kauza.replies(k).find((o) => o.id === stance);
  const res = LOM.Kauza.answer(k, r.cid, stance, state.clock.day);
  if (!opt || !res.ok) return render();
  const you = sayV(`kzreply:${r.cid}:${stance}`, opt.you);
  const foe = res.pool ? sayV(`kzreact:${r.cid}:${stance}`, res.pool) : null;
  if (r.ctx === "place") return pushDialogBeat({ you, foe });
  kzSay({ you, fresh: "you" });
  render();
  if (!foe) return;
  setTimeout(() => {
    if (state.mode === "place") return;
    kzSay({ foe, fresh: "foe" });
    render();
  }, DIALOG_DELAY_MS);
}

function kzBtn(act, title, hint, type) {
  return actionBtn({ title, hint, act, type, story: true });
}

/** Akce na políčkách kaple, vozu a hutí (mimo město). */
function kauzaCellButtonsHtml() {
  const k = kauzaState();
  const at = (c) => c[0] === state.mapX && c[1] === state.mapY;
  const night = LOM.isNight(state.clock);
  const out = [];
  if (kzReplyActive("cell")) out.push(kzReplyHtml());
  if (at(KZ.chapel.cell)) {
    if (!night && !k.claims.c3) out.push(kzBtn("kz-anicka", `Promluvit s ${hl("Aničkou")}`, "zvoníkova dcera u kaple"));
    const back = !night && LOM.Kauza.follow(k, "c3");
    if (back && back.available) out.push(kzBtn("kz-back", "Vrátit se k věci", back.hint));
    if (night) out.push(kzBtn("kz-omen", `Naslouchat ${hl("znamením")} v kapli`, "noc · tady se ověří, co ve dne nejde"));
    if (!k.verdict && bagCount("bell") > 0) out.push(kzBtn("kz-return", `Odevzdat ${hl("zvon")} Aničce`, "vrátit do kaple", "primary"));
  }
  if (at(KZ.cart.cell)) {
    out.push(kzBtn("kz-cart", `Prohlédnout ${hl("vůz")}`, "malý zvon · stopa"));
  }
  if (at(KZ.forge.cell)) {
    if (!k.claims.c6) out.push(kzBtn("kz-ondra", `Promluvit s ${hl("Ondrou od vozu")}`, "posel u pece"));
    const back6 = LOM.Kauza.follow(k, "c6");
    if (back6 && back6.available) out.push(kzBtn("kz-back6", "Vrátit se k věci", back6.hint));
    out.push(kzBtn("kz-forge", `Prohlédnout ${hl("hutě")}`, "pec · zvon · Matěj"));
    if (k.facts.forgeSeen && !hasItemAnywhere("bell") && !k.facts.bellGone && !k.verdict) {
      out.push(kzBtn("kz-bell", `Vzít ${hl("zvon")}`, `váží ${KZ.bell.weight} kg · ještě nepřelitý`, "primary"));
    }
    if (!k.verdict && bagCount("bell") > 0) {
      out.push(kzBtn("kz-forge-verdict", `Nechat zvon ${hl("Matějovi")}`, "přelití · 40 🪙", "primary"));
    }
  }
  return out.join("");
}

function kauzaCellAct(act) {
  const k = kauzaState();
  const day = state.clock.day;
  if (act === "kz-anicka") {
    const h = kauzaHear("c3", "anicka", { defer: true });
    kzSay({ you: `„Dobrý den. Co se stalo se zvonem?“`, foe: h.line, fresh: "foe" });
    if (h.signal) kzSay({ scene: `<em>${h.signal}</em>`, fresh: "scene" });
    if (h.sys) logSys(h.sys);
    state.kzReply = { cid: "c3", ctx: "cell", at: [state.mapX, state.mapY] };
  }
  if (act === "kz-back") {
    const r = LOM.Kauza.followUp(k, "c3", day);
    if (r.ok) {
      const key = r.key;
      const you = sayV(`kzfollow:c3:${key}`, KZ.follow[key].you);
      const foe = sayV(`kzafter:c3:${key}`, r.pool);
      kzSay({ you, fresh: "you" });
      render();
      setTimeout(() => {
        if (state.mode === "place") return;
        kzSay({ foe, fresh: "foe" });
        render();
      }, DIALOG_DELAY_MS);
      return;
    }
  }
  if (act === "kz-omen") {
    state.clock = LOM.advanceClock(state.clock, 1);
    let text = "Chlad a ticho. Nic konkrétního, jen pocit, že tě někdo poslouchá.";
    let sys = null;
    if (k.claims.c5) {
      const r = LOM.Kauza.verify(k, "c5", { via: "night", day });
      if (r.ok) {
        text = r.text;
        sys = kzStatusLine("c5", r);
      }
    }
    kzSay({ scene: text + (OMEN_FLAVOR[pickedClass()] || ""), fresh: "scene" });
    if (sys) logSys(sys);
  }
  if (act === "kz-cart") {
    const texts = [];
    const sysLines = [];
    if (k.claims.c3) {
      const r = LOM.Kauza.verify(k, "c3", { via: "cart", day });
      if (r.ok) {
        texts.push(r.text);
        sysLines.push(kzStatusLine("c3", r));
      }
    }
    if (!texts.length) texts.push("Vůz stojí u cesty. Na ojí visí malý zvonek. Zní skoro jako kaple, ale je to jiný.");
    const takeCartBell = !hasItemAnywhere("cart_bell") && !k.facts.cartBellTaken;
    if (takeCartBell) texts.push("Zvonek jde sejmout.");
    kzSay({ scene: texts.join(" "), fresh: "scene" });
    sysLines.forEach((l) => logSys(l));
    if (takeCartBell && bagCanFit("cart_bell")) {
      bagPut("cart_bell");
      k.facts.cartBellTaken = true;
      kzSay({ scene: "Vezmeš vozový zvonek. Není z kaple, to poznáš po váze.", fresh: "scene" });
    }
  }
  if (act === "kz-ondra") {
    const h = kauzaHear("c6", "ondra", { defer: true });
    kzSay({ you: `„Ty jsi posel od kaple?“`, foe: h.line, fresh: "foe" });
    if (h.signal) kzSay({ scene: `<em>${h.signal}</em>`, fresh: "scene" });
    if (h.sys) logSys(h.sys);
    state.kzReply = { cid: "c6", ctx: "cell", at: [state.mapX, state.mapY] };
  }
  if (act === "kz-back6") {
    const r = LOM.Kauza.followUp(k, "c6", day);
    if (r.ok) {
      const key = r.key;
      const you = sayV(`kzfollow:c6:${key}`, KZ.follow[key].you);
      const foe = sayV(`kzafter:c6:${key}`, r.pool);
      kzSay({ you, fresh: "you" });
      render();
      setTimeout(() => {
        if (state.mode === "place") return;
        kzSay({ foe, fresh: "foe" });
        render();
      }, DIALOG_DELAY_MS);
      return;
    }
  }
  if (act === "kz-forge") {
    k.facts.forgeSeen = true;
    const texts = [];
    const sysLines = [];
    if (k.claims.c6) {
      const r = LOM.Kauza.verify(k, "c6", { via: "forge", day });
      if (r.ok) {
        texts.push(r.text);
        sysLines.push(kzStatusLine("c6", r));
      }
    }
    if (!texts.length) texts.push("Žár pece, pach kovu. Matěj od pece otírá ruce. V koutě leží velký zvon z kaple, ještě celý.");
    if (!hasItemAnywhere("bell") && !k.facts.bellGone) texts.push("Zvon jde odnést, dokud nepůjde do pece.");
    kzSay({ scene: texts.join(" "), fresh: "scene" });
    sysLines.forEach((l) => logSys(l));
  }
  if (act === "kz-bell") {
    if (!bagCanFit("bell")) kzSay({ you: `Zvon váží ${KZ.bell.weight} kg. Uvolni batoh a vrať se.`, fresh: "you" });
    else {
      bagPut("bell");
      k.facts.bellTaken = true;
      kzSay({ scene: "Zvon je těžký a studený. Každý krok s ním bude pomalejší.", fresh: "scene" });
    }
  }
  if (act === "kz-forge-verdict") {
    kauzaVerdict("forge");
    return;
  }
  if (act === "kz-return") {
    kauzaVerdict("return");
    return;
  }
  render();
}

/** Zápisník: fámy se zdrojem a jistotou, lhůta, verdikt. Nevidí pravdu (jen s dev přepínačem). */
function notebookHtml() {
  if (!kauzaStarted()) return "";
  return [state.kauza].map(kauzaCardHtml).join(""); /* karta na kauzu; zatím jediná (zvon) */
}

/** Karta jedné kauzy: název, odpočet, fámy (nerozuzlené nahoře, rozuzlené sbalené), verdikt. */
function kauzaCardHtml(k) {
  const KZ = LOM.KAUZY[k.id];
  const s = statsNow();
  const dl = LOM.Kauza.deadline(k, state.clock);
  const nb = LOM.Kauza.notebook(k);
  /* fáma: zdroj, jistota, kde ověřit / výsledek; názor je jen informace (zapisuje se odpovědí v rozhovoru) */
  const row = (cid) => {
    const c = KZ.claims[cid];
    const rec = k.claims[cid];
    const cert = LOM.Kauza.certainty(k, cid, { int: s.int, classId: pickedClass(), raceId: pickedRace() });
    const resolved = cert.status === "verified" || cert.status === "refuted";
    const outcome = resolved ? (cert.outcome === "half" ? "napůl pravda" : cert.status === "refuted" ? "nepravda" : "pravda") : "";
    const note = resolved ? c.verify.texts[cert.outcome] : cert.status === "open" ? c.verify.texts.none : `Ověřit: ${c.verify.where}`;
    const stance = rec.stance !== undefined ? rec.stance : rec.belief;
    return `
        <li class="kz-claim${resolved ? " kz-resolved" : ""}">
          <strong>${c.text}</strong>
          <span class="muted">${KZ.npcs[c.by].name} · <em class="kz-cert kz-cert-${CERT_CLS[cert.label]}">${cert.label}</em>${outcome ? ` · ${outcome}` : ""}${stance ? ` · ${stance === "believe" ? "věřil jsi" : "pochyboval jsi"}` : ""}</span>
          <span class="muted q-hint">${note}</span>
          ${state.dev.truth ? `<span class="muted">[dev] pravda: ${LOM.Kauza.truthOf(k, cid)}</span>` : ""}
        </li>`;
  };
  const pendingRows = nb.pending.map(row).join("");
  const resolvedRows = nb.resolved.length
    ? `<details class="kz-done"><summary>Rozuzlené (${nb.resolved.length})</summary><ul class="q-objs kz-claims">${nb.resolved.map(row).join("")}</ul></details>`
    : "";
  const rows = pendingRows;
  const deadline = k.verdict
    ? ""
    : dl.over
      ? ""
      : `<span class="muted q-hint">${KZ.deadline.text}: zbývá ${dl.daysLeft} ${dl.daysLeft === 1 ? "den" : dl.daysLeft >= 2 && dl.daysLeft <= 4 ? "dny" : "dnů"}.</span>`;
  const keepBtn =
    !k.verdict && bagCount("bell") > 0
      ? `<div class="q-actions"><button type="button" class="btn btn-ghost q-act" data-act="kz-keep">Nechat si zvon</button></div>`
      : "";
  let verdict = "";
  if (k.verdict) {
    const ep = LOM.Kauza.epilog(k);
    verdict = `<span class="q-obj"><strong>${KZ.verdicts[k.verdict.id].label}${k.verdict.auto ? " (rozhodl svět)" : ""}.</strong> ${KZ.verdicts[k.verdict.id].epilogue}</span>
      <span class="muted q-hint">Co se stalo: ${ep.story}</span><span class="muted q-hint">${ep.open}</span>`;
  }
  const bellPile = state.piles.find((p) => p.items.some((it) => it.id === "bell"));
  const bellBody = state.corpses.some((c) => c.items.includes("bell"))
    ? `<span class="muted q-hint q-lost">💀 zvon leží v tvém těle</span>`
    : bellPile
      ? `<span class="muted q-hint q-lost">🔔 zvon ${bellPile.kind === "buried" ? "je zakopaný" : "leží"} na (${bellPile.x},${bellPile.y})</span>`
      : state.stash.items.some((e) => e.id === "bell")
        ? `<span class="muted q-hint">🔔 zvon je v úschovně u Svatavy</span>`
        : "";
  return `
        <article class="panel-card quest-card q-active">
          <div class="panel-card-top">
            <span class="panel-tile-ico" aria-hidden="true">📓</span>
            <strong>${KZ.title}</strong>
            <em class="tag">${k.verdict ? "uzavřeno" : "otevřeno"}</em>
          </div>
          <span class="q-obj">${KZ.brief}</span>
          ${deadline}${bellBody}
          ${rows ? `<ul class="q-objs kz-claims">${rows}</ul>` : ""}${resolvedRows}
          ${keepBtn}${verdict}
        </article>`;
}

/* ---------- questy (pravidla: js/systems/quests.js) ---------- */
const QUEST_DEF = LOM.QUEST_BY;
const TOWN_CELL = LOM.POI.town.cell;

function hasItemAnywhere(id) {
  return (
    state.bag.includes(id) ||
    Object.values(state.equipped).includes(id) ||
    state.stash.items.some((e) => e.id === id) ||
    state.piles.some((p) => p.items.some((it) => it.id === id)) ||
    state.corpses.some((c) => c.items.includes(id) || Object.values(c.equipped).includes(id))
  );
}

function questCtx() {
  return { count: bagCount, hasAnywhere: hasItemAnywhere, terrainAt, mapMax: MAP_MAX, townCell: TOWN_CELL, corpses: state.corpses };
}

/** Přepočítá have-cíle; nově splněný quest ohlásí. */
function questRefresh() {
  LOM.Quests.evaluate(state.quests, questCtx()).forEach((id) => {
    if (LOM.Quests.statusOf(state.quests, id) === "ready") {
      const t = QUEST_DEF[id].turnIn;
      logSys(`Úkol splněn: <strong>${QUEST_DEF[id].title}</strong>. Odevzdej ${t.cell ? `v Ladě (${t.cell})` : `u ${t.npc}`}.`, "❓");
    }
  });
}

function questEvent(kind, enemyId) {
  const hit = kind === "kill"
    ? LOM.Quests.onKill(state.quests, { enemyId, terrain: terrainAt(state.mapX, state.mapY) })
    : LOM.Quests.onArrive(state.quests, state.mapX, state.mapY);
  if (kind === "kill") {
    hit.forEach((id) => {
      const p = LOM.Quests.progressOf(state.quests, id, questCtx()).find((x) => x.obj.type === "kill");
      logSys(`Úkol: ${QUEST_DEF[id].title} <em>${p.cur}/${p.max}</em>`, "📜");
    });
  }
  questRefresh();
}

function questRewardItems(def, choiceId) {
  return def.choices ? def.choices.find((c) => c.id === choiceId)?.reward.items || [] : def.reward?.items || [];
}

function acceptQuest(id) {
  const def = QUEST_DEF[id];
  if (LOM.Quests.statusOf(state.quests, id) !== "available") return;
  const wouldGive = (def.giveItems || []).filter((i) => !hasItemAnywhere(i));
  if (wouldGive.length && !wouldGive.every((i) => bagCanFit(i))) {
    feedback("Nemáš místo v batohu. Uvolni si ho a vrať se.");
    return;
  }
  const r = LOM.Quests.accept(state.quests, id, { hasAnywhere: hasItemAnywhere });
  r.give.forEach((i) => bagPut(i));
  logSys(`Nový úkol: <strong>${def.title}</strong>. ${def.brief}`, "❗");
  questRefresh();
  render();
}

function turnInQuest(id, choiceId) {
  const def = QUEST_DEF[id];
  const where = def.turnIn.cell ? { cell: [state.mapX, state.mapY] } : { place: state.place };
  const rewardItems = questRewardItems(def, choiceId);
  const freed = (def.consume || []).filter((i) => state.bag.includes(i)).length;
  if (rewardItems.length && bagFreeIndex() < 0 && !freed) {
    kzSay({ scene: "Na odměnu nemáš místo. Uvolni batoh a vrať se.", fresh: "scene" });
    render();
    return;
  }
  const r = LOM.Quests.turnIn(state.quests, id, where, choiceId);
  if (!r.ok) {
    toast(r.reason);
    return;
  }
  r.consume.forEach(bagConsume);
  state.gold += r.reward.gold;
  r.reward.items.forEach((i) => bagPut(i));
  r.reward.flags.forEach((f) => (state.flags[f] = true));
  const levels = LOM.gainXp(state, r.reward.xp);
  if (levels) state.hp = null;
  const bits = [r.reward.gold ? `${STAT_BY.gold.icon}+${r.reward.gold}` : "", r.reward.xp ? `✦+${r.reward.xp} XP` : "", ...r.reward.items.map((i) => ITEM_BY[i].icon)].filter(Boolean).join(" · ");
  logSys(`Hotovo: <strong>${def.title}</strong> · ${bits}`, "✔");
  if (levels) logSys(`Nová úroveň! <strong>Lv ${state.level}</strong>`, "⭐");
  render();
}

/** Tlačítka questů v dock: nabídka (po příslušné otázce v rozhovoru) a odevzdání. */
function questButtonsHtml(placeKey, { offers = true } = {}) {
  const out = [];
  for (const def of Object.values(QUEST_DEF)) {
    const st = LOM.Quests.statusOf(state.quests, def.id);
    if (offers && st === "available" && def.giver.place === placeKey && state.placeTalkDone[placeKey]?.[def.giver.after]) {
      out.push(actionBtn({ title: `Přijmout úkol: ${hl(def.title)}`, hint: def.brief, act: "quest-accept", attrs: `data-quest="${def.id}"`, type: "primary", story: true }));
    }
    if (st === "ready" && def.turnIn.place === placeKey) out.push(...turnInButtons(def));
  }
  return out.join("");
}

function turnInButtons(def) {
  if (def.choices) {
    return def.choices.map((c) => actionBtn({ title: `Odevzdat: ${hl(c.label)}`, hint: `${def.title} · ${c.hint}`, act: "quest-turnin", attrs: `data-quest="${def.id}" data-choice="${c.id}"`, type: "primary", story: true }));
  }
  return [actionBtn({ title: `Odevzdat úkol: ${hl(def.title)}`, hint: `odměna ${def.reward.gold ? STAT_BY.gold.icon + def.reward.gold + " · " : ""}${def.reward.xp} XP`, act: "quest-turnin", attrs: `data-quest="${def.id}"`, type: "primary", story: true })];
}

function questCellButtonsHtml() {
  return Object.values(QUEST_DEF)
    .filter((d) => d.turnIn.cell && d.turnIn.cell[0] === state.mapX && d.turnIn.cell[1] === state.mapY && LOM.Quests.statusOf(state.quests, d.id) === "ready")
    .flatMap(turnInButtons)
    .join("");
}

function startEncounterFight(ambush) {
  const enc = state.encounter;
  state.encounter = null;
  startCombat([ENCOUNTER_TEXT[enc.enemyId]], { enemyId: enc.enemyId, seed: enc.seed, ambush });
  state.combat.spotId = enc.spotId;
  setScreen("combat");
  if (state.combat.over) endCombat(state.combat.result); // přepadení rozhodlo hned
}

/** Vyzvedne věci z corpse na této buňce (co se nevejde, zůstane). */
function takeCorpse() {
  const c = corpseHere();
  if (!c) return;
  const out = LOM.recoverCorpse(c, {
    isQuest: (id) => !!ITEM_BY[id]?.quest,
    tryEquip: (slot, id) => {
      if (state.equipped[slot]) return false;
      state.equipped[slot] = id;
      return true;
    },
    tryPut: (id) => bagPut(id),
  });
  state.gold += out.took.gold;
  state.corpses = state.corpses.filter((x) => x !== c);
  if (out.left) {
    state.corpses.push(out.left);
    state.corpseSkip = mapKey(c.x, c.y);
  }
  questRefresh();
  const names = out.took.items.map((id) => ITEM_BY[id]?.icon || "").join(" ");
  toast(
    out.left
      ? `Vzal jsi ${out.took.gold ? `${STAT_BY.gold.icon}${out.took.gold} ` : ""}${names}. Zbytek se nevešel a leží dál.`
      : `Vzal jsi vše: ${out.took.gold ? `${STAT_BY.gold.icon}${out.took.gold} ` : ""}${names}`
  );
  render();
}

/** Služby místa - bez header labelu místa (ten je v kontext boxu); jen tabulka */
/** Cena služby; volby v questech ji mění (Svatava: přítel −50 %, smlouva +25 %). */
const PLACE_NPC_ID = {
  healer: "lidmila",
  tavern: "svatava",
  bank: "gertruda",
  smith: "karel",
  gate: "petr",
  market: "hanus",
  townhall: "gustav",
};
const BANK_OPS = ["dep_all", "dep_50", "wd_50", "wd_all"];
function servicePrice(placeKey, s) {
  let base = s.price;
  if (placeKey === "tavern" && s.id === "rest") base = state.flags.svatava_friend ? 10 : state.flags.svatava_haggled ? 25 : s.price;
  /* důvěra (standing + kauza) → ceny ×0,7…×1,3; Zástava, které nevěříš, bere poplatek */
  if (PLACE_NPC_ID[placeKey] && base) {
    base = Math.max(1, Math.round(base * LOM.Kauza.priceMod(state.kauza, PLACE_NPC_ID[placeKey], state.standing)));
  }
  if (placeKey === "bank" && BANK_OPS.includes(s.id)) base = (base || 0) + LOM.Kauza.bankFee(state.kauza, state.standing);
  if (placeKey === "healer" && s.id === "heal" && state.freeHealAfterDeath) return 0;
  return base;
}

function placeServicesHtml(placeKey) {
  const p = PLACE[placeKey];
  if (!p) return "";
  const rows = p.services
    .filter((s) => !s.when || s.when())
    .map((s) => {
      const name = typeof s.nameHtml === "function" ? s.nameHtml() : s.name;
      const desc =
        typeof s.descHtml === "function" ? s.descHtml() : s.descHtml || s.desc || "";
      const cost = servicePrice(placeKey, s);
      const price = cost ? goldAmt(cost) : "";
      const meta = [desc, price].filter(Boolean).join(" · ");
      return `
      <div class="service-row">
        <span class="svc-name">${name}</span>
        <span class="svc-meta">${meta || ""}</span>
        <button type="button" class="btn btn-ghost svc-buy" data-act="svc" data-svc="${s.id}">${cost ? (placeKey === "townhall" ? "Zaplatit" : "Koupit") : "OK"}</button>
      </div>`;
    })
    .join("");
  return `<div class="service-table" data-services>${rows}</div>`;
}

/* ---------- úschovna, odložené a zakopané věci (pravidla: js/systems/stash.js) ---------- */
const itemLabel = (id) => `${ITEM_BY[id]?.icon || ""} ${ITEM_BY[id]?.name || id}`;
const isQuestItem = (id) => !!ITEM_BY[id]?.quest;

/** Úschovna v hospodě: uložené věci (vyzvednout za poplatek) a věci z batohu (uložit). */
function stashHtml() {
  const T = LOM.Stash.TUNE;
  const stored = state.stash.items.map((e, i) =>
    actionBtn({
      title: `Vyzvednout ${hl(itemLabel(e.id))}`,
      hint: `${LOM.Stash.stashFee(e, state.clock)} 🪙 · ${itemWeight(e.id)} kg`,
      act: "stash-take",
      attrs: `data-i="${i}"`,
      story: true,
    })
  );
  const inBag = state.bag
    .map((id, i) => (id ? { id, i } : null))
    .filter(Boolean)
    .map(({ id, i }) =>
      actionBtn({
        title: `Uložit ${hl(itemLabel(id))}`,
        hint: `${itemWeight(id)} kg`,
        act: "stash-put",
        attrs: `data-idx="${i}"`,
        story: true,
        disabled: LOM.Stash.stashFull(state.stash),
      })
    );
  const head = `<p class="muted">Úschovna: ${state.stash.items.length}/${T.stashCap} věcí · ${T.stashFeePerDay} 🪙 za den, platí se při vyzvednutí.${LOM.Stash.stashFull(state.stash) ? " Plno." : ""}</p>`;
  return head + stored.join("") + inBag.join("");
}

function stashPutItem(idx) {
  const id = state.bag[idx];
  if (!id) return;
  const r = LOM.Stash.stashPut(state.stash, id, state.clock);
  if (!r.ok) return feedback("Úschovna je plná.");
  state.bag[idx] = null;
  feedback(`Svatava schová ${itemLabel(id)} do truhly pod pultem.`);
}

function stashTakeItem(i) {
  const r = LOM.Stash.stashTake(state.stash, i, state.clock, { gold: state.gold, canFit: bagCanFit });
  if (!r.ok) {
    if (r.reason === "gold") return feedback(`Nemáš dost zlata na poplatek (${r.fee} 🪙).`);
    if (r.reason === "fit") return feedback("Nemáš kam to dát: batoh je plný nebo moc těžký.");
    return;
  }
  state.gold -= r.fee;
  bagPut(r.id);
  feedback(`Vyzvedl jsi ${itemLabel(r.id)}. Poplatek ${r.fee} 🪙.`);
}

const pileHere = (kind) => LOM.Stash.pileAt(state.piles, state.mapX, state.mapY, kind);

/** Vstup na políčko: vyhodnotí rozkradení hromádek tady (líně, podle uplynulého času) a ohlásí, co se stalo. */
function pilesArrive() {
  if (!state.piles.length) return;
  const r = LOM.Stash.settle(state.piles, state.clock, state.seed, isQuestItem, { x: state.mapX, y: state.mapY }, terrainAt);
  state.piles = r.piles;
  const lost = (kind) => r.lost.filter((l) => l.kind === kind).map((l) => ITEM_BY[l.id]?.icon || "").join(" ");
  const msgs = [];
  if (lost("open")) msgs.push(`Hromádka je prohrabaná: ${lost("open")} je pryč.`);
  if (lost("buried")) msgs.push(`Zakopané místo je rozryté: ${lost("buried")} je pryč.`);
  if (pileHere("open")) msgs.push("Tady leží tvé odložené věci.");
  if (pileHere("buried")) msgs.push("Tady jsi něco zakopal.");
  msgs.forEach((m) => toast(m));
}

function dropToPile(kind, idx) {
  const id = state.bag[idx];
  if (!id) return;
  if (kind === "buried") {
    if (!bagCount("shovel")) return toast("Na zakopání potřebuješ lopatu.");
    state.clock = LOM.advanceClock(state.clock, LOM.Stash.TUNE.buryTicks);
  }
  LOM.Stash.dropItem(state.piles, { x: state.mapX, y: state.mapY, kind, itemId: id, clock: state.clock, uid: ++state.pileSeq });
  state.bag[idx] = null;
  toast(kind === "buried" ? `Zakopal jsi ${itemLabel(id)} (${state.mapX},${state.mapY}).` : `Odložil jsi ${itemLabel(id)}. Kdokoli ji může vzít.`);
  state.cellMenu = kind === "buried" || !state.bag.some(Boolean) ? null : "drop";
}

function pileTake(kind, index) {
  const pile = pileHere(kind);
  const id = pile?.items[index]?.id;
  if (!id) return;
  if (!bagCanFit(id)) return kzSay({ scene: "Nevejde se ti to: batoh je plný nebo moc těžký.", fresh: "scene" });
  LOM.Stash.takeFromPile(state.piles, pile, index);
  bagPut(id);
  kzSay({ scene: `Vzal jsi ${itemLabel(id)}.`, fresh: "scene" });
}

/** Nabídka na políčku mapy: výběr věci k odložení / zakopání, nebo věcí z hromádky. */
function cellMenuHtml() {
  const m = state.cellMenu;
  if (!m) return "";
  if (m === "pile") {
    const pile = pileHere("open");
    return (pile?.items || [])
      .map((it, i) => actionBtn({ title: `Sebrat ${hl(itemLabel(it.id))}`, hint: `${itemWeight(it.id)} kg`, act: "pile-take", attrs: `data-i="${i}"`, story: true }))
      .join("");
  }
  return state.bag
    .map((id, i) => (id ? { id, i } : null))
    .filter(Boolean)
    .map(({ id, i }) =>
      actionBtn({
        title: `${m === "bury" ? "Zakopat" : "Odložit"} ${hl(itemLabel(id))}`,
        hint: m === "bury" ? `${itemWeight(id)} kg · −${LOM.Stash.TUNE.buryTicks} tiky` : `${itemWeight(id)} kg`,
        act: m === "bury" ? "cell-bury" : "cell-drop",
        attrs: `data-idx="${i}"`,
        story: true,
      })
    )
    .join("");
}

/** Tlačítka na políčku mimo město: odložit, zakopat (s lopatou), sebrat hromádku, vykopat. */
function pileButtonsHtml() {
  if (isInTownZone()) return "";
  const out = [];
  if (pileHere("open")) out.push(actionBtn({ title: `Sebrat ${hl("odložené věci")}`, hint: `${pileHere("open").items.length} na zemi`, act: "cell-menu", attrs: 'data-m="pile"', story: true }));
  if (pileHere("buried")) out.push(actionBtn({ title: `${hl("Vykopat")} zakopané věci`, hint: "−1 tik", act: "dig", story: true }));
  const has = state.bag.some(Boolean);
  out.push(actionBtn({ title: `${hl("Odložit")} věc na zemi`, hint: "zůstane tu; může ji někdo vzít", act: "cell-menu", attrs: 'data-m="drop"', story: true, disabled: !has }));
  if (bagCount("shovel")) out.push(actionBtn({ title: `${hl("Zakopat")} věc`, hint: `skrytě · −${LOM.Stash.TUNE.buryTicks} tiky · malé riziko`, act: "cell-menu", attrs: 'data-m="bury"', story: true, disabled: !has }));
  return out.join("");
}

function digUp() {
  const pile = pileHere("buried");
  if (!pile) return;
  state.clock = LOM.advanceClock(state.clock, 1);
  const got = [];
  for (let i = pile.items.length - 1; i >= 0; i--) {
    const id = pile.items[i].id;
    if (!bagCanFit(id)) continue;
    LOM.Stash.takeFromPile(state.piles, pile, i);
    bagPut(id);
    got.push(ITEM_BY[id]?.icon || "");
  }
  kzSay({ scene: got.length ? `Vykopal jsi ${got.join(" ")}.` : "Nevejde se ti to: batoh je plný nebo moc těžký.", fresh: "scene" });
}

function placeHubBackBtn(placeKey) {
  const npc = PLACE[placeKey]?.npc || "nim";
  return actionBtn({
    title: `Vrátit se k ${hl(npc)}`,
    hint: "zpět na hlavní nabídku",
    act: "place-back",
    type: "back",
    story: true,
  });
}

function placeOfferHtml(placeKey) {
  return placeServicesHtml(placeKey);
}

function worldChip(icon, tip) {
  return `<button type="button" class="stat-icon world-chip" data-act="stat-tip" data-tip="${tip}" aria-label="${tip}"><span class="si" aria-hidden="true">${icon}</span></button>`;
}

function dockMain(label, innerHtml, opts = {}) {
  return actionPanel(label, innerHtml, opts);
}

function actionBodies(root) {
  /* scroll = .action-scroll (sticky je mimo) */
  return [...(root?.querySelectorAll(".action-scroll, [data-action-body]") || [])];
}

function captureLaneScroll(root) {
  if (!root || !laneScrollKey) return;
  laneScrollMem[laneScrollKey] = actionBodies(root).map((b) => b.scrollTop);
}

function restoreLaneScroll(root, key) {
  const saved = laneScrollMem[key];
  if (!root || !saved) return;
  requestAnimationFrame(() => {
    actionBodies(root).forEach((b, i) => {
      if (saved[i] != null) b.scrollTop = saved[i];
    });
  });
}

function capturePanelScroll() {
  document.querySelectorAll("#panel-body [data-scroll]").forEach((el) => {
    panelScrollMem[el.dataset.scroll] = el.scrollTop;
  });
}

function restorePanelScroll() {
  requestAnimationFrame(() => {
    document.querySelectorAll("#panel-body [data-scroll]").forEach((el) => {
      const y = panelScrollMem[el.dataset.scroll];
      if (y != null) el.scrollTop = y;
    });
  });
}

function renderTownActions() {
  const bar = $("town-actions");
  const player = $("player-actions");
  const stack = document.querySelector("[data-screen='town'] .dock-stack");
  if (!bar || !player) return;

  captureLaneScroll(bar);

  player.innerHTML = dockFooterHtml();

  const onSquare = state.mode === "town";
  const inPlace = state.mode === "place" && state.place;
  const inExits = state.mode === "exits";
  if (stack) stack.dataset.mode = state.mode;

  /* Nemožné skrýt. Disabled jen u věcí, které někdy jdou (např. šipka →). */
  const placeBtn = (id) => {
    const p = PLACE[id];
    return actionBtn({
      title: p.line || p.title,
      hint: p.hint,
      act: "goto-place",
      attrs: `data-place="${id}"`,
      story: true,
    });
  };

  bar.dataset.empty = "0";
  bar.setAttribute("aria-label", inPlace ? PLACE[state.place].title : "Město");
  /* sticky nahoře = navigace o úroveň; label místa/města = kontext box, ne action-panel */
  if (inExits) {
    const dirs = [
      { dx: 0, dy: 1, word: "sever" },
      { dx: 0, dy: -1, word: "jih" },
      { dx: -1, dy: 0, word: "západ" },
      { dx: 1, dy: 0, word: "východ" },
    ];
    const moveBtns = dirs
      .map((d) => {
        const nx = state.mapX + d.dx;
        const ny = state.mapY + d.dy;
        const ok = terrainAt(nx, ny) != null;
        return actionBtn({
          title: `Vydat se na ${hl(d.word)}`,
          hint: ok ? dirHint(d.dx, d.dy) : "okraj mapy",
          act: "map-move",
          attrs: `data-dx="${d.dx}" data-dy="${d.dy}"`,
          story: true,
          disabled: !ok,
        });
      })
      .join("");
    const canHub = isInTownZone();
    const backSticky = canHub
      ? actionBtn({
          title: `Vrátit se na ${hl("náměstí")}`,
          hint: "zpět ke službám města",
          act: "back-town",
          type: "back",
          story: true,
        })
      : "";
    const corpse = corpseHere();
    const corpseBtn = corpse
      ? actionBtn({
          title: `Prohledat ${hl("své tělo")} a posbírat věci`,
          hint: "zůstalo tu po tvé smrti",
          act: "corpse-take",
          type: "primary",
          story: true,
        })
      : "";
    /* u vlastního těla se nejde jen tak minout: buď prohledáš, nebo ho vědomě necháš */
    const corpseGate = corpse && state.corpseSkip !== mapKey(state.mapX, state.mapY);
    const corpseLeave = corpseGate
      ? actionBtn({
          title: `${hl("Nechat")} věci ležet a jít dál`,
          hint: "ostatní to může rozkrást; vrátit se pro ně musíš sám",
          act: "corpse-leave",
          story: true,
        })
      : "";
    if (state.encounter) {
      const e = LOM.ENEMIES[state.encounter.enemyId];
      const avoid = Math.round(LOM.avoidChance(statsNow().dex) * 100);
      bar.innerHTML = dockMain(
        "",
        [
          actionBtn({ title: `${hl("Bojovat")} s tím, co ti stojí v cestě`, hint: e.name, act: "enc-fight", story: true }),
          actionBtn({
            title: `Zkusit to ${hl("obejít")} nepozorovaně`,
            hint: `DEX · šance ${avoid} % · −1 výdrž; při nezdaru tě přepadnou`,
            act: "enc-avoid",
            story: true,
          }),
          actionBtn({
            title: `${hl("Ustoupit")} zpátky, odkud jsi přišel`,
            hint: "bez trestu",
            act: "enc-retreat",
            type: "back",
            story: true,
            disabled: state.prevX == null,
          }),
        ].join(""),
        { reserveSticky: true }
      );
    } else if (state.cellMenu && !corpseGate) {
      bar.innerHTML = dockMain("", cellMenuHtml(), {
        stickyHtml: actionBtn({ title: `Nechat to ${hl("být")}`, hint: "zpět na cestu", act: "cell-menu-close", type: "back", story: true }),
      });
    } else {
      bar.innerHTML = dockMain(
        "",
        corpseGate ? corpseBtn + corpseLeave : questCellButtonsHtml() + kauzaCellButtonsHtml() + corpseBtn + pileButtonsHtml() + moveBtns,
        backSticky && !corpseGate ? { stickyHtml: backSticky } : { reserveSticky: true }
      );
    }
  } else if (inPlace) {
    const view = state.placeView || "hub";
    const npc = PLACE[state.place]?.npc || "někomu";
    const crowd = placePeople(state.place);
    if (view === "stash") {
      bar.innerHTML = dockMain("", stashHtml(), {
        stickyHtml: actionBtn({ title: `Zpět na ${hl("nabídku")}`, hint: "služby místa", act: "place-back", type: "back", story: true }),
      });
    } else if (view === "people") {
      bar.innerHTML = dockMain(
        "",
        crowd
          .map((x) =>
            actionBtn({ title: `Promluvit s ${hl(x.name)}`, hint: x.role || "hostitel", act: "place-who", attrs: `data-who="${x.id}"`, story: true })
          )
          .join(""),
        { stickyHtml: actionBtn({ title: `Přestat se ${hl("rozhlížet")}`, hint: "zpět na hlavní nabídku", act: "place-back", type: "back", story: true }) }
      );
    } else if (view === "services") {
      bar.innerHTML = dockMain("", placeServicesHtml(state.place), {
        stickyHtml: placeHubBackBtn(state.place),
      });
    } else if (view === "talk") {
      const nested = (state.placeTalkPath || []).length > 0;
      const replying = kzReplyActive("place"); /* po fámě: odpovědi místo témat, vynucené nejsou */
      bar.innerHTML = dockMain("", replying ? kzReplyHtml() : (curPerson().host ? questButtonsHtml(state.place) : "") + talkOptionsHtml(state.place), {
        stickyHtml: actionBtn({
          title: replying
            ? `Nechat to ${hl("být")}`
            : nested
            ? `Zpět k ${hl("předchozí")} otázce`
            : `Ukončit ${hl("rozhovor")}`,
          hint: replying ? "bez odpovědi, zpět na témata" : nested ? "o úroveň výš v dialogu" : "zpět na hlavní nabídku",
          act: "place-back",
          type: "back",
          story: true,
        }),
      });
    } else {
      bar.innerHTML = dockMain(
        "",
        [
          questButtonsHtml(state.place, { offers: false }),
          actionBtn({
            title: `Zeptat se: ${hl("rozhovor")}`,
            hint: "začne dialog",
            act: "place-talk",
            story: true,
          }),
          PLACE[state.place].services.length
            ? actionBtn({
                title: `Prohlédnout ${hl("nabídku")} služeb`,
                hint: "ceník a nákup",
                act: "place-services",
                story: true,
              })
            : "",
          actionBtn({
            title: `Rozhlédnout se po ${hl("místnosti")}`,
            hint: "popis do kroniky",
            act: "place-look",
            story: true,
          }),
          crowd.length > 1
            ? actionBtn({ title: `Rozhlédnout se po ${hl("lidech")}`, hint: `kdo tu je (${crowd.length})`, act: "place-people", story: true })
            : "",
        ].join(""),
        {
          stickyHtml: actionBtn({
            title: `Opustit ${hl(npc)} a vyjít ven`,
            hint: "zpět na náměstí",
            act: "back-town",
            type: "back",
            story: true,
          }),
        }
      );
    }
  } else {
    const onTown = isInTownZone();
    const exploreSticky = actionBtn({
      title: `Prozkoumat ${hl("okolí")}`,
      hint: "směry po mapě",
      act: "exits",
      story: true,
    });
    /* bez „Machala“ / „Kam dál“ - kontext box + sticky stačí */
    const parts = [];
    if (onTown) {
      parts.push(
        [placeBtn("healer"), placeBtn("smith"), placeBtn("bank"), placeBtn("tavern"), placeBtn("market"), placeBtn("gate"), placeBtn("townhall")].join("")
      );
    }
    bar.innerHTML = dockMain("", parts.join(""), { stickyHtml: exploreSticky });
  }

  const nextKey = laneStateKey();
  laneScrollKey = nextKey;
  restoreLaneScroll(bar, nextKey);
}

function renderCombat() {
  const c = state.combat;
  if (!c) return;
  document.querySelector("[data-screen='combat']")?.classList.add("is-combat");
  setGameBg("forest");
  fillPlayerBox("combat-player", { hp: c.hp, res: c.res, flashGear: state.flashGear });
  /* nepřítel: HP + ATK/DEF; telegraph jen v logu (ne v boxu) */
  const enemy = $("combat-enemy");
  if (enemy) {
    const cond = LOM.enemyCondition(c);
    const pct = cond.q * 25; // hrubé dílky, bez přesných čísel
    const typeLabel = { wildlife: "Divoká zvěř", humanoid: "Humanoid", undead: "Nemrtvý" }[
      c.enemyType
    ] || (c.enemyType ? c.enemyType.charAt(0).toUpperCase() + c.enemyType.slice(1) : "Neznámý");
    enemy.innerHTML = `
      <div class="thumb enemy" style="background-image:url('${enemyImg(c.enemyId)}')"></div>
      <div class="box-body">
        <div class="box-title clip"><strong>${c.enemyName}</strong> <span class="muted">Lv ${c.enemyLevel || 1} · ${typeLabel}</span></div>
        <div class="bar hp"><span class="bar-ico" aria-hidden="true">${STAT_BY.hp.icon}</span><i style="--p:${pct}%"></i><em>${cond.label}${state.dev.reveal ? ` <span class="dev-tag">DEV ${c.enemyHp}/${c.enemyMax}</span>` : ""}</em></div>
        <div class="bar mp bar-ghost" aria-hidden="true"><span class="bar-ico">${STAT_BY.res.icon}</span><i style="--p:0%"></i><em>–</em></div>
        <div class="gear-strip">
          ${statChipBtn("atk", c.enemyAtk)}
          ${statChipBtn("def", c.enemyDef)}
        </div>
      </div>`;
  }
  const stage = $("enemy-stage");
  if (stage) {
    stage.style.display = "flex";
    stage.classList.toggle("is-over", !!c.over);
    const img = stage.querySelector("img");
    if (img) {
      img.alt = c.enemyName;
      img.src = enemyImg(c.enemyId);
    }
  }
  setLog(renderCombatLogHtml());
  const logEl = $("combat-log");
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
  const actions = $("combat-actions");
  if (!actions) return;
  if (c.over) {
    const needClaim = c.claim && !c.claim.taken;
    renderLootModal();
    const leaveLabel =
      c.result === "lose"
        ? `Probudit se u ${hl("léčitele")}`
        : `Vrátit se k ${hl("branám")} a nechat boj za sebou`;
    const combatFoot = $("combat-player-actions");
    if (combatFoot) combatFoot.innerHTML = dockFooterHtml();
    actions.innerHTML = needClaim
      ? dockMain("", `<p class="muted">Ulož odměnu do inventáře.</p>`, { reserveSticky: true })
      : dockMain("", "", {
          stickyHtml: actionBtn({
            title: leaveLabel,
            act: "combat-leave",
            type: "back",
            story: true,
          }),
        });
    return;
  }
  closeLootModal();
  const combatFoot = $("combat-player-actions");
  if (combatFoot) combatFoot.innerHTML = dockFooterHtml();
  restoreCombatActionsHtml();
  actions.querySelectorAll("button").forEach((b) => {
    b.disabled = !!c.busy;
  });
}

/* útok nahoře (primární), přežití dole - méně scrollu k rozhodnutí; dostupnost z pravidel (js/systems/combat.js) */
function combatActionsHtml() {
  const c = state.combat;
  const av = c ? Object.fromEntries(LOM.availableActions(c).map((a) => [a.id, a])) : {};
  const ico = STAT_BY.res.icon;
  const cost = (id) => (av[id]?.cost ? ` · −${av[id].cost} ${ico}` : "");
  const gain = (id) => (av[id]?.gain ? ` · +${av[id].gain} ${ico}` : "");
  const btn = (id, title, key, text, extra = {}) =>
    actionBtn({
      title,
      hint: combatHint(key, text),
      act: "combat",
      attrs: `data-move="${id}"${av[id]?.enabled === false ? ` title="${av[id].reason}"` : ""}`,
      disabled: av[id]?.enabled === false,
      story: true,
      ...extra,
    });
  const spare = c?.offer
    ? actionBtn({
        title: `${hl("Ušetřit")} ${c.enemyName}`,
        hint: "méně zlata, bez kořisti",
        act: "combat",
        attrs: 'data-move="spare"',
        type: "primary",
        story: true,
      })
    : "";
  const foresight =
    c && c.items.foresight > 0
      ? btn("foresight", `<span class="act-ico" aria-hidden="true">🧿</span> Vypít odvar ${hl("předtuchy")}`, "G", `čtení záměru · ×${c.items.foresight}`)
      : "";
  return actionPanel(
    "",
    [
      spare,
      btn("quick", `${hl("Rychlý")} výpad, ať spíš trefíš`, "Q", `lehčí zásah${cost("quick")}`),
      btn("heavy", `${hl("Těžký")} úder, ať to bolí`, "W", `víc dmg${cost("heavy")}`),
      btn("special", `${hl(LOM.specialName(pickedClass()))}, jistý zásah`, "S", `nemine${cost("special")}`),
      `<div class="lane-split" role="separator"></div>`,
      btn("guard", `Stáhnout se za ${hl("štít")} a vydržet nápor`, "E", `méně ran${gain("guard")}`),
      btn("evade", `Uhnout stranou a hledat ${hl("mezeru")}`, "R", `lepší útěk${gain("evade")}`),
      btn("observe", `Chvíli ${hl("pozorovat")} soupeře`, "D", `lepší čtení${gain("observe")}`),
      btn(
        "potion",
        `<span class="act-ico" aria-hidden="true">🧪</span> Potáhnout kalný ${hl("odvar")}`,
        "F",
        `léčení${c ? ` · ×${c.items.heal}` : ""}`
      ),
      foresight,
      btn("flee", `Ještě to jde, zmizet z ${hl("boje")}?`, "X", "útěk", { type: "back" }),
    ].join("")
  );
}

function restoreCombatActionsHtml() {
  const actions = $("combat-actions");
  if (actions) actions.innerHTML = combatActionsHtml();
}

/** Puntík u Úkolů ve všech footerech (statické i přegenerované). */
function syncNotebookDot() {
  document.querySelectorAll('[data-act="open-quests"]').forEach((b) => {
    b.classList.toggle("has-dot", !!state.notebookNew);
    if (b.classList.contains("dock-ico")) b.setAttribute("aria-label", state.notebookNew ? "Úkoly (nová fáma v Zápisníku)" : "Úkoly");
  });
}

function render() {
  scheduleSave();
  syncContinue();
  syncDevPad();
  syncNotebookDot();
  questRefresh();
  kauzaTick();
  document.querySelector("[data-screen='combat']")?.classList.toggle("is-combat", state.screen === "combat");
  if (state.screen === "origins") renderOrigins();
  if (state.screen === "town") {
    const place = state.place && PLACE[state.place];
    const terr = terrainAt(state.mapX, state.mapY);
    const forge = LOM.POI.forge.cell;
    const bgKey = place?.bg || (state.mapX === forge[0] && state.mapY === forge[1] ? "smith" : TERRAIN_BG[terr]) || "city";
    setGameBg(bgKey);
    fillPlayerBox("town-player", {
      flashGear: state.flashGear,
      res: state.travel.energy,
      resMax: state.travel.energyMax,
      resTip: "Výdrž na cestu (ne mana v boji), krok −1. Ve městě se doplní.",
      resIcon: "🥾",
    });
    const ctx = $("town-context");
    if (ctx) {
      const ph = LOM.phaseOf(state.clock);
      const clockChips = [
        worldChip(ph.icon, `${ph.label} · den ${state.clock.day}`),
        worldChip(state.weather.icon, state.weather.label),
      ].join("");
      const bankLine =
        state.place === "bank"
          ? `<div class="gear-strip">${statChipBtn("gold", String(state.bank), { tip: "Účet v bance" })}</div>`
          : `<div class="world-meta muted"><span>(${state.mapX},${state.mapY}) · ${TERRAIN_CS[terr] || ""}</span>${
              clockChips ? `<span class="gear-strip">${clockChips}</span>` : ""
            }</div>`;
      const title = place
        ? place.title
        : cellLabel(state.mapX, state.mapY);
      const sub = place
        ? "Služba ve městě"
        : state.mode === "exits"
          ? "Pohyb po mapě"
          : isInTownZone()
            ? "Hlavní město"
            : "V krajině";
      const thumbCls = place
        ? "place"
        : terr === "forest"
          ? "wild"
          : terr === "town" || terr === "village"
            ? "town"
            : "land";
      ctx.classList.remove("muted");
      ctx.innerHTML = `
        <div class="thumb context ${thumbCls}" aria-hidden="true"></div>
        <div class="box-body">
          <div class="box-title clip"><strong>${title}</strong></div>
          <p class="box-foot">${sub}</p>
          ${bankLine}
        </div>`;
    }
    if (state.mode === "place" && state.place) {
      setLog(placeLogHtml(state.place));
    } else if (state.mode === "exits") {
      setLog(townLogHtml(state.encounter ? ENCOUNTER_TEXT[state.encounter.enemyId] : travelProse(), state.cellThread));
    } else if (isInTownZone() && state.mapX === 3 && state.mapY === 3) {
      setLog(townLogHtml(TOWN_PROSE, state.cellThread));
    } else {
      setLog(townLogHtml(travelProse(), state.cellThread));
    }
    renderTownActions();
  }
  if (state.screen === "combat") renderCombat();
  else closeLootModal();
}

function endCombat(result) {
  const c = state.combat;
  if (!c) return;
  c.over = true;
  c.busy = false;
  c.result = result;
  state.hp = c.hp;
  state.clock = LOM.advanceClock(state.clock, LOM.TIME_COST.fight);
  /* výsledek zůstane - hráč sám claimne / pokračuje (žádný auto-timeout) */
  if (result === "win" || result === "spare") {
    const rw = LOM.rewardsFor(c, c.rng);
    if (c.forceLoot) rw.loot = c.forceLoot;
    /* zlato + XP vždy hned (ne do pile); itemy = loot modal */
    state.gold += rw.gold;
    const levels = LOM.gainXp(state, rw.xp);
    if (levels) state.hp = null; // nová úroveň = plné HP (řádka o úrovni je ve scéně níž)
    if (result === "win") state.kills[c.enemyId] = (state.kills[c.enemyId] || 0) + 1;
    else state.flags[`spared:${c.enemyId}`] = (state.flags[`spared:${c.enemyId}`] || 0) + 1;
    /* vyčištěné místo se obnoví další den */
    const spot = c.spotId && ensureSpots().find((x) => x.id === c.spotId);
    if (spot) spot.clearedDay = state.clock.day;
    /* dříve tábor zbojníků; hutě boj nevyžadují */
    const spareClaim = result === "spare" ? kauzaOnSpare(c.enemyId) : null;
    const pile = rw.loot
      .filter((id) => ITEM_BY[id])
      .map((id) => ({ kind: "item", id, icon: ITEM_BY[id].icon, name: ITEM_BY[id].name, rarity: ITEM_BY[id].rarity }));
    c.claim = { pile, taken: !pile.length, awarded: { gold: rw.gold, xp: rw.xp } };
    pushCombatTurn({
      scene:
        result === "win"
          ? `<strong>Vítězství</strong>. ${STAT_BY.gold.icon}+${rw.gold} · ✦+${rw.xp} XP.${levels ? ` <strong>Úroveň ${state.level}!</strong>` : ""}`
          : `<strong>Ušetřen</strong>. ${c.enemyName} se odplazí pryč. ${STAT_BY.gold.icon}+${rw.gold} · ✦+${rw.xp} XP.${levels ? ` <strong>Úroveň ${state.level}!</strong>` : ""}`,
      you: null,
      foe: null,
      meta: null,
    });
    if (spareClaim) {
      pushCombatTurn({ scene: `Než zmizí, ${c.enemyName} utrousí: ${spareClaim.line}${spareClaim.signal ? ` <em>${spareClaim.signal}</em>` : ""}`, you: null, foe: null, meta: null });
      if (spareClaim.sys) logSys(spareClaim.sys);
    }
    /* postup / splnění úkolu až po výsledku boje, ať drží pořadí v logu */
    if (result === "win") questEvent("kill", c.enemyId);
  } else if (result === "lose") {
    c.claim = { pile: [], taken: true };
    pushCombatTurn({
      scene: `<strong>Porážka</strong>. Tma. Všechno, co jsi nesl, zůstane tam, kde jsi padl.`,
      you: null,
      foe: null,
      meta: null,
    });
  } else if (result === "flee") {
    c.claim = { pile: [], taken: true };
    pushCombatTurn({
      scene: `<strong>Útěk</strong>. Mizíš mezi stromy. Žádná kořist.`,
      you: null,
      foe: null,
      meta: null,
    });
  }
  render();
}

function syncClaimTaken() {
  const c = state.combat?.claim;
  if (!c) return;
  c.taken = !c.pile?.length;
}

function applyLootPiece(piece, atBagIndex) {
  if (piece.kind === "gold") {
    state.gold += piece.amount || 0;
    return true;
  }
  if (piece.kind === "xp") {
    LOM.gainXp(state, piece.amount || 0);
    return true;
  }
  if (piece.kind === "item") {
    if (state.bag.includes(piece.id)) return true; /* už máš */
    if (!bagPut(piece.id, atBagIndex)) {
      toast("Inventář je plný nebo moc těžký.");
      return false;
    }
    return true;
  }
  return false;
}

function takeLootPiece(id, atBagIndex) {
  const c = state.combat;
  if (!c?.claim?.pile) return;
  const idx = c.claim.pile.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const piece = c.claim.pile[idx];
  if (!applyLootPiece(piece, atBagIndex)) return;
  c.claim.pile.splice(idx, 1);
  syncClaimTaken();
  if (piece.kind === "item") toast(`${piece.icon} ${piece.name}`);
  if (c.claim.taken) pushCombatTurn({ scene: `<strong>Kořist uložena.</strong>` });
  render();
}

function takeAllLoot() {
  const c = state.combat;
  if (!c?.claim?.pile?.length) return;
  const bits = [];
  const left = [];
  c.claim.pile.forEach((p) => {
    if (applyLootPiece(p)) {
      bits.push(p.kind === "item" ? `${p.icon} ${p.name}` : `${p.icon}${p.amount != null ? p.amount : ""}`);
    } else {
      left.push(p);
    }
  });
  c.claim.pile = left;
  syncClaimTaken();
  if (bits.length) {
    pushCombatTurn({
      scene: c.claim.taken
        ? `<strong>Kořist uložena</strong> · ${bits.join(" · ")}.`
        : `<strong>Část kořisti</strong> · ${bits.join(" · ")}. Inventář nestačí na zbytek.`,
    });
    toast(`Uloženo: ${bits.join(" · ")}`);
  }
  render();
}

function claimCombatRewards() {
  takeAllLoot();
}

function closeLootModal() {
  $("loot-modal")?.classList.add("hidden");
}

function attemptCloseLoot() {
  const c = state.combat;
  if (!c?.claim) {
    closeLootModal();
    return;
  }
  if (c.claim.pile?.length) {
    state.lootLeaveConfirm = true;
    renderLootModal();
    return;
  }
  state.lootLeaveConfirm = false;
  closeLootModal();
}

function abandonRemainingLoot() {
  const c = state.combat;
  if (!c?.claim) return;
  c.claim.pile = [];
  c.claim.taken = true;
  state.lootLeaveConfirm = false;
  closeLootModal();
  render();
}

function renderLootModal() {
  let el = $("loot-modal");
  const c = state.combat;
  /* modal zůstane po sebrání až do odchodu / zavření × */
  const show = c?.over && c.claim && c.result === "win" && state.screen === "combat";
  if (!el) {
    el = document.createElement("aside");
    el.id = "loot-modal";
    el.className = "loot-overlay hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Kořist");
    document.body.appendChild(el);
  }
  if (!show) {
    el.classList.add("hidden");
    return;
  }
  const pile = c.claim.pile || [];
  const done = !!c.claim.taken;
  const pileTiles = pile
    .map((p) => {
      const fake = {
        id: p.id,
        icon: p.icon,
        name: p.amount != null ? `${p.name} ×${p.amount}` : p.name,
        tip: "kořist",
        slot: "misc",
        rarity: p.rarity || "uncommon",
        weight: 0,
      };
      return itemTileHtml(fake, {
        act: `draggable="true" data-loot-id="${p.id}" data-act="loot-take"`,
        canAct: true,
      }).replace("item-tile", "item-tile loot-tile");
    })
    .join("");
  const bagCells = state.bag
    .map((id, idx) => {
      if (!id) {
        return `<div class="bag-slot empty" data-bag-slot="${idx}" data-drop="bag" aria-label="Místo ${idx + 1}"></div>`;
      }
      const item = ITEM_BY[id];
      return `<div class="bag-slot" data-bag-slot="${idx}" data-drop="bag">${
        item
          ? itemTileHtml(item, {
              extraTips: [`${itemWeight(id)} kg`],
              act: `draggable="true" data-drag-bag="${idx}"`,
            })
          : ""
      }</div>`;
    })
    .join("");
  const aw = c.claim.awarded || {};
  const leadBits = [
    aw.gold != null ? `${STAT_BY.gold.icon}+${aw.gold}` : "",
    aw.xp != null ? `✦+${aw.xp} XP` : "",
  ].filter(Boolean);
  const leftList = pile
    .map((p) => `${p.icon || "•"} ${p.name}${p.amount != null ? ` ×${p.amount}` : ""}`)
    .join(", ");
  const discardIdx = state.invDiscardIdx;
  const discardItem = discardIdx != null ? ITEM_BY[state.bag[discardIdx]] : null;
  const discardModal =
    discardItem && !state.lootLeaveConfirm
      ? `<div class="equip-pop-layer confirm-layer" role="presentation">
        <div class="equip-popover" role="dialog" aria-label="Zahodit">
          <header class="equip-pop-head"><h3>Zahodit?</h3>
            <button type="button" class="panel-close" data-act="inv-discard-no" aria-label="Ne"></button>
          </header>
          <p class="equip-confirm-line">Zahodit ${discardItem.icon || ""} <strong>${discardItem.name}</strong>?</p>
          <div class="equip-confirm-actions">
            <button type="button" class="btn btn-danger" data-act="inv-discard-yes">Zahodit</button>
            <button type="button" class="btn btn-ghost" data-act="inv-discard-no">Nechat</button>
          </div>
        </div>
      </div>`
      : "";
  const leaveConfirm = state.lootLeaveConfirm
    ? `<div class="equip-pop-layer confirm-layer" role="presentation">
        <div class="equip-popover" role="dialog" aria-label="Odejít bez kořisti">
          <header class="equip-pop-head"><h3>Opravdu odejít?</h3>
            <button type="button" class="panel-close" data-act="loot-leave-stay" aria-label="Zpět"></button>
          </header>
          <p class="equip-confirm-line">Ještě tu leží: <strong>${leftList || "–"}</strong>.</p>
          <div class="equip-confirm-actions">
            <button type="button" class="btn btn-primary" data-act="loot-leave-stay">Vrátit se k lootu</button>
            <button type="button" class="btn btn-ghost" data-act="loot-leave-drop">Odejít</button>
          </div>
        </div>
      </div>`
    : "";
  const w = bagWeight();
  el.classList.remove("hidden");
  el.innerHTML = `
    <div class="loot-sheet">
      <header class="panel-chrome">
        <span class="progress-label">Kořist</span>
        <button type="button" class="panel-close" data-act="loot-close" aria-label="Zavřít"></button>
      </header>
      <p class="loot-lead">${leadBits.length ? `Získáno: ${leadBits.join(" · ")}.` : "Kořist."}</p>
      ${
        pile.length
          ? `<div class="loot-pile inv-grid inv-grid-bag" data-loot-pile>${pileTiles}</div>`
          : ""
      }
      <p class="place-offer-label">Inventář</p>
      <div class="loot-bag inv-grid inv-grid-bag" data-loot-bag>${bagCells}</div>
      <div class="inv-foot">
        <p class="bag-meta">${w.toFixed(1)} / ${BAG_WEIGHT_MAX} kg · ${state.bag.filter(Boolean).length}/${BAG_SLOTS}</p>
        <div class="gear-strip">${statChipBtn("gold", String(state.gold))}</div>
      </div>
      ${discardModal}
      ${leaveConfirm}
    </div>`;
}

function leaveCombat() {
  const c = state.combat;
  if (!c?.over) return;
  /* bez claimu neodejdeš (win) */
  if (c.claim && !c.claim.taken) return;
  closeLootModal();
  const result = c.result;
  state.combat = null;
  state.encounter = null;
  if (result === "lose") {
    dieAndRespawn();
    return;
  }
  /* po boji pokračuješ tam, kde jsi stál: ve městě = náměstí, v krajině = pohyb po mapě */
  state.place = null;
  state.placeView = "hub";
  clearPlaceThread();
  if (isInTownZone()) {
    state.mode = "town";
    state.log = result === "flee" ? "Utíkáš zpět k branám." : "Vracíš se do Machaly.";
  } else {
    state.mode = "exits";
  }
  setScreen("town");
}

/** Smrt: vše (batoh, vybavení, měšec) zůstane v corpse; banka ne. Probuzení u léčitele se základní výbavou. */
function dieAndRespawn() {
  const { corpse, kit } = LOM.buildCorpse({
    bag: state.bag,
    equipped: state.equipped,
    gold: state.gold,
    x: state.mapX,
    y: state.mapY,
    day: state.clock.day,
  });
  const hadAnything = corpse.gold || corpse.items.length || Object.keys(corpse.equipped).length;
  if (hadAnything) state.corpses.push(corpse);
  state.bag = Array(BAG_SLOTS).fill(null);
  state.equipped = Object.fromEntries(EQUIP_SLOTS.map((k) => [k, kit.equipped[k] || null]));
  state.gold = kit.gold;
  state.hp = LOM.respawnHp(statsNow().hpMax);
  state.freeHealAfterDeath = true;
  const where = `${cellLabel(corpse.x, corpse.y)} (${corpse.x},${corpse.y})`;
  state.mapX = 3;
  state.mapY = 3;
  state.prevX = state.prevY = null;
  state.place = "healer";
  state.mode = "place";
  state.placeView = "hub";
  clearPlaceThread();
  state.clock = LOM.advanceClock(state.clock, 4);
  pushPlaceTurn({
    you: hadAnything
      ? `Lidmila tě přinesla. „Zase ty. Věci zůstaly tam, kde jsi padl: ${where}.“`
      : "Lidmila tě přinesla. „Zase ty. Sedni a ukaž, kde to bolí.“",
    fresh: "you",
  });
  state.log = placeProse("healer");
  setScreen("town");
}

function combatTurn(move) {
  const c = state.combat;
  if (!c || c.over || c.busy) return;
  if (move === "potion") openPanel(null);
  const r = LOM.resolveTurn(c, move, c.rng);
  if (!r.ok) {
    toast(r.reason || "Tuhle akci teď nejde použít.");
    return;
  }
  c.hotkeysArmed = true;
  if (move === "potion") bagConsume("potion");
  if (move === "foresight") bagConsume("foresight");
  const lines = LOM.combatLines(r.events, c);
  const kinds = r.events.map((e) => e.t);
  combatFx(kinds.includes("hit") ? "strike" : kinds.includes("flee_fail") ? "hurt" : "guard");
  const foeActed = kinds.includes("enemy_hit");

  /* konec bez odpovědi nepřítele (výhra úderem, útěk, ušetření) = hned */
  if (c.over && !foeActed) {
    if (lines.you) pushCombatTurn({ you: lines.you, foe: null, meta: null });
    endCombat(c.result);
    return;
  }

  c.busy = true;
  pushCombatTurn({ you: lines.you, foe: null, meta: null });
  render();
  setTimeout(() => {
    if (state.combat !== c) return;
    const last = [...c.turns].reverse().find((t) => !t.sys);
    if (last) last.foe = lines.foe;
    if (c.over) {
      state.log = renderCombatLogHtml();
      endCombat(c.result);
      return;
    }
    if (last) last.meta = state.dev.reveal ? `${lines.meta} ${LOM.devLine(c)}` : lines.meta;
    c.busy = false;
    combatFx("hurt");
    render();
  }, 520);
}

function spend(n) {
  if (state.gold < n) {
    toast(`Nemáš dost zlata · ${STAT_BY.gold.icon}${state.gold} / ${STAT_BY.gold.icon}${n}`);
    pushPlaceTurn({ you: "Nemáš dost zlata.", fresh: "you" });
    return false;
  }
  state.gold -= n;
  return true;
}

function feedback(msg) {
  if (typeof msg === "string") pushPlaceTurn({ you: msg, fresh: "you" });
  else pushPlaceTurn(msg);
}

/** Koupě předmětu do batohu; bez místa nestrhne zlato. */
function buyItem(itemId, price) {
  if (!bagCanFit(itemId)) {
    feedback("Nemáš kam to dát: batoh je plný nebo moc těžký.");
    return false;
  }
  if (!spend(price)) return false;
  bagPut(itemId);
  const it = ITEM_BY[itemId];
  feedback(`Koupil jsi ${it.icon} ${it.name}.`);
  return true;
}

function healTo(amount) {
  const max = statsNow().hpMax;
  state.hp = Math.min(max, playerHp() + amount);
}

function runService(id) {
  const p = state.place;
  const maker = (msg) => feedback(`${msg} (zatím bez účinku, nic jsi neplatil)`);
  if (p === "healer") {
    if (id === "heal") {
      if (playerHp() >= statsNow().hpMax) feedback("Jsi zdráv jako řípa. Lidmila zavrtí hlavou.");
      else {
        const base = servicePrice("healer", { id: "heal", price: 50 });
        const hp = LOM.healPriceAfterDeath(state.freeHealAfterDeath, base);
        if (hp.consumeFree || spend(hp.price)) {
          if (hp.consumeFree) state.freeHealAfterDeath = false;
          state.hp = null;
          feedback(hp.consumeFree ? "Lidmila tě ošetří. „Zaplatíš, až budeš mít.“" : "Lidmila tě ošetří. HP doplněno.");
        }
      }
    } else maker("Tohle Lidmila zatím neumí.");
  }
  if (p === "smith") {
    const buy = { buy_wood: ["wood_sword", 50], buy_iron: ["iron_sword", 150], buy_long: ["long_sword", 220] }[id];
    if (buy) buyItem(...buy);
    else if (id === "repair") feedback("Karel obrátí tvou výbavu v rukou. „Nic nevidím rozbitého.“ (opotřebení zatím není)");
    else maker("Karel jen pokrčí rameny.");
  }
  if (p === "bank") {
    const fee = BANK_OPS.includes(id) ? LOM.Kauza.bankFee(state.kauza, state.standing) : 0;
    if (fee && !spend(fee)) {
      render();
      return;
    }
    if (fee) feedback(`Poplatek ${STAT_BY.gold.icon}${fee}. Banka ti nevěří jako dřív.`);
    if (id === "dep_all") {
      state.bank += state.gold;
      state.gold = 0;
      feedback(`Vše uloženo. V bance teď ${STAT_BY.gold.icon}${state.bank}.`);
    }
    if (id === "dep_50") {
      const n = Math.min(50, state.gold);
      state.gold -= n;
      state.bank += n;
      feedback(`Uloženo ${STAT_BY.gold.icon}${n}. Banka ${STAT_BY.gold.icon}${state.bank}.`);
    }
    if (id === "wd_50") {
      const n = Math.min(50, state.bank);
      state.bank -= n;
      state.gold += n;
      feedback(`Vybráno ${STAT_BY.gold.icon}${n}. U sebe ${STAT_BY.gold.icon}${state.gold}.`);
    }
    if (id === "wd_all") {
      state.gold += state.bank;
      state.bank = 0;
      feedback(`Vybráno vše. U sebe ${STAT_BY.gold.icon}${state.gold}.`);
    }
  }
  if (p === "tavern") {
    if (id === "rest" && spend(servicePrice("tavern", { id: "rest", price: 20 }))) {
      state.hp = null;
      state.clock = LOM.toMorning(state.clock);
      refillTravel();
      feedback("Spíš do rána. HP plné, nový den.");
    }
    if (id === "rumor" && spend(5))
      feedback(`Koupil jsi rundu. ${RUMORS[Math.floor(Math.random() * RUMORS.length)]}`);
    if (id === "inspect_cask") {
      const k = kauzaState();
      const rec = k.claims.c1;
      if (!rec) feedback("Nevíš, na co se dívat. Nejdřív se zeptej na drby.");
      else if (rec.status === "verified" || rec.status === "refuted") feedback("Sud už jsi prohlédl.");
      else {
        const r = LOM.Kauza.verify(k, "c1", { via: "cask", day: state.clock.day });
        if (r.ok) {
          feedback({ scene: r.text, fresh: "scene" });
          logSys(kzStatusLine("c1", r));
        } else feedback(r.reason || "Tudy to ověřit nejde.");
      }
    }
    if (id === "stash") state.placeView = "stash";
    if (id === "ale") maker("Pivo U Podrazu chutná, ale nic nedělá.");
    if (id === "dice") maker("Kostky zůstaly v kapse.");
  }
  if (p === "townhall") {
    if (id.startsWith("lookup_")) kauzaLookup(id);
    if (id === "pay_debt") kauzaVerdict("pay");
  }
  if (p === "market") {
    if (id === "ration") buyItem("ration", 5);
    if (id === "bread" && spend(5)) {
      healTo(8);
      feedback("Kůrka voní. +8 HP.");
    }
    if (id === "potion") buyItem("potion", 20);
    if (id === "shovel") buyItem("shovel", 15);
    if (id === "sell_misc") {
      const i = state.bag.indexOf("daisy");
      if (i < 0) feedback("Nemáš co prodat.");
      else {
        state.bag[i] = null;
        state.gold += 2;
        feedback(`Prodána sedmikráska za ${STAT_BY.gold.icon}2.`);
      }
    }
  }
  render();
}

document.body.addEventListener("click", (e) => {
  /* loot: klik na tmavý overlay (ne sheet) = pokus o zavření */
  if (e.target.id === "loot-modal" || (e.target.classList?.contains("loot-overlay") && !e.target.closest(".loot-sheet"))) {
    attemptCloseLoot();
    return;
  }
  /* klik mimo popover = o úroveň (stejné pravidlo jako panely) */
  if (e.target.classList.contains("equip-pop-layer")) {
    if (e.target.closest("#loot-modal")) {
      if (state.lootLeaveConfirm) {
        state.lootLeaveConfirm = false;
        renderLootModal();
      }
      return;
    }
    if (state.invDiscardIdx != null && (e.target.closest("#panel") || e.target.closest("#loot-modal"))) {
      state.invDiscardIdx = null;
      refreshInvOrLoot();
      return;
    }
    closePanelStep();
    return;
  }
  const t = e.target.closest("[data-goto],[data-act],[data-origin-choice]");
  if (!t) return;

  if (t.dataset.goto) {
    if (t.dataset.auth) setAuth(t.dataset.auth);
    const dest = t.dataset.goto;
    const fromDev = !!t.closest?.(".proto-bar");
    /* DEV / navigace: vždy čistý stav cílové obrazovky */
    if (fromDev || dest !== state.screen) {
      clearUiScrollMem();
      state.invDiscardIdx = null;
      state.lootLeaveConfirm = false;
      state.equipPickSlot = null;
      state.equipConfirm = null;
      state.confirmDelete = false;
      state.confirmSaveDelete = false;
      state.newGameOk = false;
    }
    if (fromDev) state.noSave = true; /* dev skok nikdy nepřepíše reálné uložení */
    if (dest === "origins") {
      /* z Původu → zpět se zachovanými volbami; jinak čistý prolog */
      if (state.screen === "confirm" && !fromDev) {
        state.originStep = Math.min(state.originReached || 0, ORIGIN_STEPS.length - 1);
      } else {
        state.originStep = 0;
        state.originReached = 0;
        state.prologDone = { class: false, race: false, origin: false };
        state.prologStory = false;
        state.prologReact = null;
        state.prologBridges = {};
        state.prologReply = null;
        state.prologCheek = 0;
      }
    }
    if (dest === "town") {
      state.combat = null;
      state.mode = "town";
      state.place = null;
      clearPlaceThread();
      state.placeView = "hub";
      state.placeTalkPath = [];
      state.mapX = 3;
      state.mapY = 3;
      state.cellThread = [];
      state.log = TOWN_PROSE;
      openPanel(null);
      closeLootModal();
    }
    if (dest === "combat") {
      openPanel(null);
      closeLootModal();
      startCombat(["Les zhoustne. Z křoví vystoupí vlk."]);
    }
    if (dest === "landing" && !t.dataset.auth) setAuth("register");
    if (dest === "landing" || dest === "origins" || dest === "confirm") {
      state.combat = null;
      state.mode = "town";
      state.place = null;
      clearPlaceThread();
      state.placeView = "hub";
      openPanel(null);
      closeLootModal();
    }
    if (dest === "confirm" && fromDev) {
      state.prologDone = { class: true, race: true, origin: true };
      if (!state.name) state.name = randomName();
    }
    setScreen(dest);
    return;
  }

  if (t.dataset.originChoice !== undefined) {
    const step = ORIGIN_STEPS[state.originStep];
    const choice = step.choices[Number(t.dataset.originChoice)];
    /* drzá odpověď: prolog jde dál bez povolání (neznámý poutník), Svatava to komentuje v dalším kroku */
    if (choice.cheek) state.prologCheek += 1;
    if (choice.cheek) state.prologDone.class = false; /* drzá odpověď po dřívější volbě živnosti: poutník bez živnosti */
    state.prologReply = null;
    if (choice.class) {
      state.picks.class = choice.class;
      state.prologDone.class = true;
    }
    if (choice.race) {
      state.picks.race = choice.race;
      state.prologDone.race = true;
    }
    if (choice.origin) {
      state.picks.origin = choice.origin;
      state.prologDone.origin = true;
    }
    if (choice.react) state.prologReact = choice.react;
    state.prologBridges = { ...state.prologBridges, [state.originStep]: choice.bridge || "" };
    state.originReached = Math.max(state.originReached || 0, state.originStep);
    if (state.originStep < ORIGIN_STEPS.length - 1) {
      state.originStep += 1;
      state.originReached = Math.max(state.originReached, state.originStep);
      renderOrigins();
    } else {
      state.prologStory = true;
      updateStatsPreview();
      setScreen("confirm");
    }
    return;
  }

  const act = t.dataset.act;
  if (!act) return;

  if (act === "dice-name") {
    $("input-name").value = randomName();
    updateStartGate();
  }
  if (act === "pick-gender") {
    const g = t.value === "f" ? "f" : "m";
    state.gender = g;
    updateStartGate();
  }
  if (act === "start-back") closeStartModal();
  if (act === "start-game" || act === "start-confirm") {
    const missing = missingPicks();
    if (act === "start-game" && missing.length) {
      openStartModal(missing);
      return;
    }
    closeStartModal();
    if (readSave() && !state.newGameOk) {
      state.newGameOk = true;
      toast("Uložená hra se přepíše. Klikni znovu na Vstoupit do hry.");
      return;
    }
    const nm = sanitizeHeroName($("input-name")?.value);
    if ($("input-name") && $("input-name").value !== nm) $("input-name").value = nm;
    if (!nm) return;
    /* čistý start: nic z dřívější postavy (po Pokračovat → odhlášení) */
    const genderKeep = state.gender === "f" ? "f" : "m";
    resetState({ picks: state.picks, prologDone: state.prologDone, prologReact: state.prologReact, originReached: state.originReached, guest: state.guest, gender: genderKeep });
    state.name = nm;
    state.gender = genderKeep;
    state.literacy = literacyFromPicks();
    if (PUBLIC_DEMO) state.noSave = true;
    const kit = LOM.Origin.startKit({
      classId: pickedClass(),
      originId: state.picks.origin,
      react: state.prologReact,
      hasClass: !!state.prologDone.class,
    });
    /* prolog: výbava jen z voleb (ne výchozí naběračka/štíty z makeState) */
    state.equipped = kit.equipped;
    state.bag = Array(BAG_SLOTS).fill(null);
    for (const id of kit.bagAdd) bagPut(id);
    const patch = LOM.Origin.apply(state, state.picks.origin);
    state.origin = patch.origin;
    state.standing = patch.standing || {};
    if (patch.gold != null) state.gold = patch.gold;
    if (patch.bank != null) state.bank = patch.bank;
    if (patch.bag) state.bag = patch.bag;
    if (patch.travel) state.travel = patch.travel;
    if (patch.hearClaim) {
      kauzaState();
      /* seed: Zápisník ano, lhůta až při prvním hear s armDeadline (viz Kauza.hear) */
      LOM.Kauza.hear(state.kauza, patch.hearClaim, { day: state.clock.day, armDeadline: false });
      state.notebookNew = true;
    }
    if (patch.start && patch.start.place) {
      state.mapX = 3;
      state.mapY = 3;
      discoverCell(3, 3);
      state.mode = "place";
      state.place = patch.start.place;
      state.placeView = "hub";
      state.placeWho = "host";
      /* visits necháme 0: první goto-place po odchodu dostane uvítání z původu */
      state.log = nbspCzech(`${prologMorning()} ${patch.intro || ""} ${placeProse(state.place)}`);
      setScreen("town");
    } else if (patch.start && patch.start.cell) {
      const [x, y] = patch.start.cell;
      state.mapX = x;
      state.mapY = y;
      state.prevX = null;
      state.prevY = null;
      discoverCell(x, y);
      state.mode = "exits";
      state.place = null;
      state.log = nbspCzech(`${prologMorning()} ${patch.intro || TOWN_PROSE}`);
      setScreen("town");
    } else {
      state.mode = "town";
      state.place = null;
      state.log = `${prologMorning()} ${TOWN_PROSE}`;
      setScreen("town");
    }
    if (PUBLIC_DEMO) openDemoEnd(`${prologMorning()} ${patch.intro || ""}`.trim());
  }
  if (act === "demo-restart") location.reload();
  if (act === "goto-place") {
    if (!isInTownZone()) {
      toast("Služby jen ve městě.");
      return;
    }
    state.place = t.dataset.place;
    state.mode = "place";
    clearPlaceThread();
    state.placeTalkPath = [];
    state.placeView = "hub";
    state.placeWho = "host";
    state.visits[state.place] = (state.visits[state.place] ?? -1) + 1;
    state.log = placeProse(state.place);
    const placeKey = state.place;
    /* uvítání z původu jen napoprvé (visits === 0); potom běžný PLACE.greeting */
    const greet = pickV(
      `greet:${placeKey}`,
      LOM.Origin.greetPool(placeKey, state.origin, visitN(placeKey), PLACE[placeKey]?.greeting),
      visitN(placeKey)
    );
    render();
    /* pozdrav se zpožděním - jako dialog v boji */
    if (greet) {
      setTimeout(() => {
        if (state.mode !== "place" || state.place !== placeKey) return;
        if (state.placeThread.some((t) => t.foe === greet)) return;
        pushPlaceTurn({ foe: greet, fresh: "foe" });
        render();
      }, DIALOG_DELAY_MS);
    }
  }
  if (act === "place-back") {
    const from = state.placeView || "hub";
    const beats = PLACE_BEATS[state.place] || {};
    if (state.kzReply) {
      const replying = kzReplyActive("place");
      state.kzReply = null;
      if (replying) {
        render();
        return;
      }
    }
    if (from === "talk" && (state.placeTalkPath || []).length) {
      state.placeTalkPath.pop();
      render();
      return;
    }
    if (from === "stash") {
      state.placeView = "services";
      render();
      return;
    }
    const who = curPerson();
    state.placeView = "hub";
    state.placeTalkPath = [];
    state.placeWho = "host";
    const key = `beat:${state.place}`;
    if (from === "services" && beats.closeServices) pushDialogBeat(sayBeat(`${key}:closeServices`, beats.closeServices));
    else if (from === "talk" && who && !who.host) pushDialogBeat({ you: `„Díky, zatím.“`, foe: sayV(`bye:${state.place}:${who.id}`, who.bye || `„Hm.“`) });
    else if (from === "talk" && beats.closeTalk) pushDialogBeat(sayBeat(`${key}:closeTalk`, beats.closeTalk));
    else render();
  }
  if (act === "place-talk") {
    state.placeView = "talk";
    state.placeTalkPath = [];
    state.placeWho = "host";
    const beat = PLACE_BEATS[state.place]?.openTalk;
    if (beat) pushDialogBeat(sayBeat(`beat:${state.place}:openTalk`, beat));
    else render();
  }
  if (act === "place-services") {
    state.placeView = "services";
    const beat = PLACE_BEATS[state.place]?.openServices;
    if (beat) pushDialogBeat(sayBeat(`beat:${state.place}:openServices`, beat));
    else render();
  }
  if (act === "place-people") {
    state.placeView = "people";
    const names = placePeople(state.place).map((x) => `<strong>${x.name}</strong>${x.role ? ` (${x.role})` : ""}`);
    pushPlaceTurn({ scene: `Kdo je tady: ${names.join(", ")}.`, fresh: "scene" });
    render();
  }
  if (act === "place-who") {
    const who = placePeople(state.place).find((x) => x.id === t.dataset.who);
    if (!who) return;
    state.kzReply = null;
    if (who.host) {
      state.placeWho = "host";
      state.placeView = "talk";
      state.placeTalkPath = [];
      const beat = PLACE_BEATS[state.place]?.openTalk;
      if (beat) pushDialogBeat(sayBeat(`beat:${state.place}:openTalk`, beat));
      else render();
    } else {
      state.placeWho = who.id;
      state.placeView = "talk";
      state.placeTalkPath = [];
      pushDialogBeat({ you: `„Dovolíš?“`, foe: sayV(`greet:${state.place}:${who.id}`, who.greeting) });
    }
  }
  if (act === "back-town") {
    if (state.mode === "exits" && !isInTownZone()) {
      toast("Nejdřív dojdi na městskou buňku, nebo rychlý návrat.");
      return;
    }
    state.mode = "town";
    state.place = null;
    clearPlaceThread();
    state.placeTalkPath = [];
    state.placeView = "hub";
    state.cellThread = [];
    state.log = TOWN_PROSE;
    if (isInTownZone()) refillTravel();
    render();
  }
  if (act === "place-ask") {
    const askId = t.dataset.ask;
    const who = talkNodesAt(state.place).find((n) => n.id === askId);
    if (!who) return;
    state.placeView = "talk";
    if (who.follow) LOM.Kauza.followUp(kauzaState(), who.follow, state.clock.day);
    const doneKey = talkKey(state.place);
    if (!state.placeTalkDone[doneKey]) state.placeTalkDone[doneKey] = {};
    state.placeTalkDone[doneKey][who.id] = true;
    /* fáma: zaslechnutí zapíše do Zápisníku; věta a případný signál podle kauzy (věty fám se nemění). Jinak varianta odpovědi. */
    const said = who.claim ? kauzaHear(who.claim, undefined, { defer: true }) : null;
    const ans = said ? said.line : sayV(`ans:${state.place}:${who.id}`, who.ans);
    const askLine = sayV(`ask:${state.place}:${who.id}`, who.ask);
    pushPlaceTurn({ you: askLine, fresh: "you" });
    render();
    setTimeout(() => {
      if (state.mode !== "place" || state.placeView !== "talk") return;
      const last = state.placeThread[state.placeThread.length - 1];
      if (last && last.you === askLine && !last.foe) {
        last.foe = ans;
        last.fresh = "foe";
        if (said?.signal) pushPlaceTurn({ scene: `<em>${said.signal}</em>`, fresh: "scene" });
        if (said?.sys) logSys(said.sys);
        if (said) state.kzReply = { cid: who.claim, ctx: "place", place: state.place }; /* hráč může odpovědět; nemusí */
      }
      if (who.children?.length) {
        state.placeTalkPath = [...(state.placeTalkPath || []), who.id];
      }
      render();
    }, DIALOG_DELAY_MS);
  }
  if (act === "place-look") {
    const looks = {
      healer: ["Police bylin, čistý stůl, v koutě kouří kadidlo.", "Lahvičky seřazené podle barvy, hmoždíř s rozdrcenými kořeny, na háku suchý netopýr. Doufáš, že je suchý záměrně."],
      smith: "Jiskry z výhně, na stojanu visí nedokončený meč.",
      bank: "Tlusté dveře, ticho, zápach vosku a kovu.",
      tavern: ["Mokré stoly, smích u krbu, kočka na sudu.", "Hostinská leští půllitr, který je čistý od roku Páně nevím kdy. Kočka na sudu otevře jedno oko."],
      market: "Stanové plachty, křik cen, vůně chleba a ryb.",
      gate: ["Kamenná brána, rez na mříži, bedna, na které se dá sedět i hlídat.", "Na zdi je křídou čmáranice „Petr byl tu“. Pod ní jiným písmem „Petr taky“."],
      townhall: "Police s listinami, razítka seřazená jako vojsko, hodiny, které jdou jinak než slunce.",
    };
    pushPlaceTurn({
      scene: sayV(`look:${state.place}`, looks[state.place]) || "Rozhlížíš se. Nic zvláštního.",
      fresh: "scene",
    });
    render();
  }
  if (act === "exits") {
    state.mode = "exits";
    state.place = null;
    clearPlaceThread();
    state.placeTalkPath = [];
    state.placeView = "hub";
    discoverCell(state.mapX, state.mapY);
    render();
  }
  if (act === "map-move") {
    const dx = Number(t.dataset.dx);
    const dy = Number(t.dataset.dy);
    if (!moveMap(dx, dy)) return;
    state.mode = "exits";
    state.place = null;
    render();
  }
  if (act === "enc-fight" && state.encounter) startEncounterFight(false);
  if (act === "enc-avoid" && state.encounter) {
    state.travel.energy = Math.max(0, state.travel.energy - 1);
    if (worldRng().chance(LOM.avoidChance(statsNow().dex))) {
      state.encounter = null;
      toast("Proklouzl jsi stranou, nikdo si tě nevšiml.");
      render();
    } else {
      toast("Zpozorovali tě!");
      startEncounterFight(true);
    }
  }
  if (act === "enc-retreat" && state.encounter && state.prevX != null) {
    state.encounter = null;
    state.mapX = state.prevX;
    state.mapY = state.prevY;
    state.prevX = state.prevY = null;
    state.clock = LOM.advanceClock(state.clock, LOM.TIME_COST.step);
    if (isInTownZone()) {
      state.mode = "town";
      state.log = TOWN_PROSE;
      refillTravel();
    }
    render();
  }
  if (act === "stash-put") {
    stashPutItem(Number(t.dataset.idx));
    render();
  }
  if (act === "stash-take") {
    stashTakeItem(Number(t.dataset.i));
    render();
  }
  if (act === "cell-menu") {
    state.cellMenu = t.dataset.m;
    render();
  }
  if (act === "cell-menu-close") {
    state.cellMenu = null;
    render();
  }
  if (act === "cell-drop") {
    dropToPile("open", Number(t.dataset.idx));
    render();
  }
  if (act === "cell-bury") {
    dropToPile("buried", Number(t.dataset.idx));
    render();
  }
  if (act === "pile-take") {
    pileTake("open", Number(t.dataset.i));
    if (!pileHere("open")) state.cellMenu = null;
    render();
  }
  if (act === "dig") {
    digUp();
    render();
  }
  if (act === "corpse-take") takeCorpse();
  if (act === "corpse-leave") {
    state.corpseSkip = mapKey(state.mapX, state.mapY);
    toast("Necháváš své věci ležet. Mapa si je pamatuje (💀).");
    render();
  }
  if (act === "quest-accept") acceptQuest(t.dataset.quest);
  if (act === "kz-reply") kauzaReply(t.dataset.reply);
  if (act.startsWith("kz-") && act !== "kz-keep" && act !== "kz-reply") kauzaCellAct(act);
  if (act === "panel-tab") {
    state.panelTab = t.dataset.tab === "notebook" ? "notebook" : "quests";
    openPanel("quests", { keepStack: true });
  }
  if (act === "kz-keep") {
    if (kauzaVerdict("keep")) openPanel("quests");
  }
  if (act === "quest-turnin") turnInQuest(t.dataset.quest, t.dataset.choice || null);
  if (act === "svc") runService(t.dataset.svc);
  if (act === "open-inv") {
    /* v boji prohlížení OK - equip / spotřebu řeší Postava a akce Přežít */
    togglePanel("inventory");
  }
  if (act === "open-quests") togglePanel("quests");
  if (act === "quest-abandon") {
    const id = t.dataset.quest;
    const r = LOM.Quests.abandon(state.quests, id);
    if (r.ok) {
      r.remove.forEach(bagConsume);
      toast(`Úkol zrušen: ${QUEST_DEF[id].title}`);
      openPanel("quests");
    }
  }
  if (act === "open-map") togglePanel("map");
  if (act === "open-char") {
    state.equipPickSlot = null;
    state.equipConfirm = null;
    togglePanel("character");
  }
  if (act === "open-settings") {
    state.confirmDelete = false;
    togglePanel("settings");
  }
  if (act === "open-ranks") openPanel("ranks", { pushFrom: true });
  if (act === "open-legal") {
    state.legalDoc = t.dataset.legal === "privacy" ? "terms" : t.dataset.legal || "faq";
    openPanel("legal", { pushFrom: true });
  }
  if (act === "char-slot") {
    const slot = t.dataset.slot;
    state.equipConfirm = null;
    state.equipPickSlot = state.equipPickSlot === slot ? null : slot;
    openPanel("character");
  }
  if (act === "char-slot-close") {
    state.equipPickSlot = null;
    state.equipConfirm = null;
    openPanel("character");
  }
  if (act === "equip-ask") {
    state.equipConfirm = { itemId: t.dataset.item };
    openPanel("character");
  }
  if (act === "equip-confirm-yes") {
    const id = state.equipConfirm?.itemId;
    state.equipConfirm = null;
    if (id) toggleEquip(id, { reopen: "character" });
    else openPanel("character");
  }
  if (act === "equip-confirm-no") {
    state.equipConfirm = null;
    openPanel("character");
  }
  if (act === "stat-tip") {
    document.querySelectorAll(".stat-icon.is-tip").forEach((n) => {
      if (n !== t) n.classList.remove("is-tip");
    });
    const on = t.classList.toggle("is-tip");
    if (on) showFloatTip(t);
    else hideFloatTip();
  }
  if (act === "prolog-again") {
    /* volby nechat (highlight); jen se vrátit na začátek prologu */
    state.originStep = 0;
    state.originReached = Math.max(state.originReached || 0, ORIGIN_STEPS.length - 1);
    state.prologStory = false;
    state.prologReply = null;
    setScreen("origins");
  }
  if (act === "origin-back") {
    if (state.originStep > 0) {
      state.originStep -= 1;
      renderOrigins();
    }
  }
  if (act === "origin-fwd") {
    if (state.screen === "origins") {
      if (state.originStep < ORIGIN_STEPS.length - 1 && state.originStep < (state.originReached || 0)) {
        state.originStep += 1;
        renderOrigins();
      } else if (state.originStep === ORIGIN_STEPS.length - 1 && state.prologDone.origin) {
        state.prologStory = true;
        updateStatsPreview();
        setScreen("confirm");
      }
    }
  }
  if (act === "close-panel") closePanelStep();
  if (act === "logout") {
    openPanel(null);
    state.guest = false;
    state.combat = null;
    state.mode = "town";
    state.place = null;
    toast("Odhlášeno.");
    setAuth("signin");
    setScreen("landing");
  }
  if (act === "delete-account") {
    state.confirmDelete = true;
    state.deleteTyped = "";
    openPanel("settings", { keepStack: true });
  }
  if (act === "delete-cancel") {
    state.confirmDelete = false;
    state.deleteTyped = "";
    openPanel("settings", { keepStack: true });
  }
  if (act === "delete-confirm") {
    if ((state.deleteTyped || "").trim().toUpperCase() !== "SMAZAT") {
      toast("Napiš SMAZAT pro potvrzení.");
      return;
    }
    state.confirmDelete = false;
    state.deleteTyped = "";
    openPanel(null);
    state.guest = false;
    state.combat = null;
    state.mode = "town";
    state.place = null;
    toast("Účet deaktivován (prototyp · 14 dnů na obnovení).");
    setAuth("register");
    setScreen("landing");
  }
  if (act === "lang-cs") {
    /* už CS - žádný toast při no-op */
    if (state.prefs.lang !== "cs") {
      state.prefs.lang = "cs";
      savePrefs();
      toast("Jazyk: čeština.");
      openPanel("settings", { keepStack: true });
    }
  }
  if (act === "pref-kodex") {
    state.prefs.kodex = !!t.checked;
    state.kodexCache = new Map();
    hideFloatTip();
    savePrefs();
    openPanel("settings", { keepStack: true });
    render();
  }
  if (act === "pref-hotkeys") {
    state.prefs.hotkeys = !!t.checked;
    savePrefs();
    openPanel("settings", { keepStack: true });
    /* footer / combat hinty hned */
    if (state.screen === "town") renderTownActions();
    if (state.screen === "combat") renderCombat();
  }
  if (act === "toggle-equip") toggleEquip(t.dataset.item, { reopen: "inventory" });
  if (act === "combat") combatTurn(t.dataset.move);
  if (act === "combat-claim") claimCombatRewards();
  if (act === "combat-leave") leaveCombat();
  if (act === "loot-take") takeLootPiece(t.dataset.lootId);
  if (act === "loot-take-all") takeAllLoot();
  if (act === "loot-close") attemptCloseLoot();
  if (act === "loot-leave-stay") {
    state.lootLeaveConfirm = false;
    renderLootModal();
  }
  if (act === "loot-leave-drop") {
    abandonRemainingLoot();
    leaveCombat();
  }
  if (act === "inv-discard-yes") {
    const idx = state.invDiscardIdx;
    if (idx != null && state.bag[idx]) {
      const item = ITEM_BY[state.bag[idx]];
      state.bag[idx] = null;
      toast(`${item?.icon || ""} ${item?.name || "Předmět"}: hozeno`);
    }
    state.invDiscardIdx = null;
    refreshInvOrLoot();
  }
  if (act === "inv-discard-no") {
    state.invDiscardIdx = null;
    refreshInvOrLoot();
  }
  if (act === "audio-mute") {
    state.audio.muted = !!t.checked;
    saveAudioPrefs();
    openPanel("settings", { keepStack: true });
  }
  if (act === "pick-race") {
    const id = t.dataset.race;
    const before = statSnapshot();
    if (state.prologDone.race && state.picks.race === id) {
      state.prologDone.race = false;
    } else {
      state.picks.race = id;
      state.prologDone.race = true;
    }
    flashChangedStats(before);
    updateStatsPreview();
    /* mobil: nechat rasu otevřenou - bonusy zůstanou vidět */
    syncOriginAccordions("race");
  }
  if (act === "pick-class") {
    const id = t.dataset.class;
    const before = statSnapshot();
    if (state.prologDone.class && state.picks.class === id) {
      state.prologDone.class = false;
    } else {
      state.picks.class = id;
      state.prologDone.class = true;
    }
    flashChangedStats(before);
    updateStatsPreview();
    syncOriginAccordions("class");
  }
  if (act === "pick-origin") {
    const id = t.dataset.origin;
    if (state.prologDone.origin && state.picks.origin === id) {
      state.prologDone.origin = false;
      state.picks.origin = null;
    } else {
      state.picks.origin = id;
      state.prologDone.origin = true;
    }
    updateStatsPreview();
    syncOriginAccordions("origin");
  }
  if (act === "continue-game") continueGame();
  if (act === "save-delete") {
    state.confirmSaveDelete = true;
    openPanel("settings", { keepStack: true });
  }
  if (act === "save-delete-cancel") {
    state.confirmSaveDelete = false;
    openPanel("settings", { keepStack: true });
  }
  if (act === "save-delete-confirm") {
    deleteSave();
    resetState();
    clearUiScrollMem();
    closeLootModal();
    openPanel(null);
    toast("Uložená hra smazána.");
    setAuth("register");
    setScreen("landing");
  }
  if (act === "auth-guest") {
    state.guest = true;
    state.originStep = 0;
    state.originReached = 0;
    state.prologDone = { class: false, race: false, origin: false };
    state.prologStory = false;
    setScreen("origins");
  }
  if (act === "auth-register") setAuth("register");
  if (act === "auth-signin") setAuth("signin");
});

/* DnD: loot → bag; bag ↔ bag; bag mimo inventář = zahodit (ne loot pile) */
let dragState = null;
let dragDroppedOk = false;
document.body.addEventListener("dragstart", (e) => {
  const loot = e.target.closest?.("[data-loot-id]");
  const bagDrag = e.target.closest?.("[data-drag-bag]");
  dragDroppedOk = false;
  if (loot) {
    dragState = { type: "loot", id: loot.dataset.lootId };
    e.dataTransfer?.setData("text/plain", dragState.id);
    e.dataTransfer.effectAllowed = "move";
    return;
  }
  if (bagDrag) {
    dragState = { type: "bag", from: Number(bagDrag.dataset.dragBag) };
    e.dataTransfer?.setData("text/plain", String(dragState.from));
    e.dataTransfer.effectAllowed = "move";
  }
});
document.body.addEventListener("dragend", () => {
  const st = dragState;
  dragState = null;
  document.querySelectorAll(".bag-slot.drag-over").forEach((n) => n.classList.remove("drag-over"));
  /* zahodit z inventáře / lootu (ne z loot pile) */
  if (st?.type === "bag" && !dragDroppedOk && st.from != null && state.bag[st.from]) {
    const inInv = $("panel")?.dataset.kind === "inventory" && !$("panel")?.classList.contains("hidden");
    const inLoot = isLootOpen();
    if (inInv || inLoot) {
      state.invDiscardIdx = st.from;
      refreshInvOrLoot();
    }
  }
  dragDroppedOk = false;
});
document.body.addEventListener("dragover", (e) => {
  if (!dragState) return;
  const slot = e.target.closest?.("[data-bag-slot]");
  if (!slot) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  document.querySelectorAll(".bag-slot.drag-over").forEach((n) => n.classList.remove("drag-over"));
  slot.classList.add("drag-over");
});
document.body.addEventListener("dragleave", (e) => {
  e.target.closest?.(".bag-slot")?.classList.remove("drag-over");
});
document.body.addEventListener("drop", (e) => {
  const slot = e.target.closest?.("[data-bag-slot]");
  if (!slot || !dragState) return;
  e.preventDefault();
  const to = Number(slot.dataset.bagSlot);
  if (dragState.type === "loot") {
    dragDroppedOk = true;
    takeLootPiece(dragState.id, to);
  } else if (dragState.type === "bag") {
    dragDroppedOk = true;
    bagSwap(dragState.from, to);
    if ($("loot-modal") && !$("loot-modal").classList.contains("hidden")) {
      renderLootModal();
    } else {
      openPanel("inventory");
    }
  }
  dragState = null;
  document.querySelectorAll(".bag-slot.drag-over").forEach((n) => n.classList.remove("drag-over"));
});

document.body.addEventListener("input", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement)) return;
  if (t.dataset.act === "audio-music") {
    state.audio.music = Number(t.value);
    const em = t.parentElement?.querySelector("em");
    if (em) em.textContent = state.audio.muted ? "–" : String(state.audio.music);
    saveAudioPrefs();
  }
  if (t.dataset.act === "audio-sfx") {
    state.audio.sfx = Number(t.value);
    const em = t.parentElement?.querySelector("em");
    if (em) em.textContent = state.audio.muted ? "–" : String(state.audio.sfx);
    saveAudioPrefs();
  }
  if (t.dataset.act === "delete-type") {
    state.deleteTyped = t.value;
    const btn = document.querySelector('[data-act="delete-confirm"]');
    if (btn) btn.disabled = t.value.trim().toUpperCase() !== "SMAZAT";
  }
});

initDevBar();
window.addEventListener("resize", syncDevPad);
window.addEventListener("orientationchange", () => setTimeout(syncDevPad, 50));
syncDevPad();
setAuth(state.auth);

/** Tip v body - mimo backdrop-filter / overflow parentů */
function floatTipEl() {
  let tip = $("float-tip");
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

/** Viditelná část prvku: průnik s viewportem a se všemi scrollovacími předky (tip nesmí viset mimo zobrazení). */
function visibleRect(el) {
  const r0 = el.getBoundingClientRect();
  let top = Math.max(r0.top, 0);
  let bottom = Math.min(r0.bottom, window.innerHeight);
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

function showFloatTip(icon) {
  const text = icon.dataset.tip || (icon.dataset.kodex && LOM.Kodex.KODEX_BY[icon.dataset.kodex]?.short) || icon.querySelector(".tip-bubble")?.textContent;
  if (!text) return;
  const tip = floatTipEl();
  tip.innerHTML = formatTipHtml(text);
  tip.classList.add("show");
  tip.classList.remove("below");
  const r = visibleRect(icon);
  const pad = 8;
  clearTimeout(floatTipTimer);
  /* dotyk nemá hover, tip sám zmizí */
  if (window.matchMedia("(hover: none)").matches) floatTipTimer = setTimeout(hideFloatTip, 4000);
  let left = r.left + r.width / 2;
  let top = r.top - 6;
  let below = top < 52;
  if (below) {
    top = r.bottom + 6;
    tip.classList.add("below");
  }
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  /* clamp do viewportu (malé displaye) */
  requestAnimationFrame(() => {
    const tr = tip.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (tr.left < pad) dx = pad - tr.left;
    if (tr.right > window.innerWidth - pad) dx = window.innerWidth - pad - tr.right;
    if (tr.top < pad) {
      tip.classList.add("below");
      tip.style.top = `${r.bottom + 6}px`;
      const tr2 = tip.getBoundingClientRect();
      if (tr2.bottom > window.innerHeight - pad) {
        tip.style.top = `${Math.max(pad, window.innerHeight - pad - tr2.height)}px`;
      }
    } else if (tr.bottom > window.innerHeight - pad) {
      dy = window.innerHeight - pad - tr.bottom;
      tip.style.top = `${top + dy}px`;
    }
    if (dx) tip.style.left = `${left + dx}px`;
  });
}

function hideFloatTip() {
  clearTimeout(floatTipTimer);
  $("float-tip")?.classList.remove("show");
}
/* scroll i Esc tip schovají (tip by jinak zůstal viset na starém místě) */
document.addEventListener("scroll", hideFloatTip, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideFloatTip();
    closeStartModal();
  }
});

/* Kodex: hover jen myší, na dotyku ťuknutí přepíná; ťuknutí jinam tip schová. */
document.addEventListener("pointerover", (e) => {
  if (e.pointerType === "touch") return;
  const k = e.target.closest?.("abbr.kodex");
  if (k) showFloatTip(k);
});
document.addEventListener("pointerout", (e) => {
  if (e.pointerType === "touch") return;
  if (e.target.closest?.("abbr.kodex") && !e.relatedTarget?.closest?.("abbr.kodex")) hideFloatTip();
});
let kodexTapId = null;
document.addEventListener(
  "click",
  (e) => {
    const k = e.target.closest?.("abbr.kodex");
    if (!k) {
      if (kodexTapId) hideFloatTip();
      kodexTapId = null;
      return;
    }
    if (kodexTapId === k.dataset.kodex) {
      hideFloatTip();
      kodexTapId = null;
    } else {
      showFloatTip(k);
      kodexTapId = k.dataset.kodex;
    }
  },
  true
);

const tipSel = ".stat-icon, .has-tip";
document.addEventListener(
  "pointerover",
  (e) => {
    const icon = e.target.closest?.(tipSel);
    if (icon) showFloatTip(icon);
  },
  true
);
document.addEventListener(
  "pointerout",
  (e) => {
    const icon = e.target.closest?.(tipSel);
    if (!icon) return;
    const to = e.relatedTarget?.closest?.(tipSel);
    if (to !== icon) hideFloatTip();
  },
  true
);
document.addEventListener(
  "focusin",
  (e) => {
    const icon = e.target.closest?.(tipSel);
    if (icon) showFloatTip(icon);
  },
  true
);
document.addEventListener("focusout", (e) => {
  if (!e.relatedTarget?.closest?.(tipSel)) hideFloatTip();
});

$("panel")?.addEventListener("click", (e) => {
  if (e.target.id === "panel") closePanelStep();
  if (!e.target.closest(".stat-icon")) {
    document.querySelectorAll(".stat-icon.is-tip").forEach((n) => n.classList.remove("is-tip"));
  }
});

/* ---------- Dev storybook: scénáře (js/dev/scenarios.js) ---------- */
function bagFromIds(ids) {
  const slots = Array(BAG_SLOTS).fill(null);
  ids.slice(0, BAG_SLOTS).forEach((id, i) => (slots[i] = id));
  return slots;
}

const FULL_BAG = ["daisy", "ration", "daisy", "ration", "daisy", "ration", "daisy", "ration", "daisy", "ration", "daisy", "ration", "daisy", "ration", "daisy", "ration"];
const PLACE_VIEWS = ["healer", "smith", "bank", "tavern", "market", "gate", "townhall"];
let devKnobs = {};

/**
 * Postaví celou scénu ze scénáře (+ přepisy z knobů) od čistého stavu a otevře obrazovku.
 * Stejný scénář + stejné knoby = stejný stav (seed).
 */
function applyScenario(id, knobs = devKnobs) {
  /* Reset obnoví všechno, i náběhy textu */
  lastOriginStep = -1;
  lastRevealed = "";
  landingQuoteShown = false;
  const base = LOM.SCENARIOS.find((x) => x.id === id);
  if (!base) return;
  const sc = { ...base };
  for (const k of LOM.KNOBS) if (knobs[k.id]) k.apply(sc, knobs[k.id]);
  let view = sc.view || (sc.fight ? "combat" : "town");
  if (view === "combat") sc.fight = { ...(sc.fight || {}), enemy: sc.fight?.enemy || "wolf" };
  else sc.fight = null;

  const keep = { audio: state.audio, prefs: state.prefs, dev: state.dev };
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, makeState(), keep);
  state.activeScenario = id; /* dev scéna: ukládání vypnuté */
  if (sc.seed != null) state.seed = sc.seed;
  state.name = "Testovací Poutník";
  state.guest = true;
  state.prologDone = { class: true, race: true, origin: true };
  state.picks = { class: sc.picks?.class || "mercenary", race: sc.picks?.race || "local", origin: sc.picks?.origin || null };
  if (state.picks.origin) {
    const patch = LOM.Origin.apply(state, state.picks.origin);
    state.origin = patch.origin;
    state.standing = patch.standing || {};
    if (patch.gold != null && sc.gold == null) state.gold = patch.gold;
    if (patch.bank != null && sc.bank == null) state.bank = patch.bank;
    if (patch.bag && !sc.bag) state.bag = patch.bag;
    if (patch.travel) state.travel = patch.travel;
  }
  if (sc.level) {
    state.level = sc.level;
    state.xpNext = LOM.xpToNext(sc.level);
    state.xp = 0;
  }
  if (sc.xp != null) state.xp = sc.xp;
  if (sc.gold != null) state.gold = sc.gold;
  if (sc.bank != null) state.bank = sc.bank;
  if (sc.bag === "full") state.bag = bagFromIds(FULL_BAG);
  else if (sc.bag) state.bag = bagFromIds(sc.bag);
  if (sc.phase || sc.day) state.clock = { day: sc.day || 1, tick: sc.phase ? LOM.PHASES.findIndex((p) => p.id === sc.phase) * LOM.TICKS_PER_PHASE : state.clock.tick };
  /* poloha: boj bez zadání je v lese; jinak ve městě */
  const at = sc.at || (view === "combat" ? [2, 5] : [3, 3]);
  state.mapX = at[0];
  state.mapY = at[1];
  discoverCell(at[0], at[1]);
  [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([ox, oy]) => terrainAt(at[0] + ox, at[1] + oy) && discoverCell(at[0] + ox, at[1] + oy));
  if (sc.strip) {
    state.bag = Array(BAG_SLOTS).fill(null);
    state.equipped = Object.fromEntries(EQUIP_SLOTS.map((k) => [k, LOM.RESPAWN_KIT.equipped[k] || null]));
    state.gold = 0;
  }
  if (sc.corpse) state.corpses.push({ day: 1, gold: 0, items: [], equipped: {}, ...sc.corpse });
  if (sc.encounter) state.encounter = { enemyId: sc.encounter, seed: sc.seed ?? 1 };
  if (sc.log) state.cellThread.push(normalizeFeedback({ scene: sc.log, fresh: "scene" }));
  if (sc.hpPct != null) state.hp = Math.max(1, Math.round(statsNow().hpMax * sc.hpPct));
  (sc.bagAdd || []).forEach((i) => bagPut(i));
  if (sc.spots) {
    state.spots = sc.spots.map((p) => ({ id: `${p.x},${p.y}`, x: p.x, y: p.y, terrain: terrainAt(p.x, p.y), pool: "manual", enemyId: p.enemy, when: p.when || "any", clearedDay: null }));
  }
  if (sc.quests) state.quests = JSON.parse(JSON.stringify(sc.quests));
  /* odložené / zakopané hromádky ({ x, y, kind, items[], day, tick }) a úschovna ({ id, day }) */
  (sc.piles || []).forEach((p) =>
    p.items.forEach((id) => LOM.Stash.dropItem(state.piles, { x: p.x, y: p.y, kind: p.kind, itemId: id, clock: { day: p.day || 1, tick: p.tick || 0 }, uid: ++state.pileSeq }))
  );
  (sc.stash || []).forEach((e) => state.stash.items.push({ id: e.id, day: e.day || 1 }));
  if (sc.kauza || sc.variant) {
    const k = kauzaState();
    if (sc.variant) k.variant = sc.variant;
    const kz = sc.kauza || {};
    (kz.heard || []).forEach((cid) => LOM.Kauza.hear(k, cid, { day: kz.startDay || 1 }));
    state.notebookNew = (kz.heard || []).length > 0; // ve scéně ukáž puntík
    (kz.verified || []).forEach((cid) => LOM.Kauza.verify(k, cid, { via: KZ.claims[cid].verify.via, day: kz.startDay || 1 }));
    if (kz.forgeSeen || kz.campSeen) k.facts.forgeSeen = true; /* campSeen = starý klíč scénářů */
    if (kz.trust) Object.assign(k.trust, kz.trust);
  }
  questRefresh();

  clearUiScrollMem();
  closeLootModal();
  openPanel(null);
  state.combat = null;
  state.place = null;
  state.placeView = "hub";
  clearPlaceThread();
  state.log = TOWN_PROSE;
  if (view === "combat") {
    startCombat(null, { enemyId: sc.fight.enemy, seed: sc.seed, enemyHpPct: sc.fight.enemyHpPct, loot: sc.fight.loot });
    setScreen("combat");
  } else if (view === "landing") {
    setAuth("register");
    setScreen("landing");
  } else if (view === "origins") {
    state.prologDone = { class: false, race: false, origin: false };
    state.originStep = 0;
    state.originReached = 0;
    setScreen("origins");
  } else if (view === "confirm") {
    setScreen("confirm");
  } else if (view === "demo-morning") {
    state.prologReact = sc.prologReact || "hide";
    state.prologDone = { class: true, race: true, origin: true };
    const patch = state.picks.origin ? LOM.Origin.apply(state, state.picks.origin) : {};
    if (patch.origin) state.origin = patch.origin;
    if (patch.standing) state.standing = patch.standing;
    const morning = `${prologMorning()} ${patch.intro || ""}`.trim();
    state.log = nbspCzech(morning);
    setScreen("town");
    openDemoEnd(morning);
  } else {
    state.mode = view === "exits" ? "exits" : PLACE_VIEWS.includes(view) ? "place" : "town";
    if (state.mode === "place") {
      state.place = view;
      state.visits[view] = 0;
      const morning = sc.withMorning ? `${prologMorning()} ` : "";
      state.log = nbspCzech(`${morning}${placeProse(view)}`);
      if (sc.placeView) state.placeView = sc.placeView;
    } else if (sc.withMorning) {
      state.log = nbspCzech(`${prologMorning()} ${TOWN_PROSE}`);
    }
    setScreen("town");
  }
  syncDevUi();
}

function syncDevUi() {
  const sel = $("dev-scenario");
  const note = $("dev-note");
  const sc = LOM.SCENARIOS.find((x) => x.id === (sel?.value || state.activeScenario));
  if (note) {
    note.textContent = sc ? sc.note || "" : "";
    note.classList.toggle("hidden", !sc?.note);
  }
  syncDevPad();
}

function renderDevStatus() {
  const st = $("dev-status");
  if (!st) return;
  const rank = { funguje: 0, maketa: 1, chybí: 2 };
  const list = [...LOM.SYSTEMS].sort((a, b) => rank[a.status] - rank[b.status]);
  const total = Math.round(list.reduce((n, x) => n + x.pct, 0) / list.length);
  st.innerHTML = `
    <p class="dev-total"><strong>Hotovost prototypu ≈ ${total} %</strong> <span>(hrubý odhad podle systémů)</span></p>
    <p class="dev-legend"><span class="sys-funguje">funguje</span> = skutečná pravidla, testy · <span class="sys-maketa">maketa</span> = UI je, efekt jen zčásti nebo vůbec · <span class="sys-chybí">chybí</span> = nic</p>
    ${["funguje", "maketa", "chybí"]
      .map((stt) => {
        const items = list.filter((x) => x.status === stt);
        if (!items.length) return "";
        return `<details class="dev-sec dev-sys-sec"${stt === "funguje" ? "" : " open"}><summary><span class="sys-${stt}">${stt}</span> ${items.length}</summary><ul>${items
          .map(
            (x) =>
              `<li><strong>${x.name}${x.phase ? ` <span class="dev-phase">${x.phase}</span>` : ""}</strong><i class="dev-bar"><b style="width:${x.pct}%"></b></i><em>${x.pct} % ${x.note ? "· " + x.note : ""}</em></li>`
          )
          .join("")}</ul></details>`;
      })
      .join("")}`;
}

/** Popisek „(scéna: …)“ u knobu ukazuje, co nastavuje vybraná scéna; hodnota „“ = nechat ji. */
function syncKnobLabels() {
  const base = LOM.SCENARIOS.find((x) => x.id === ($("dev-scenario")?.value || state.activeScenario));
  if (!base) return;
  document.querySelectorAll("select[data-knob]").forEach((sel) => {
    const k = LOM.KNOBS.find((x) => x.id === sel.dataset.knob);
    if (!k) return;
    const v = k.from(base);
    const label = k.opts.find(([o]) => o === v)?.[1];
    sel.options[0].textContent = label ? `scéna: ${label}` : "scéna: –";
  });
}

function allDevKnobSelects() {
  return [...document.querySelectorAll("select[data-knob]")];
}

function initDevStorybook() {
  const sel = $("dev-scenario");
  if (!sel || !window.LOM?.SCENARIOS) return;
  const groups = {};
  LOM.SCENARIOS.forEach((sc) => (groups[sc.group] = groups[sc.group] || []).push(sc));
  sel.innerHTML = Object.entries(groups)
    .map(([g, list]) => `<optgroup label="${LOM.GROUPS.indexOf(g) + 1} ${g}">${list.map((sc) => `<option value="${sc.id}">${sc.label}</option>`).join("")}</optgroup>`)
    .join("");

  const bySec = { postava: [], svet: [], boj: [] };
  LOM.KNOBS.forEach((k) => {
    const sec = DEV_KNOB_SEC[k.id] || "svet";
    (bySec[sec] || bySec.svet).push(k);
  });
  Object.entries(bySec).forEach(([sec, list]) => {
    const host = document.querySelector(`[data-knob-sec="${sec}"]`);
    if (!host) return;
    host.innerHTML = list
      .map(
        (k) =>
          `<label class="dev-knob">${k.label}<select data-knob="${k.id}"><option value="">scéna</option>${k.opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>`
      )
      .join("");
  });
  const onKnobChange = (e) => {
    if (!e.target.dataset?.knob) return;
    devKnobs = Object.fromEntries(allDevKnobSelects().filter((n) => n.value).map((n) => [n.dataset.knob, n.value]));
    applyScenario(sel.value, devKnobs);
  };
  document.querySelectorAll("[data-knob-sec]").forEach((el) => el.addEventListener("change", onKnobChange));

  const clearKnobs = () => {
    devKnobs = {};
    allDevKnobSelects().forEach((n) => (n.value = ""));
  };
  sel.addEventListener("change", () => {
    clearKnobs();
    applyScenario(sel.value, {});
    syncKnobLabels();
  });
  $("dev-reset")?.addEventListener("click", () => {
    clearKnobs();
    applyScenario(sel.value, {});
  });
  renderDevStatus();
  const togglesEl = $("dev-toggles");
  if (togglesEl) {
    LOM.TOGGLES.forEach((t) => {
      if (state.dev[t.id] === undefined) state.dev[t.id] = t.default;
    });
    togglesEl.innerHTML = LOM.TOGGLES.map(
      (t) =>
        `<label class="dev-chk has-tip" data-tip="${t.tip}"><input type="checkbox" data-toggle="${t.id}" ${state.dev[t.id] ? "checked" : ""} /> ${t.label}</label>`
    ).join("");
    togglesEl.addEventListener("change", (e) => {
      const id = e.target.dataset?.toggle;
      if (!id) return;
      state.dev[id] = e.target.checked;
      if (id === "reveal" && state.combat && !state.combat.over) {
        const last = state.combat.turns[state.combat.turns.length - 1];
        if (last) last.meta = combatMeta(state.combat);
        state.log = renderCombatLogHtml();
      }
      render();
    });
  }
  syncKnobLabels();
  syncDevUi();
}
initDevStorybook();

/* footer: 1–5 · Esc panel · v boji Q/W/E/R/F/X akce */
document.addEventListener("keydown", (e) => {
  if (e.target.matches?.("input, textarea, select")) return;
  if (e.key === "Escape") {
    if (isLootOpen()) {
      e.preventDefault();
      if (state.invDiscardIdx != null) {
        state.invDiscardIdx = null;
        renderLootModal();
      } else if (state.lootLeaveConfirm) {
        state.lootLeaveConfirm = false;
        renderLootModal();
      } else {
        attemptCloseLoot();
      }
      return;
    }
    if (state.screen === "town" && state.mode === "place" && state.placeView !== "hub") {
      e.preventDefault();
      state.placeView = "hub";
      render();
      return;
    }
    if (!$("panel")?.classList.contains("hidden")) {
      e.preventDefault();
      closePanelStep();
    }
    return;
  }
  if (!showHotkeyUi()) return;
  if (state.screen !== "town" && state.screen !== "combat") return;
  const panelClosed = $("panel")?.classList.contains("hidden") ?? true;
  const lootClosed = !isLootOpen();
  if (
    state.screen === "combat" &&
    state.combat &&
    !state.combat.over &&
    !state.combat.busy &&
    panelClosed &&
    lootClosed &&
    !e.repeat
  ) {
    const combatKeys = {
      q: "quick",
      w: "heavy",
      e: "guard",
      r: "evade",
      s: "special",
      d: "observe",
      f: "potion",
      g: "foresight",
      x: "flee",
    };
    const move = combatKeys[e.key.toLowerCase()];
    if (move) {
      e.preventDefault();
      document.querySelector(`[data-act="combat"][data-move="${move}"]`)?.click();
      return;
    }
  }
  const map = {
    1: "open-char",
    2: "open-inv",
    3: "open-quests",
    4: "open-map",
    5: "open-settings",
  };
  const act = map[e.key];
  if (!act) return;
  e.preventDefault();
  document.querySelector(`[data-act="${act}"]`)?.click();
});

document.addEventListener("input", (e) => {
  if (e.target?.id !== "input-name") return;
  const clean = sanitizeHeroName(e.target.value);
  if (e.target.value !== clean) {
    const pos = e.target.selectionStart;
    e.target.value = clean;
    if (typeof pos === "number") e.target.setSelectionRange(Math.max(0, pos - 1), Math.max(0, pos - 1));
  }
  updateStartGate();
});

document.addEventListener("click", (e) => {
  const icon = e.target.closest(".stat-icon");
  if (!icon) {
    document.querySelectorAll(".stat-icon.is-tip").forEach((n) => n.classList.remove("is-tip"));
    if (!e.target.closest("abbr.kodex")) hideFloatTip();
  }
});

/* wheel nad sticky zpět → scroll těla akčního panelu */
document.addEventListener(
  "wheel",
  (e) => {
    const sticky = e.target.closest?.(".action-sticky");
    if (!sticky) return;
    const scroller = sticky.parentElement?.querySelector(".action-scroll");
    if (!scroller) return;
    scroller.scrollTop += e.deltaY;
    e.preventDefault();
  },
  { passive: false }
);

document.querySelectorAll(".origin-acc").forEach((el) => {
  el.addEventListener("toggle", () => {
    /* jen jedna sekce otevřená (v shrnutí po prologu jsou otevřené všechny) */
    if (el.open && !state.prologStory) {
      document.querySelectorAll(".origin-acc").forEach((other) => {
        if (other !== el) other.open = false;
      });
    }
  });
});

(() => {
  const el = $("landing-version");
  if (el) el.textContent = `Verze ${APP_VERSION} · © ${APP_YEAR} Land of Machala · lowcash`;
})();
setAuth("register");
if (PUBLIC_DEMO) {
  state.guest = true;
  setScreen("origins");
} else setScreen("landing");
