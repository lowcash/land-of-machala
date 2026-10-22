/*
 * Kauzy - jediný zdroj pravdy (docs/story/zvon.md je záměr, tohle je kód). Pilot: Zvon z kaple.
 * Kauza je data: NPC (spolehlivost, signál), varianty (pravda podle seedu), fámy (kdo co tvrdí, jak se ověří),
 * verdikty (dopad na důvěru a svět). Pravda fámy se rozhoduje podle varianty: true | half | false | none (nikdy se nerozhodne).
 * Spolehlivost `rel` = výchozí jistota zdroje; `tell` = jak často prozradí nepravdu drobným signálem (a = napůl, b = lež).
 * `follow` = hráčovy věty při „Vrátit se k věci“ po rozuzlení fámy, klíč `názor_pravda` (believe|doubt × true|half|false, nebo `neutral`); `after` = NPC odpověď na stejný klíč (NPC přepisuje `afterDefault`), bez mechanického trestu.
 * `react` = krátká věta NPC na hráčův názor (believe | doubt), nikdy neprozradí pravdu. `replies` = odpovědi hráče po fámě (text smí být pole variant, hint prozrazuje záměr).
 *
 * Přepis 2026-10-22: kaple zvon tajně prodala zvonaři (střecha); posel utratil peníze u Svatavy; sud praskl;
 * vozový zvon = falešná stopa; zvon v hutích do lhůty 5 dní. Varianty A/B/C = kdo co ví (fámy), ne mapa.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ZVON = {
    id: "zvon",
    title: "Zvon z kaple",
    brief: "Z kaple u cesty zmizel zvon. Sud u Svatavy praskl ve stejnou chvíli. Každý ví něco jiného.",
    deadline: { days: 5, text: "Přelití zvonu v Hutích u Jezírka" },
    bell: { weight: 14 },
    forge: { cell: [5, 6] },
    cart: { cell: [4, 5] },
    chapel: { cell: [4, 4] },
    debt: 150,
    classTag: { mercenary: "people", tracker: "tracks", chanter: "omen", legist: "paper" },
    raceTag: { local: "paper", saltfolk: "people", woodfolk: "tracks", riverfolk: "omen", hillfolk: "tracks" },

    replies: {
      believe: { you: ["„Dobře. Věřím ti.“", "„Dává to smysl. Věřím.“"], hint: "bereš to jako pravdu" },
      doubt: { you: ["„Hm. Tomu moc nevěřím.“", "„Jářku, něco se mi na tom nezdá.“"], hint: "pochybuješ" },
      neutral: { you: ["„Poznamenám si to.“", "„Dobrá, zapamatuju si to.“"], hint: "zatím nic neříkáš" },
    },

    follow: {
      believe_true: { you: ["„Měl jsi pravdu.“", "„Tak to byla pravda. Díky, že jsi to řekl.“"], hint: "potvrzuješ mu to" },
      believe_half: { you: ["„Něco na tom bylo.“"], hint: "uznáváš, že napůl" },
      believe_false: { you: ["„Lhal jsi mi.“", "„Spletl ses.“"], hint: "vytýkáš mu to" },
      doubt_false: { you: ["„Věděl jsem, že to neklape.“"], hint: "měl jsi pravdu ty" },
      doubt_half: { you: ["„Něco na tom nakonec bylo.“"], hint: "uznáváš, že napůl" },
      doubt_true: { you: ["„Omlouvám se, mýlil jsem se.“", "„Mýlil jsem se, promiň.“"], hint: "přiznáváš omyl" },
      neutral: { you: ["„Ještě jednou k tomu, co jsi říkal…“", "„Vrátím se k té věci.“"], hint: "jen to uzavíráš" },
    },
    afterDefault: {
      believe_true: ["„Vidíš.“"], believe_half: ["„Aspoň něco.“"], believe_false: ["„Slyšel jsem to od jiných.“"],
      doubt_false: ["„Tak teda ne. Stane se.“"], doubt_half: ["„Vidíš, jak to bývá.“"], doubt_true: ["„Omluva přijata.“"], neutral: ["„No jo.“"],
    },

    npcs: {
      svatava: { name: "Svatava z Přívozu", rel: 0.45, tell: 0.7, signals: { a: "Svatava počítá drobné na pultě.", b: "Svatava počítá drobné a mluví rychleji." },
        after: { believe_true: ["„Já to říkala. Pivo nelže.“"], believe_half: ["„Půl pravdy je u mě pořád celá runda.“"], believe_false: ["„Slyšela jsem to od posla. Nebo od někoho, kdo vypadal jako posel.“"], doubt_false: ["„No jo. Aspoň že jsi to ověřil, než jsi mi zakázal pít.“"], doubt_half: ["„Půlka pravdy. Víc u mě nedostaneš.“"], doubt_true: ["„Nic se neděje. Na omluvu stejně nikdo neplatí.“"], neutral: ["„Dobře, dobře. Dáš si?“"] },
        react: { believe: ["„Tak vidíš. Já říkám, jak to je.“"], doubt: ["„Nevěříš? Tvoje věc. Platit budeš tak jako tak.“"] } },
      petr: { name: "Petr", rel: 0.55, tell: 0.5, signals: { a: "Petr zopakuje poslední větu ještě jednou.", b: "Petr zopakuje poslední větu a pak ještě jednou." },
        after: { believe_true: ["„Říkal jsem to. Říkal jsem to.“"], believe_half: ["„Něco bylo. Něco. Víc nevím.“"], believe_false: ["„Ví to celé město. Ale... možná ne celé. Možná půlka.“"], doubt_false: ["„Dobře. Dobře, že ses ptal. Já se neptal.“"], doubt_half: ["„Půl pravdy. Půl pravdy je dost.“"], doubt_true: ["„Dobře. Dobře. Nic se nestalo.“"], neutral: ["„Dobře. Vlastně… dobře.“"] },
        react: { believe: ["„Dobře. Dobře, že věříš. Dobře.“"], doubt: ["„Nevěříš? Ví to celé město. Celé město.“"] } },
      anicka: { name: "Anička", rel: 0.5, tell: 0.6, signals: { a: "Anička si tiskne ruce.", b: "Anička se podívá stranou a spolkne slzy." },
        after: { believe_true: ["„Děkuju. Aspoň někdo nelže tak jako ostatní.“"], believe_half: ["Anička přikývne. „Aspoň něco. Víc mi nezbylo.“"], believe_false: ["Anička zmlkne a dlouho se dívá na dlaně. „Já nevěděla…“"], doubt_false: ["Anička se slabě pousměje. „Měl jsi pravdu. Já bych si to taky chtěla myslet.“"], doubt_half: ["„Napůl. To bolí skoro stejně.“"], doubt_true: ["„To nic. Já bych tomu v tvé kůži taky nevěřila.“"], neutral: ["„Ano, vím. Děkuju, že ses ptal.“"] },
        react: { believe: ["„Děkuju. Aspoň někdo mi věří.“"], doubt: ["Anička přikývne a mne si rukáv. „Chápu. Mně by se to taky těžko věřilo.“"] } },
      gertruda: { name: "Gertruda", rel: 0.7, tell: 0, signals: {},
        after: { believe_true: ["„Vše je v knihách. Knihy ovšem mlčí o tom, co nepřišlo.“"], believe_half: ["„Neúplné pravdy jsou nejdražší. Ale dokládá se.“"], believe_false: ["„Chyba v dokladu. Ozvěte se příště s listinou.“"], doubt_false: ["„Skepse je rozumná. Doložil jste ji listinou, to oceňuji.“"], doubt_half: ["„Skoro. Pojďme to zapsat jako skoro.“"], doubt_true: ["„Omluvy účtujeme zdarma. Tuto jednou.“"], neutral: ["„Zaznamenáno.“"] },
        react: { believe: ["„Rozumný postoj. Papíry se nemýlí. Nemýlí se ovšem ani pečeť.“"], doubt: ["„Pochybnosti jsou zdravé. Doložte je listinou.“"] } },
      gustav: { name: "Gustav", rel: 0.7, tell: 0, signals: {},
        react: { believe: ["„Dobře. Knihy si ověřte sám. Stojí to pár mincí.“"], doubt: ["„U svědka je pochybnost na místě. Kniha leží na radnici.“"] } },
      lidmila: { name: "Lidmila", rel: 0.6, tell: 0.3, signals: { a: "Lidmila ztiší hlas.", b: "Lidmila ztiší hlas a mrkne ke dveřím." },
        react: { believe: ["„Bolí to, protože je čtvrtek. Ono se ti to možná potvrdí.“"], doubt: ["„Děláš dobře. Já sama nevím, čemu věřit, a to říkám potichu.“"] } },
      ondra: { name: "Ondra od vozu", rel: 0.4, tell: 0.55, signals: { a: "Ondra si otře ústa rukávem.", b: "Ondra se podívá na zem a mlčí o vteřinu déle." },
        after: { believe_true: ["„No vidíš. Já to říkal. Jen jsem to… no.“"], believe_half: ["„Půlka. To je pořád víc než nic.“"], believe_false: ["„Slyšel jsem to od Ondřeje. Nebo od sebe. Už nevím.“"], doubt_false: ["„Dobře, že ses ptal. Já se nepamatuju, abych se ptal.“"], doubt_half: ["„Napůl. Jako ten měšec.“"], doubt_true: ["„Nic se nestalo. Aspoň doufám.“"], neutral: ["„Hm. Jo.“"] },
        react: { believe: ["„Tak jo. Aspoň jeden, kdo neřve.“"], doubt: ["„Nevěříš. Já bych taky nevěřil sobě.“"] } },
      matej: { name: "Matěj od pece", rel: 0.65, tell: 0.25, signals: { a: "Matěj otře ruce o zástěru.", b: "Matěj se podívá na pečeť a zase pryč." },
        after: { believe_true: ["„Kov nelže. Lidi občas.“"], believe_half: ["„Půlka pravdy. Druhá půlka je ještě v peci.“"], believe_false: ["„Slyšel jsem to od písaře. Písaři mají pečeť i bez nápisu.“"], doubt_false: ["„Dobře. Kov počká, ty ne.“"], doubt_half: ["„Skoro. Na skoro se zvon nepřelije.“"], doubt_true: ["„Omluva přijata. Pec taky.“"], neutral: ["„Dobrá.“"] },
        react: { believe: ["„Rozumné. Zvon ještě není kov.“"], doubt: ["„Pochybuj. Já taky, dokud nepodepíšu.“"] } },
    },

    /* A nikdo neví celé · B ostuda mlčí · C prst Komory (náznak pečeti) */
    variants: {
      A: { label: "Omyl", epilog: "Kaple zvon prodala Matějovi na přelití (střecha). Posel Ondra od vozu peníze utratil u Svatavy; ona za ně koupila sud, který praskl. Nikdo neznal celý řetěz, dokud jsi ho nespojil." },
      B: { label: "Ostuda", epilog: "Kaplan Ondřej věděl o prodeji i o ztrátě peněz (Ondra se přiznal) a mlčel studem. Svatava tušila, odkud měšec je. Sud a zvon seděly, jen se o tom nemluvilo." },
      C: { label: "Pečeť", epilog: "Prodej zprostředkoval písař; na kupní listině je pečeť bez nápisu. Sud vedl k Matějovi. Kdo pečeť drží, zůstává ve stínu — na tohle jsi neměl dost." },
    },

    claims: {
      c1: {
        by: "svatava", tag: "tracks", place: "tavern",
        text: "Peníze na nový sud byly dar od farnosti za hostinu.",
        line: "„Ten sud? Platili z farnosti, za starou hostinu. Říkali od faráře. Sedněte, ať neděláte průvan.“",
        truth: { A: "half", B: "half", C: "false" },
        verify: { via: "cask", where: "prasklý sud ve sklepě", texts: {
          half: "Ve dně sudu je zašlý lístek s jménem banky — neuměl ho číst, kdo peníze nechal. Nebyl to dar za hostinu; byl to měšec na cestě.",
          false: "Na obruči je značka pocestného prodejce, ne farní. Peníze nepřišly od faráře — někdo jiný tu nechal měšec a odešel.",
        } },
        contradicts: ["c6"],
      },
      c2: {
        by: "petr", tag: "people", place: "gate",
        text: "Farář zvon prodal.",
        line: "„Farář ho prodal. Ví to celé město. Ví to celé město.“",
        truth: { A: "true", B: "true", C: "half" },
        verify: { via: "clerk", ask: "lookup_priest", where: "farní kniha na radnici", texts: {
          true: "Ve farní knize je zápis o prodeji zvonu na opravu střechy. Peníze měly jít do banky; o doručení není ani řádek.",
          half: "Prodej je zapsaný, ale podpis zprostředkovatele je cizí — písař, ne farář. Farnost kývla, cestu zařídil někdo jiný.",
        } },
        contradicts: ["c3"],
      },
      c3: {
        by: "anicka", tag: "people", place: "chapel",
        text: "Zvon odvezli úředníci vozem nedovolenou cestou.",
        line: "„Přišel vůz a odvezli ho. Jářku, jako úředníci — jenže bez pečeti na dveřích!“",
        truth: { A: "half", B: "half", C: "half" },
        verify: { via: "cart", where: "vůz na cestě k hutím", texts: {
          half: "Na voze visí malý vozový zvon — zní skoro jako ten z kaple, ale je to jiný. Velký zvon tudy nejel; tenhle zvonek jen ohlašuje cech.",
        } },
        contradicts: ["c2", "c4"],
      },
      c4: {
        by: "gertruda", tag: "paper", place: "bank",
        text: "Na zvon není zástava; hotovost z prodeje měla dorazit do Zástavy.",
        line: "„Zástava na zvon neběží. Hotovost z prodeje měla dojít sem. Smlouva ovšem čeká na mince, které nepřišly.“",
        truth: { A: "true", B: "true", C: "half" },
        verify: { via: "clerk", ask: "lookup_deed", where: "kupní listina a kniha vkladů na radnici", texts: {
          true: "Kupní listina sedí: Matěj od pece, cena na střechu. V knize vkladů nic — peníze do banky nedorazily.",
          half: "Listina sedí, ale pečeť zprostředkovatele nemá nápis. Vklad chybí. Někdo cestu zařídil potichu.",
        } },
        contradicts: ["c3"],
      },
      c5: {
        by: "lidmila", tag: "omen", place: "healer",
        text: "V noci je u kaple cosi divného a vlci utíkají z lesa.",
        line: "„Vlci utíkají z lesa, protože je pátek. A u kaple je v noci cosi divného, možná zvon, možná ne.“",
        truth: { A: "none", B: "none", C: "none" },
        verify: { via: "night", where: "kaple v noci", texts: { none: "Něco tu je, chlad a ticho. Je to zvon, pověra, nebo vítr? Nic to nepotvrdilo ani nevyvrátilo." } },
      },
      c6: {
        by: "ondra", tag: "people", place: "forge",
        text: "Ondra nesl měšec do banky, zastavil se na jedno a peníze nechal u Svatavy.",
        line: "„Nesl jsem to do banky. Lístek jsem nepřečetl — jméno jo, písmena ne. Zastavil jsem se na jedno. Řekl jsem, že je to od Ondřeje. Měšec… zůstal.“",
        truth: { A: "half", B: "true", C: "true" },
        verify: { via: "forge", where: "Hutě u Jezírka", texts: {
          half: "Ondra si pamatuje hospodu a „od Ondřeje“. Kam peníze šly dál, neví — byl opilý. U pece leží velký zvon z kaple, ještě nepřelitý.",
          true: "Ondra se přiznává: měšec nechal u Svatavy. Matěj ukáže zvon — koupil ho na přelití, lhůta běží.",
        } },
        contradicts: ["c1"],
      },
    },

    /* dopady verdiktů: trust → ceny (priceMod), banka poplatek při trust < 0, zlato, flagy */
    verdicts: {
      return: { label: "Vrátit zvon do kaple", at: "chapel", needs: { bell: true }, hint: "kaple a Lidmila ti budou věřit; Matěj přijde o zakázku", effects: { trust: { anicka: 2, lidmila: 1, matej: -1 }, flags: ["zvon_return"] }, consumeBell: true, epilogue: "Zvon znovu visí v kapli. Zvoní. Střecha počká — nebo se najde jiný kov." },
      forge: { label: "Nechat zvon Matějovi na přelití", at: "forge", needs: { bell: true }, hint: "40 🪙 od Matěje; kaple dostane menší zvon, Anička se otočí", effects: { trust: { matej: 2, anicka: -2 }, gold: 40, flags: ["zvon_forge"] }, consumeBell: true, epilogue: "Matěj zvon přelije. Ves má menší hlas. Střecha kaple drží." },
      pay: { label: "Doplatit farnosti za střechu", at: "townhall", needs: { gold: 150 }, hint: "150 🪙; všichni budou spokojení, zvon se vrátí z hutí", effects: { trust: { anicka: 1, matej: 1, lidmila: 1, svatava: 1 }, gold: -150, flags: ["zvon_paid"] }, epilogue: "Dluh střechy je splacen. Matěj zvon vrátí do kaple. Kasa je prázdnější, ves tišší spokojením." },
      keep: { label: "Nechat si zvon", at: "notebook", needs: { bell: true }, hint: "nic hned; ale nikdo ti nebude věřit", effects: { trust: { anicka: -1, matej: -1, lidmila: -1, svatava: -1 }, flags: ["zvon_keep"] }, epilogue: "Zvon máš ty. Lidé si šeptají, kdo ho má — a proč kaple mlčí." },
      auction: { label: "Zvon byl přelit bez tebe", auto: true, effects: { trust: { anicka: -1 }, flags: ["zvon_melted"] }, epilogue: "Lhůta uplynula. Matěj zvon přelil. Ves má nový, menší hlas." },
    },

    open: "A divno u kaple v noci? To nikdo nevysvětlil. Zvon, pověra, nebo jen vítr, to si musíš rozhodnout sám.",
  };

  const KAUZY = { zvon: ZVON };
  return { KAUZY };
});
