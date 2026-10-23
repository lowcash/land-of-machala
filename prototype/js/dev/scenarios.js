/*
 * Storybook scénáře (jen dev). Scénář = celá scéna: známý výchozí stav + seed; Reset ji staví znovu.
 * Pole: view (town|exits|healer|smith|bank|tavern|market|gate|townhall|combat|landing|origins|confirm) · at [x,y] · picks · level · xp ·
 *       gold · bank · bag (ids | "full") · bagAdd · hpPct · phase (morning|noon|afternoon|evening|night) · corpse · encounter ·
 *       fight { enemy, enemyHpPct, loot } · spots [{x,y,enemy,when}] · quests · day · variant · kauza · piles · stash ·
 *       placeView · log · note.
 * Pracovní sada teď: jen skupina Prolog. Ostatní regresní scény jsou pryč, ať je přehled čitelný.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SYSTEMS = [
    { name: "Boj 1v1 (akce, zdroj, AI)", status: "funguje", pct: 100, note: "js/systems/combat.js, simulace + testy" },
    { name: "Čtení záměru", status: "funguje", pct: 100, note: "INT, zkušenost, pozorování, odvar předtuchy" },
    { name: "Inventář, výbava, váha", status: "funguje", pct: 100, note: "" },
    { name: "Zástava (úschova)", status: "funguje", pct: 100, note: "" },
    { name: "Mapa a pohyb", status: "funguje", pct: 100, note: "" },
    { name: "Setkání na cestě (pevná místa)", status: "funguje", pct: 80, note: "stopy ve dne, obnova po dni" },
    { name: "Smrt a corpse", status: "funguje", pct: 90, note: "" },
    { name: "HP, léčení, spánek", status: "funguje", pct: 90, note: "" },
    { name: "Herní čas (den/noc)", status: "funguje", pct: 60, note: "" },
    { name: "Úrovně a XP", status: "funguje", pct: 70, note: "" },
    { name: "Obchod a služby", status: "maketa", pct: 55, note: "" },
    { name: "Dialogy NPC", status: "maketa", pct: 30, note: "" },
    { name: "Kauza Zvon (pilot)", status: "funguje", pct: 55, note: "" },
    { name: "Questy (3 kusy)", status: "funguje", pct: 60, note: "" },
    { name: "Postava: kraj, živnost, původ", status: "funguje", pct: 85, note: "" },
    { name: "Úvodní scéna prologu", status: "funguje", pct: 100, note: "krčma, zvon, mezivěty", phase: "FP1" },
    { name: "Ukládání v prohlížeči", status: "funguje", pct: 80, note: "" },
    { name: "Účet a server", status: "maketa", pct: 5, note: "", phase: "server" },
  ];

  const SCENARIOS = [
    {
      id: "start-landing",
      group: "Prolog",
      label: "Landing (účet / pokračovat)",
      view: "landing",
      note: "Continue vrstva (Hynek) + Odhlásit → účet. Brand/citát/footer vždy. Veřejné demo landing přeskočí.",
    },
    { id: "start-origins", group: "Prolog", label: "Prolog (volby)", view: "origins", note: "Kroky: živnost → kraj → zvon → původ; počet se může měnit." },
    {
      id: "start-confirm",
      group: "Prolog",
      label: "Postava · Pacholek · Zdejší",
      view: "confirm",
      picks: { class: "mercenary", race: "local", origin: "native" },
      note: "Po prologu: shrnutí + jméno. Label ve výběru scén sleduje knoby (živnost · kraj · původ).",
    },
    {
      id: "start-morning",
      group: "Prolog",
      label: "Ráno: seník (konec dema)",
      view: "demo-morning",
      demoEnd: true,
      picks: { class: "mercenary", race: "local", origin: "native" },
      prologDone: { class: true, race: true, origin: true },
      prologReact: "fight",
      note: "Jako veřejné demo: modal + Zkusit prolog znovu. Ostatní rána mají Vstát.",
    },
    {
      id: "morning-cottage",
      group: "Prolog",
      label: "Ráno: chalupa (střízlivý Rodák)",
      view: "demo-morning",
      picks: { class: "mercenary", race: "local", origin: "native" },
      prologDone: { class: false, race: true, origin: true },
      prologReact: "hide",
      note: "",
    },
    {
      id: "morning-lodging",
      group: "Prolog",
      label: "Ráno: nocleh (cizinec)",
      view: "demo-morning",
      picks: { class: "mercenary", race: "riverfolk", origin: "wayfarer" },
      prologDone: { class: false, race: true, origin: true },
      prologReact: "hide",
      note: "Noclehárna + Vstát.",
    },
  ];

  const AT = { town: [3, 3], road: [3, 2], north: [3, 1], lada: [3, 0], plains: [1, 4], forest: [2, 5], forest_edge: [2, 4], hills: [0, 6], chapel: [4, 4], camp: [5, 6] };
  const atKey = (at) => Object.entries(AT).find(([, v]) => at && v[0] === at[0] && v[1] === at[1])?.[0] || "";

  const toMap = (sc) => {
    if (!sc._view && !sc.fight && (sc.view == null || sc.view === "town")) sc.view = "exits";
  };

  const KNOBS = [
    {
      id: "view",
      label: "Obrazovka",
      opts: [
        ["landing", "Úvod"],
        ["origins", "Prolog"],
        ["confirm", "Postava"],
        ["town", "Město"],
        ["exits", "Mapa"],
        ["smith", "Kovárna"],
        ["tavern", "Krčma"],
      ],
      from: (sc) => sc.view || "origins",
      apply: (sc, v) => {
        sc.view = v;
        sc._view = true;
      },
    },
    {
      id: "at",
      label: "Poloha",
      opts: [
        ["town", "Ostrožná (3,3)"],
        ["road", "Cesta (3,2)"],
        ["forest", "Les (2,5)"],
      ],
      from: (sc) => atKey(sc.at),
      apply: (sc, v) => {
        sc.at = AT[v];
        toMap(sc);
      },
    },
    {
      id: "class",
      label: "Živnost",
      opts: [
        ["mercenary", "Pacholek"],
        ["tracker", "Dřevorubec"],
        ["chanter", "Bylinkář"],
        ["legist", "Písař"],
      ],
      from: (sc) => sc.picks?.class || "mercenary",
      apply: (sc, v) => {
        sc.picks = { ...(sc.picks || {}), class: v };
      },
    },
    {
      id: "race",
      label: "Kraj",
      opts: [
        ["local", "Zdejší"],
        ["saltfolk", "Solníci"],
        ["woodfolk", "Slatiňané"],
        ["riverfolk", "Brodáci"],
        ["hillfolk", "Pasečané"],
      ],
      from: (sc) => sc.picks?.race || "local",
      apply: (sc, v) => {
        sc.picks = { ...(sc.picks || {}), race: v };
      },
    },
    {
      id: "origin",
      label: "Původ",
      opts: [
        ["debtor", "Dlužník"],
        ["apprentice", "Učeň"],
        ["watchman", "Strážný"],
        ["wayfarer", "Poutník"],
        ["exile", "Vyhnanec"],
        ["native", "Rodák"],
      ],
      from: (sc) => sc.picks?.origin || "",
      apply: (sc, v) => {
        sc.picks = { ...(sc.picks || {}), origin: v };
      },
    },
    {
      id: "phase",
      label: "Doba",
      opts: [
        ["morning", "ráno"],
        ["noon", "poledne"],
        ["evening", "večer"],
        ["night", "noc"],
      ],
      from: (sc) => sc.phase || "",
      apply: (sc, v) => {
        sc.phase = v;
      },
    },
    {
      id: "gold",
      label: "Zlato",
      opts: [
        ["0", "0"],
        ["80", "80"],
        ["500", "500"],
      ],
      from: (sc) => (sc.gold != null ? String(sc.gold) : ""),
      apply: (sc, v) => {
        sc.gold = Number(v);
      },
    },
  ];

  const TOGGLES = [
    {
      id: "reveal",
      label: "Skutečný záměr v boji",
      default: true,
      tip: "V boji ukáže pod indicií i skutečný záměr. V ostré hře to hráč nevidí.",
    },
    {
      id: "truth",
      label: "Pravda kauz",
      default: false,
      tip: "V Zápisníku ukáže skutečnou pravdu fám. Hráč ji normálně nevidí.",
    },
    {
      id: "spots",
      label: "Všechna místa na mapě",
      default: false,
      tip: "Na mapě všechna aktivní místa setkání (⚠).",
    },
  ];

  const GROUPS = [...new Set(SCENARIOS.map((sc) => sc.group))];

  return { SCENARIOS, GROUPS, SYSTEMS, KNOBS, TOGGLES };
});
