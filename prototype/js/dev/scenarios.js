/*
 * Storybook scénáře (jen dev). Scénář = celá scéna: známý výchozí stav + seed; Reset ji staví znovu.
 * Pole: view (town|exits|healer|smith|bank|tavern|market|gate|townhall|combat|landing|origins|confirm) · at [x,y] · picks · level · xp ·
 *       gold · bank · bag (ids | "full") · bagAdd · hpPct · phase (morning|noon|afternoon|evening|night) · corpse · encounter ·
 *       fight { enemy, enemyHpPct, loot } · spots [{x,y,enemy,when}] (přepíše vygenerovaná místa) · quests { id: {status,progress} } ·
 *       day · variant (A|B|C) · kauza { heard[], verified[], startDay, campSeen, trust } ·
 *       piles [{ x, y, kind: open|buried, items[], day, tick }] · stash [{ id, day }] · placeView (hub|talk|services|stash|people) · log (věta do logu města) · note.
 * Scéna nastaví vše; KNOBS pak libovolné pole přepíšou (každý knob = jedno pole scény, `from` ukáže hodnotu scény,
 * `apply` ji přepíše). Změna knobu postaví celou scénu znovu. TOGGLES = přepínače dev režimu (nemění scénu).
 * SYSTEMS = stav systémů pro přehled v dev liště (pct = hrubý odhad hotovosti).
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
    { name: "Banka", status: "funguje", pct: 100, note: "" },
    { name: "Mapa a pohyb", status: "funguje", pct: 100, note: "" },
    { name: "Setkání na cestě (pevná místa)", status: "funguje", pct: 80, note: "" },
    { name: "Smrt a corpse", status: "funguje", pct: 90, note: "" },
    { name: "HP, léčení, spánek", status: "funguje", pct: 90, note: "" },
    { name: "Herní čas (den/noc)", status: "funguje", pct: 60, note: "" },
    { name: "Úrovně a XP", status: "funguje", pct: 70, note: "" },
    { name: "Obchod a služby", status: "maketa", pct: 55, note: "" },
    { name: "Dialogy NPC", status: "maketa", pct: 30, note: "text bez dopadu na hru" },
    { name: "Varianty vět a více lidí na místě", status: "funguje", pct: 60, note: "formát a výběr s testy; obsah jen ukázkový (hospoda, léčitel, brána)" },
    { name: "Úschovna, odložení a zakopání věcí", status: "funguje", pct: 75, note: "" },
    { name: "Kauza Zvon: fámy, ověřování, verdikty (pilot)", status: "funguje", pct: 55, note: "pravidla + testy; příběh a postavy zkušební; bez serveru a grafiky" },
    { name: "Questy (3 kusy)", status: "funguje", pct: 60, note: "" },
    { name: "Postava: rasa, povolání, původ", status: "funguje", pct: 85, note: "" },
    { name: "Žebříčky", status: "maketa", pct: 5, note: "" },
    { name: "Ukládání v prohlížeči", status: "funguje", pct: 80, note: "localStorage: auto-save, Pokračovat, smazání; boj se neobnovuje; jedno uložení na prohlížeč" },
    { name: "Účet a server", status: "maketa", pct: 5, note: "" },
  ];

  const SCENARIOS = [
    { id: "start-landing", group: "Start", label: "Úvod (přihlášení, host)", view: "landing", note: "Úvodní obrazovka: registrace, přihlášení, host, případně Pokračovat." },
    { id: "start-origins", group: "Start", label: "Prolog (volby před Postavou)", view: "origins", note: "Tři kroky prologu, pak Postava (rasa, povolání, původ)." },
    { id: "start-confirm", group: "Start", label: "Postava (rasa, povolání, původ)", view: "confirm", note: "Výběr rasy, povolání a původu a vstup do hry." },
    { id: "start-fresh", group: "Start", label: "Hra od nuly (průchod celou smyčkou)", view: "town", note: "Čerstvá postava ve městě bez fixtures: projdi hospodu, cestu, boj, kauzu Zvon do verdiktu a reload (Pokračovat). Dev scény neukládají." },
    { id: "origin-apprentice", group: "Start", label: "Původ: učeň v kovárně", view: "smith", picks: { class: "mercenary", race: "local", origin: "apprentice" }, seed: 50, note: "Karel dává slevu (standing +2). Zkontroluj ceny mečů." },
    { id: "origin-exile", group: "Start", label: "Původ: vyhnanec před městem", view: "exits", at: [2, 5], picks: { class: "mercenary", race: "local", origin: "exile" }, spots: [], seed: 51, note: "Okraj lesa, málo zlata; u brány napomenutí." },
    { id: "kodex-words", group: "Svět", label: "Kodex: hesla v textu", view: "town", seed: 40, note: "", log: "Na rynku se šeptá, že zeman z hvozdu prodal půdu." },
    { id: "town-start", group: "Město", label: "Čerstvá postava v Machale", view: "town", note: "Základ: služby, banka, mapa." },
    { id: "market-full-bag", group: "Město", label: "Tržiště s plným batohem", view: "market", bag: "full", gold: 100, seed: 12, note: "Zkus koupit odvar: nevejde se a zlato se nestrhne. Chléb (+8 HP) funguje bez místa." },
    { id: "healer-hurt", group: "Město", label: "Léčitel — zraněný hrdina", view: "healer", hpPct: 0.3, gold: 80, seed: 13, note: "" },
    { id: "fight-wolf", group: "Boj", label: "Vlk — plné HP (baseline)", fight: { enemy: "wolf" }, seed: 1, note: "Vlk je rychlý (většinou výpad). Zkus: výpad → úhyb, těžký → obrana." },
    { id: "fight-wolf-low-hp", group: "Boj", label: "Vlk — nízké HP", fight: { enemy: "wolf" }, hpPct: 0.2, seed: 2, note: "Pij odvar, braň se (obnoví zdroj) nebo uteč. Prohra = smrt s corpse." },
    { id: "fight-boar", group: "Boj", label: "Divočák — těžké údery", fight: { enemy: "boar" }, seed: 3, note: "Často těžký úder: obrana a protiúder se vyplatí." },
    { id: "fight-bandit", group: "Boj", label: "Bandita — přizpůsobí se", fight: { enemy: "bandit" }, seed: 4, note: "Zahraj třikrát stejnou akci a sleduj změnu." },
    { id: "fight-bandit-hurt", group: "Boj", label: "Bandita — skoro poražený", fight: { enemy: "bandit", enemyHpPct: 0.24 }, seed: 5, note: "Nabídne vzdání. Ušetřit = méně zlata, bez kořisti." },
    { id: "fight-brigand", group: "Boj", label: "Zbojník — elita, klame", fight: { enemy: "brigand" }, seed: 6, bag: ["potion", "potion", "foresight", "ration"], note: "Indicie často lže. Pozoruj, zkus odvar předtuchy." },
    { id: "fight-foresight", group: "Čtení záměru", label: "Bandita + odvar předtuchy", fight: { enemy: "bandit" }, seed: 7, bag: ["potion", "foresight", "foresight"], note: "Vypij odvar (stojí tah) a sleduj jistotu indicie." },
    { id: "fight-chanter-reader", group: "Čtení záměru", label: "Zaříkávač (vysoké INT) vs. bandita", picks: { class: "chanter", race: "woodfolk" }, fight: { enemy: "bandit" }, seed: 8, note: "Vyšší INT = jistější indicie." },
    { id: "loot-bag-full", group: "Kořist", label: "Plný batoh + vítězství", fight: { enemy: "wolf", enemyHpPct: 0.06, loot: ["wolf-tooth"] }, bag: "full", seed: 9, note: "Dokonči vlka; kořist se nevejde." },
    { id: "levelup-near", group: "Postup", label: "Skoro nová úroveň", fight: { enemy: "wolf", enemyHpPct: 0.05 }, xp: 45, seed: 14, note: "Dobij vlka: +XP přeteče do Lv 2 a staty vzrostou." },
    { id: "road-travel", group: "Cesta", label: "Stopy před tebou (den)", view: "exits", at: [3, 2], phase: "noon", spots: [{ x: 3, y: 1, enemy: "bandit" }], seed: 10, note: "Ve dne vidíš ⚠ na sousedním políčku. Můžeš ho obejít, nebo jít schválně. Vyčištěné místo se další den obnoví." },
    { id: "forest-night", group: "Cesta", label: "Les v noci (bez stop)", view: "exits", at: [2, 4], phase: "night", spots: [{ x: 2, y: 5, enemy: "wolf" }], seed: 11, note: "V noci stopy nevidíš: do vlka vejdeš naslepo. Zkus stejnou scénu přes knob Doba = poledne." },
    { id: "encounter-bandit", group: "Cesta", label: "Setkání: bandita na cestě", view: "exits", at: [3, 2], encounter: "bandit", seed: 15, note: "Bojovat / obejít (DEX) / ustoupit." },
    { id: "corpse-recover", group: "Smrt", label: "Tvůj corpse leží v lese", view: "exits", at: [2, 5], picks: { class: "mercenary", race: "local" }, spots: [], corpse: { x: 2, y: 5, gold: 60, items: ["axe", "potion", "mail"], equipped: { weapon: "ladle", head: "helm" } }, strip: true, seed: 16, note: "Jsi ve výchozí výbavě. Tělo tě zastaví: prohledat, nebo vědomě nechat. Co se nevejde, zůstane. Mapa ukazuje 💀." },
    { id: "quest-offer", group: "Questy", label: "Lidmila nabízí úkol", view: "healer", seed: 20, note: "Rozhovor → „Nabídnout pomoc“ → Přijmout úkol. Pak otevři Úkoly (📜) a Mapu: oblast lesa je označená." },
    { id: "quest-wolves-hunt", group: "Questy", label: "Vlci: 1 z 2 hotový", view: "exits", at: [2, 4], phase: "noon", spots: [{ x: 2, y: 5, enemy: "wolf" }, { x: 3, y: 5, enemy: "wolf" }], quests: { wolves_outside: { status: "active", progress: { wolves: 1 } } }, seed: 21, note: "Vlk severně od tebe. Zabití mimo les se nepočítá. Po splnění zpět k Lidmile." },
    { id: "quest-wolves-ready", group: "Questy", label: "Vlci: odevzdat", view: "healer", quests: { wolves_outside: { status: "ready", progress: { wolves: 2 } } }, seed: 22, note: "V hlavní nabídce je „Odevzdat úkol“." },
    { id: "quest-bread", group: "Questy", label: "Chléb pro Svatavu: volba", view: "tavern", bag: ["ration"], quests: { bread_for_uda: { status: "active" } }, seed: 23, note: "Dvě volby, dva následky: cena noclehu u Svatavy se pak liší (10 / 25 místo 20)." },
    { id: "quest-letter-road", group: "Questy", label: "Dopis do Lady: cesta", view: "exits", at: [3, 2], phase: "noon", spots: [], bagAdd: ["letter"], quests: { letter_to_lada: { status: "active" } }, seed: 24, note: "" },
    { id: "quest-letter-lost", group: "Questy", label: "Dopis leží v mém těle", view: "exits", at: [2, 4], phase: "noon", picks: { class: "mercenary", race: "local" }, spots: [], corpse: { x: 2, y: 5, gold: 40, items: ["letter", "axe"], equipped: { weapon: "ladle" } }, strip: true, quests: { letter_to_lada: { status: "active" } }, seed: 25, note: "Úkol zůstal aktivní, dopis chybí. Úkoly i Mapa ukazují, kde leží. Znovu se nevydává." },
    { id: "zvon-tavern", group: "Kauza Zvon", label: "Hospoda: první fáma", view: "tavern", seed: 3, note: "Rozhovor → „drby“ → fáma od Svatavy se zapíše do Zápisníku (📜 Úkoly dole). Signál (drobná prozrazující věc) se objeví jen někdy; zkus více seedů přes Reset a knob Varianta." },
    { id: "zvon-clerk", group: "Kauza Zvon", label: "Radnice: ověřit z listin", view: "townhall", gold: 100, seed: 4, variant: "C", kauza: { heard: ["c2", "c3", "c4"] }, note: "Služby: nahlédnutí do knih za 5 🪙 ověří nebo vyvrátí fámy podle varianty. U C je bankéř pravdivý jen napůl: nelže, vynechává." },
    { id: "zvon-gate", group: "Kauza Zvon", label: "Brána: dva Petrové", view: "gate", phase: "night", seed: 5, note: "Večer a v noci stojí na bráně „druhý“ Petr: skoro stejný, jen s dýmkou. Řekne totéž." },
    { id: "zvon-camp-day", group: "Kauza Zvon", label: "Tábor v kopcích (den)", view: "exits", at: [5, 6], phase: "noon", spots: [], seed: 6, variant: "A", kauza: { heard: ["c1", "c6"] }, note: "Výchozí výbava (~5 kg). Prohlédnout tábor ověří Honzu i kasičku. Pak Vzít zvon (14 kg se vejde). Zvon je kauzová věc: z těla nezmizí, nevydá se podruhé a nikdo ho z hromádky nerozkrade." },
    { id: "zvon-camp-night", group: "Kauza Zvon", label: "Tábor v kopcích (noc)", view: "exits", at: [5, 6], phase: "night", spots: [], seed: 7, kauza: { heard: ["c1"] }, bag: ["potion", "foresight", "ration"], note: "V noci tu sedí zbojník: souboj. Po vítězství jde tábor tu noc prohlédnout. Ušetřený zbojník (při ≤ 25 % HP bandity) vydá další fámu." },
    { id: "zvon-chapel-night", group: "Kauza Zvon", label: "Kaple v noci (zaříkávač)", view: "exits", at: [4, 4], phase: "night", picks: { class: "chanter", race: "woodfolk" }, spots: [], seed: 8, kauza: { heard: ["c5", "c3"] }, note: "Naslouchat znamením: fáma Lidmily se nikdy nerozhodne (nejasné). Bez ní hráč jen cítí chlad." },
    { id: "zvon-verdict", group: "Kauza Zvon", label: "Zvon v batohu: verdikt", view: "exits", at: [4, 4], phase: "noon", spots: [], bag: ["potion", "ration"], bagAdd: ["bell"], seed: 9, variant: "B", kauza: { heard: ["c1", "c3", "c4"], campSeen: true }, note: "Vrátit zvon do kaple (zde), odevzdat Zástavě, splatit dluh (Radnice) nebo nechat si (Zápisník). Každý verdikt změní důvěru: ceny u Lidmily/Svatavy, poplatek Zástavy." },
    { id: "zvon-deadline", group: "Kauza Zvon", label: "Lhůta vypršela", view: "town", day: 6, phase: "noon", seed: 10, kauza: { heard: ["c1", "c2"], startDay: 1 }, note: "Dražba proběhla bez tebe: svět rozhodl, nic se nezablokovalo. Zápisník ukáže „co se stalo“." },
  ];

  /* Batoh: úschovna, odložení, zakopání (pravidla js/systems/stash.js) */
  SCENARIOS.push(
    { id: "bag-full-stash", group: "Batoh", label: "Plný batoh + úschovna", view: "tavern", placeView: "stash", bag: "full", gold: 60, day: 3, phase: "noon", stash: [{ id: "axe", day: 1 }], seed: 30, note: "Batoh je plný (16 věcí). Ulož věc do úschovny (6 míst), sekeru vyzvedni: 2 🪙 za započatý den, platí se při vyzvednutí. Bez místa v batohu se věc nevydá." },
    { id: "bag-shovel", group: "Batoh", label: "Odložit a zakopat (s lopatou)", view: "exits", at: [3, 2], phase: "noon", spots: [], bagAdd: ["shovel", "axe", "mail"], seed: 31, note: "Mimo město: „Odložit věc“ (hromádka 📦 na mapě, může ji někdo vzít) a „Zakopat věc“ (−2 tiky, na mapě jen poznámka). Obojí zkus a otevři Mapu." },
    { id: "bag-piles-days", group: "Batoh", label: "Odložená a zakopaná věc po 4 dnech", view: "exits", at: [3, 2], day: 5, phase: "noon", spots: [], piles: [{ x: 3, y: 1, kind: "open", items: ["axe", "mail", "potion"], day: 1, tick: 14 }, { x: 3, y: 1, kind: "buried", items: ["foresight"], day: 1, tick: 14 }], seed: 2, note: "Hromádka čeká na jihu (3,1): vydej se tam. Rozkradení se vyhodnotí až po příchodu: sekera zmizela, zbytek a zakopaný odvar zůstaly. Seed i čas jsou pevné, výsledek je vždy stejný." },
    { id: "bag-piles-stolen", group: "Batoh", label: "Věc ukradena (zvon zůstal)", view: "exits", at: [3, 2], day: 9, phase: "noon", spots: [], piles: [{ x: 3, y: 1, kind: "open", items: ["axe", "mail", "potion", "bell"], day: 1, tick: 14 }], seed: 6, note: "Jdi na jih (3,1). Po 8 dnech na silnici je pryč sekera i košile. Zvon (kauzová věc) zůstal: ten se nerozkrade nikdy." },
  );
  SCENARIOS.push(
    { id: "tavern-evening", group: "Město", label: "Hospoda večer: Štamgast", view: "tavern", phase: "evening", seed: 3, note: "Večer a v noci je u okna Štamgast. Hub má tlačítko „Rozhlédnout se po lidech“; Štamgast má vlastní otázky. Přes den je tu jen Svatava a hub je beze změny. Věty (popis, pozdrav, odpovědi) se při návratech střídají." },
  );

  const AT = { town: [3, 3], road: [3, 2], north: [3, 1], lada: [3, 0], plains: [1, 4], forest: [2, 5], forest_edge: [2, 4], hills: [0, 6], chapel: [4, 4], camp: [5, 6] };
  const atKey = (at) => Object.entries(AT).find(([, v]) => at && v[0] === at[0] && v[1] === at[1])?.[0] || "";
  const QUEST_PRESETS = {
    none: { quests: {} },
    wolves_active: { quests: { wolves_outside: { status: "active", progress: { wolves: 1 } } } },
    wolves_ready: { quests: { wolves_outside: { status: "ready", progress: { wolves: 2 } } } },
    bread_active: { quests: { bread_for_uda: { status: "active" } }, bagAdd: ["ration"] },
    letter_active: { quests: { letter_to_lada: { status: "active" } }, bagAdd: ["letter"] },
    all_active: { quests: { wolves_outside: { status: "active", progress: {} }, bread_for_uda: { status: "active" }, letter_to_lada: { status: "active" } }, bagAdd: ["letter"] },
  };
  const questKey = (sc) => {
    const ids = Object.keys(sc.quests || {}).sort().join();
    if (!ids) return "none";
    return Object.entries(QUEST_PRESETS).find(([, p]) => Object.keys(p.quests).sort().join() === ids && JSON.stringify(p.quests) === JSON.stringify(sc.quests))?.[0] || "";
  };

  /* knoby, které dávají smysl jen na mapě, přepnou scénu z města na mapu (pokud obrazovku nezadal knob Obrazovka) */
  const toMap = (sc) => {
    if (!sc._view && !sc.fight && (sc.view == null || sc.view === "town")) sc.view = "exits";
  };

  /* Knob = jedno pole scény. [hodnota, popisek]; hodnota "" = nechat ze scény. */
  const KNOBS = [
    { id: "view", label: "Obrazovka", opts: [["town", "Město"], ["exits", "Mapa / cesta"], ["healer", "Léčitel"], ["smith", "Kovárna"], ["bank", "Banka"], ["tavern", "Hospoda"], ["market", "Tržiště"], ["gate", "Brána"], ["townhall", "Radnice"], ["combat", "Boj"], ["landing", "Úvod"], ["origins", "Prolog"], ["confirm", "Původ"]],
      from: (sc) => sc.view || (sc.fight ? "combat" : "town"), apply: (sc, v) => { sc.view = v; sc._view = true; } },
    { id: "at", label: "Poloha", opts: [["town", "Machala (3,3)"], ["road", "Cesta u města (3,2)"], ["north", "Cesta na sever (3,1)"], ["lada", "Lada (3,0)"], ["plains", "Louky (1,4)"], ["forest_edge", "Kraj lesa (2,4)"], ["forest", "Les (2,5)"], ["hills", "Kopce (0,6)"], ["chapel", "Kaple (4,4)"], ["camp", "Tábor (5,6)"]],
      from: (sc) => atKey(sc.at), apply: (sc, v) => { sc.at = AT[v]; toMap(sc); } },
    { id: "class", label: "Povolání", opts: [["mercenary", "Žoldák"], ["tracker", "Stopař"], ["chanter", "Zaříkávač"], ["legist", "Zákoník"]],
      from: (sc) => sc.picks?.class || "mercenary", apply: (sc, v) => { sc.picks = { ...(sc.picks || {}), class: v }; } },
    { id: "race", label: "Rasa", opts: [["local", "Zdejší"], ["saltfolk", "Solníci"], ["woodfolk", "Hvozdáci"], ["riverfolk", "Brodáci"], ["hillfolk", "Pasekáři"]],
      from: (sc) => sc.picks?.race || "local", apply: (sc, v) => { sc.picks = { ...(sc.picks || {}), race: v }; } },
    { id: "enemy", label: "Nepřítel v boji", opts: [["wolf", "Vlk"], ["boar", "Divočák"], ["bandit", "Bandita"], ["brigand", "Zbojník"]],
      from: (sc) => sc.fight?.enemy || "", apply: (sc, v) => { sc.fight = { ...(sc.fight || {}), enemy: v }; if (!sc._view) sc.view = "combat"; } },
    { id: "enemyHp", label: "HP nepřítele", opts: [["1", "100 %"], ["0.5", "50 %"], ["0.24", "24 % (vzdá se)"], ["0.06", "6 %"]],
      from: (sc) => (sc.fight?.enemyHpPct != null ? String(sc.fight.enemyHpPct) : ""), apply: (sc, v) => { sc.fight = { ...(sc.fight || {}), enemyHpPct: Number(v) }; if (!sc._view) sc.view = "combat"; } },
    { id: "encounter", label: "Čeká setkání", opts: [["none", "žádné"], ["wolf", "Vlk"], ["boar", "Divočák"], ["bandit", "Bandita"], ["brigand", "Zbojník"]],
      from: (sc) => sc.encounter || (sc.view === "exits" || sc.at ? "none" : ""), apply: (sc, v) => { sc.encounter = v === "none" ? null : v; if (v !== "none") toMap(sc); } },
    { id: "hp", label: "HP hráče", opts: [["1", "100 %"], ["0.6", "60 %"], ["0.3", "30 %"], ["0.1", "10 %"]],
      from: (sc) => (sc.hpPct != null ? String(sc.hpPct) : ""), apply: (sc, v) => { sc.hpPct = Number(v); } },
    { id: "phase", label: "Doba", opts: [["morning", "ráno"], ["noon", "poledne"], ["afternoon", "odpoledne"], ["evening", "večer"], ["night", "noc"]],
      from: (sc) => sc.phase || "", apply: (sc, v) => { sc.phase = v; } },
    { id: "level", label: "Úroveň", opts: [["1", "Lv 1"], ["2", "Lv 2"], ["3", "Lv 3"], ["5", "Lv 5"]],
      from: (sc) => (sc.level ? String(sc.level) : ""), apply: (sc, v) => { sc.level = Number(v); } },
    { id: "gold", label: "Zlato", opts: [["0", "0 🪙"], ["80", "80 🪙"], ["500", "500 🪙"]],
      from: (sc) => (sc.gold != null ? String(sc.gold) : ""), apply: (sc, v) => { sc.gold = Number(v); } },
    { id: "bag", label: "Batoh", opts: [["default", "výchozí"], ["full", "plný"], ["empty", "prázdný"]],
      from: (sc) => (sc.bag === "full" ? "full" : ""), apply: (sc, v) => { sc.bag = v === "full" ? "full" : v === "empty" ? [] : null; } },
    { id: "corpse", label: "Tvé tělo", opts: [["none", "nikde"], ["forest", "v lese (2,5)"], ["north", "u cesty (3,1)"]],
      from: (sc) => (sc.corpse ? (sc.corpse.y === 5 ? "forest" : "north") : ""),
      apply: (sc, v) => {
        sc.corpse = v === "none" ? null : { x: v === "forest" ? 2 : 3, y: v === "forest" ? 5 : 1, gold: 60, items: ["axe", "potion"], equipped: { weapon: "ladle" } };
        if (v !== "none") {
          sc.strip = true;
          toMap(sc);
        }
      } },
    { id: "spots", label: "Místa setkání", opts: [["generated", "podle semínka"], ["none", "žádná"], ["wolf_south", "vlk v lese (2,5)"], ["bandit_north", "bandita na cestě (3,1)"]],
      from: (sc) => (sc.spots ? (sc.spots.length ? "" : "none") : "generated"),
      apply: (sc, v) => { toMap(sc); sc.spots = v === "generated" ? null : v === "none" ? [] : v === "wolf_south" ? [{ x: 2, y: 5, enemy: "wolf" }] : [{ x: 3, y: 1, enemy: "bandit" }]; } },
    { id: "variant", label: "Varianta kauzy", opts: [["A", "A: kaplan"], ["B", "B: Anička"], ["C", "C: banka"]],
      from: (sc) => sc.variant || "", apply: (sc, v) => { sc.variant = v; } },
    { id: "quests", label: "Úkoly", opts: [["none", "žádné"], ["wolves_active", "vlci rozdělaní"], ["wolves_ready", "vlci k odevzdání"], ["bread_active", "chléb (s chlebem)"], ["letter_active", "dopis (s dopisem)"], ["all_active", "všechny aktivní"]],
      from: questKey, apply: (sc, v) => { const p = QUEST_PRESETS[v]; sc.quests = p.quests; if (p.bagAdd) sc.bagAdd = p.bagAdd; } },
  ];

  /* Přepínače dev režimu — krátký popisek + dlouhý tooltip. Další přidávej sem. */
  const TOGGLES = [
    { id: "reveal", label: "Skutečný záměr v boji", default: true,
      tip: "V boji ukáže pod indicií i to, co nepřítel opravdu udělá, jestli se indicie mýlí a s jakou pravděpodobností sedí. V ostré hře to ví jen server a hráč dostane jen vágní indicii." },
    { id: "truth", label: "Pravda kauz", default: false,
      tip: "V Zápisníku ukáže u každé fámy skutečnou pravdu ve vybrané variantě. Hráč ji nikdy nevidí; zjišťuje ji ověřením, nebo vůbec." },
    { id: "spots", label: "Všechna místa na mapě", default: false,
      tip: "Na mapě označí všechna aktivní místa setkání (⚠) bez ohledu na denní dobu a vzdálenost. Hráč je normálně vidí jen ze sousedního políčka a jen ve dne." },
  ];

  /* skupiny scén v pořadí prvního výskytu; pořadové číslo skupiny se ukazuje ve výběru scén i v docs/reference/storybook.md */
  const GROUPS = [...new Set(SCENARIOS.map((sc) => sc.group))];

  return { SCENARIOS, GROUPS, SYSTEMS, KNOBS, TOGGLES };
});
