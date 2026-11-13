/*
 * Storybook scénáře (jen dev). Scénář = celá scéna: známý výchozí stav + seed; Reset ji staví znovu.
 * Pole: place · phase · picks · …
 * Režimy a knoby pro boj, mapu a postavu po prologu tu nejsou.
 * Prolog krčma = pečené JPEG (S1/S2 × doba); 2.5D skladba scény zrušena (pravda = 3d + approved).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SYSTEMS = [
    { name: "Herní čas (den/noc)", status: "funguje", pct: 60, note: "" },
    { name: "Postava: kraj, živnost, původ", status: "funguje", pct: 85, note: "" },
    { name: "Úvodní scéna prologu", status: "funguje", pct: 100, note: "krčma pečená S1/S2 × doba", phase: "FP1" },
    { name: "Účet a server", status: "maketa", pct: 5, note: "", phase: "server" },
  ];

  const PLACE_OPTS = [["tavern", "Krčma"]];

  /* Prozatím jen S1: ukázka = 4 kroky prologu. */
  const SCENARIOS = [
    {
      id: "start-origins",
      group: "Prolog",
      label: "Prolog · S1",
      place: "tavern",
      phase: "evening",
      tip: "Pečená krčma; Doba přepíná morning/noon/evening/night. Po 4 krocích konec ukázky.",
    },
  ];

  const KNOBS = [
    {
      id: "place",
      label: "Místnost",
      opts: PLACE_OPTS,
      from: (sc) => sc.place || "tavern",
      apply: (sc, v) => {
        sc.place = v;
        sc._place = true;
      },
    },
    {
      id: "phase",
      label: "Čas",
      /* 4 pečené doby + live (wall clock Europe/Prague); afternoon ve hře = evening bake */
      opts: [
        ["morning", "ráno"],
        ["noon", "poledne"],
        ["evening", "večer"],
        ["night", "noc"],
        ["live", "živé"],
      ],
      from: (sc) => {
        if (sc.phase) return sc.phase === "afternoon" ? "evening" : sc.phase;
        return "evening";
      },
      apply: (sc, v) => {
        if (v === "live") {
          /* UI-only "živé": resolve Europe/Prague hour to a bake phase (same cuts as SceneCompose.phaseOfHour). */
          let hour = new Date().getHours();
          try {
            const parts = new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/Prague",
              hour: "numeric",
              hourCycle: "h23",
            }).formatToParts(new Date());
            const hp = parts.find((p) => p.type === "hour");
            if (hp) hour = Number(hp.value);
          } catch (_) {}
          sc.phase =
            hour >= 5 && hour < 10 ? "morning" : hour >= 10 && hour < 15 ? "noon" : hour >= 15 && hour < 21 ? "evening" : "night";
          return;
        }
        sc.phase = v === "afternoon" ? "evening" : v;
      },
    },
    {
      id: "prologShot",
      label: "Záběr",
      tip: "Jen pečené pozadí (S1/S2); stejný crossfade jako Doba. Nemění text ani volby prologu.",
      opts: [
        ["s1", "Pozice 1 · U stolu (S1)"],
        ["s2", "jen pozice 2 · Vpravo u krbu (S2)"],
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
      tip: "Fotorealismus (jediný styl); stejné záběry a doby.",
      opts: [
        ["photoreal", "fotorealismus"],
      ],
      from: (sc) => sc.prologStyle || "photoreal",
      apply: (sc, v) => {
        sc.prologStyle = v;
      },
    },
  ];

  const TOGGLES = [
    {
      id: "hitboxes",
      label: "Ohraničení UI",
      group: "debug",
      default: false,
      tip: "Kolizní / hitbox obrysy (jen prvky ve scéně): šipky, scroll, volby, oko, bake, ovládání lišty.",
    },
  ];

  const GROUPS = [...new Set(SCENARIOS.map((s) => s.group))];
  return { SCENARIOS, GROUPS, SYSTEMS, KNOBS, TOGGLES };
});
