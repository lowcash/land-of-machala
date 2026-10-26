/*
 * Storybook scénáře (jen dev). Scénář = celá scéna: známý výchozí stav + seed; Reset ji staví znovu.
 * Pole: mode (landing|origins|confirm|play|wake) · place · at · phase · demoEnd · picks · …
 * Prolog krčma = pečené JPEG (S1/S2 × doba); 2.5D skladba scény zrušena (pravda = tools/stage3d + approved).
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
    { name: "Úvodní scéna prologu", status: "funguje", pct: 100, note: "krčma pečená S1/S2 × doba", phase: "FP1" },
    { name: "Ukládání v prohlížeči", status: "funguje", pct: 80, note: "" },
    { name: "Účet a server", status: "maketa", pct: 5, note: "", phase: "server" },
  ];

  const PLACE_OPTS = [
    ["town", "Vesnice"],
    ["tavern", "Krčma"],
    ["market", "Trh"],
    ["smith", "Kovárna"],
    ["healer", "Bylinářka"],
    ["bank", "Zástava"],
    ["gate", "Brána"],
    ["townhall", "Radnice"],
    ["hayloft", "Seník"],
    ["cottage", "Chalupa"],
    ["lodging", "Nocleh"],
    ["graveyard", "Hřbitov"],
    ["pasture", "Pastvina"],
    ["exits", "Mapa"],
  ];
  const PLACE_IDS = new Set(PLACE_OPTS.map(([id]) => id));
  const MODES = new Set(["landing", "origins", "confirm", "play", "wake", "combat"]);

  /** Legacy screen/event/view → mode + place */
  function splitScenario(sc) {
    let mode = sc.mode;
    let place = sc.place || "town";
    if (!mode) {
      if (sc.event === "wake" || sc.morningModal) mode = "wake";
      else if (sc.screen === "game") mode = "play";
      else if (sc.screen && MODES.has(sc.screen)) mode = sc.screen;
      else if (sc.view === "landing" || sc.view === "origins" || sc.view === "confirm") mode = sc.view;
      else if (sc.view === "demo-morning") {
        mode = "wake";
        place = sc.place || "hayloft";
      } else if (sc.view === "combat" || sc.fight) mode = "combat";
      else if (PLACE_IDS.has(sc.view)) {
        mode = "play";
        place = sc.view;
      } else mode = "origins";
    }
    if (sc.view && PLACE_IDS.has(sc.view) && !sc.place) place = sc.view;
    return { mode, place };
  }

  /* Prozatím jen S1: veřejná ukázka = 4 kroky prologu (bez Postavy / rán). Ostatní režimy přes knoby. */
  const SCENARIOS = [
    {
      id: "start-origins",
      group: "Prolog",
      label: "Svatava (S1)",
      mode: "origins",
      place: "tavern",
      phase: "evening",
      tip: "Pečená krčma; Doba přepíná morning/noon/evening/night. Po 4 krocích konec ukázky.",
    },
  ];

  const AT = { town: [3, 3], road: [3, 2], north: [3, 1], lada: [3, 0], plains: [1, 4], forest: [2, 5], forest_edge: [2, 4], hills: [0, 6], chapel: [4, 4], camp: [5, 6] };
  const atKey = (at) => Object.entries(AT).find(([, v]) => at && v[0] === at[0] && v[1] === at[1])?.[0] || "";

  const toMap = (sc) => {
    const { mode } = splitScenario(sc);
    if (!sc._place && (mode === "play" || mode === "wake") && (!sc.place || sc.place === "town")) sc.place = "exits";
  };

  /** Slunce pro stage3d testy (stejné hodnoty jako tools/stage3d/stage.js). */
  const STAGE_SUN = {
    morning: { az: 110, el: 18 },
    noon: { az: 180, el: 62 },
    afternoon: { az: 225, el: 38 },
    evening: { az: 250, el: 8 },
    night: { az: 235, el: 40, moon: true },
  };

  const KNOBS = [
    {
      id: "mode",
      label: "Režim",
      opts: [
        ["landing", "Landing"],
        ["origins", "Prolog"],
        ["confirm", "Postava"],
        ["play", "Hra"],
        ["wake", "Probuzení"],
      ],
      from: (sc) => splitScenario(sc).mode,
      apply: (sc, v) => {
        sc.mode = v;
      },
    },
    {
      id: "place",
      label: "Místo",
      opts: PLACE_OPTS,
      from: (sc) => splitScenario(sc).place,
      apply: (sc, v) => {
        sc.place = v;
        sc._place = true;
      },
    },
    {
      id: "phase",
      label: "Doba",
      /* 4 pečené doby (afternoon ve hře = evening bake) */
      opts: [
        ["morning", "ráno"],
        ["noon", "poledne"],
        ["evening", "večer"],
        ["night", "noc"],
      ],
      from: (sc) => {
        if (sc.phase) return sc.phase === "afternoon" ? "evening" : sc.phase;
        const { mode } = splitScenario(sc);
        if (mode === "wake") return sc.prologDone?.class ? "noon" : "morning";
        return "evening";
      },
      apply: (sc, v) => {
        sc.phase = v === "afternoon" ? "evening" : v;
      },
    },
    {
      id: "prologShot",
      label: "Záběr",
      onMode: "origins",
      tip: "Jen pečené pozadí (S1/S2); stejný crossfade jako Doba. Nemění text ani volby prologu.",
      opts: [
        ["s1", "Svatava (S1)"],
        ["s2", "jen pijan (S2)"],
      ],
      from: (sc) =>
        sc.prologShot === "s1" || sc.prologShot === "s2"
          ? sc.prologShot
          : sc.originStep > 0 || sc.prologDone?.class
            ? "s2"
            : "s1",
      apply: (sc, v) => {
        sc.prologShot = v === "s2" ? "s2" : "s1";
      },
    },
    {
      id: "prologStyle",
      label: "Styl obrazu",
      onMode: "origins",
      tip: "Fotorealismus nebo ilustrace; stejné záběry a doby.",
      opts: [
        ["photoreal", "fotorealismus"],
        ["illustrated", "ilustrace"],
      ],
      from: (sc) => sc.prologStyle || "photoreal",
      apply: (sc, v) => {
        sc.prologStyle = v;
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
      from: (sc) => atKey(sc.at) || "town",
      apply: (sc, v) => {
        sc.at = AT[v];
        toMap(sc);
      },
    },
    {
      id: "demoEnd",
      label: "Demo",
      type: "check",
      onMode: "wake",
      tip: "Konec ukázky: ráno nabídne „Zkusit prolog znovu“. Jen v režimu Probuzení.",
      from: (sc) => !!sc.demoEnd,
      apply: (sc, v) => {
        sc.demoEnd = v === "1" || v === true;
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
      id: "drank",
      label: "Po noci",
      opts: [
        ["0", "vystřízlivělý"],
        ["1", "po chlastu"],
      ],
      from: (sc) => (sc.prologDone?.class ? "1" : "0"),
      apply: (sc, v) => {
        sc.prologDone = { ...(sc.prologDone || { race: true, origin: true }), class: v === "1" };
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
        sc.prologDone = { ...(sc.prologDone || {}), race: true };
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
      from: (sc) => sc.picks?.origin || "native",
      apply: (sc, v) => {
        sc.picks = { ...(sc.picks || {}), origin: v };
        sc.prologDone = { ...(sc.prologDone || {}), origin: true };
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
      from: (sc) => (sc.gold != null ? String(sc.gold) : "80"),
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
    {
      id: "hitboxes",
      label: "Ohraničení UI",
      group: "debug",
      default: false,
      tip: "Kolizní / hitbox obrysy (jen prvky ve scéně): šipky, scroll, volby, oko, bake, ovládání lišty.",
    },
  ];

  const GROUPS = [...new Set(SCENARIOS.map((s) => s.group))];
  return { SCENARIOS, GROUPS, SYSTEMS, KNOBS, TOGGLES, STAGE_SUN };
});
