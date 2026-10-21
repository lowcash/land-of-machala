/*
 * Kauzy — jediný zdroj pravdy (docs/story/zvon.md je záměr, tohle je kód). Pilot: Zvon z kaple.
 * Kauza je data: NPC (spolehlivost, signál), varianty (pravda podle seedu), fámy (kdo co tvrdí, jak se ověří),
 * verdikty (dopad na důvěru a svět). Pravda fámy se rozhoduje podle varianty: true | half | false | none (nikdy se nerozhodne).
 * Spolehlivost `rel` = výchozí jistota zdroje; `tell` = jak často prozradí nepravdu drobným signálem (a = napůl, b = lež).
 * `follow` = hráčovy věty při „Vrátit se k věci“ po rozuzlení fámy, klíč `názor_pravda` (believe|doubt × true|half|false, nebo `neutral`); `after` = NPC odpověď na stejný klíč (NPC přepisuje `afterDefault`), bez mechanického trestu.
 * `react` = krátká věta NPC na hráčův názor (believe | doubt), nikdy neprozradí pravdu. `replies` = odpovědi hráče po fámě (text smí být pole variant, hint prozrazuje záměr).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ZVON = {
    id: "zvon",
    title: "Zvon z kaple",
    brief: "Z kaple u cesty zmizel zvon. Každý ví něco jiného.",
    deadline: { days: 5, text: "Dražba zvonu na radnici" },
    bell: { weight: 14 },
    camp: { cell: [5, 6] },
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
        after: { believe_true: ["„Já to říkala. Pivo nelže.“"], believe_half: ["„Půl pravdy je u mě pořád celá runda.“"], believe_false: ["„Slyšela jsem to od Honzova souseda. Ten zase od někoho.“"], doubt_false: ["„No jo. Aspoň že jsi to ověřil, než jsi mi zakázal pít.“"], doubt_half: ["„Půlka pravdy. Víc u mě nedostaneš.“"], doubt_true: ["„Nic se neděje. Na omluvu stejně nikdo neplatí.“"], neutral: ["„Dobře, dobře. Dáš si?“"] },
        react: { believe: ["„Tak vidíš. Já říkám, jak to je.“"], doubt: ["„Nevěříš? Tvoje věc. Platit budeš tak jako tak.“"] } },
      petr: { name: "Petr", rel: 0.55, tell: 0.5, signals: { a: "Petr zopakuje poslední větu ještě jednou.", b: "Petr zopakuje poslední větu a pak ještě jednou." },
        after: { believe_true: ["„Říkal jsem to. Říkal jsem to.“"], believe_half: ["„Něco bylo. Něco. Víc nevím.“"], believe_false: ["„Ví to celé město. Ale... možná ne celé. Možná půlka.“"], doubt_false: ["„Dobře. Dobře, že ses ptal. Já se neptal.“"], doubt_half: ["„Půl pravdy. Půl pravdy je dost.“"], doubt_true: ["„Dobře. Dobře. Nic se nestalo.“"], neutral: ["„Dobře. Vlastně… dobře.“"] },
        react: { believe: ["„Dobře. Dobře, že věříš. Dobře.“"], doubt: ["„Nevěříš? Ví to celé město. Celé město.“"] } },
      anicka: { name: "Anička", rel: 0.5, tell: 0.6, signals: { a: "Anička si tiskne ruce.", b: "Anička se podívá stranou a spolkne slzy." },
        after: { believe_true: ["„Děkuju. Aspoň někdo nelže tak jako ostatní.“"], believe_half: ["Anička přikývne. „Aspoň něco. Víc mi nezbylo.“"], believe_false: ["Anička zmlkne a dlouho se dívá na dlaně. „Já nevěděla…“"], doubt_false: ["Anička se slabě pousměje. „Měl jsi pravdu. Já bych si to taky chtěla myslet.“"], doubt_half: ["„Napůl. To bolí skoro stejně.“"], doubt_true: ["„To nic. Já bych tomu v tvé kůži taky nevěřila.“"], neutral: ["„Ano, vím. Děkuju, že ses ptal.“"] },
        react: { believe: ["„Děkuju. Aspoň někdo mi věří.“"], doubt: ["Anička přikývne a mne si rukáv. „Chápu. Mně by se to taky těžko věřilo.“"] } },
      gertruda: { name: "Gertruda", rel: 0.7, tell: 0, signals: {},
        after: { believe_true: ["„Vše proběhlo podle smlouvy. Smlouva ovšem proběhla také.“"], believe_half: ["„Neúplné pravdy jsou nejdražší. Ale dokládá se.“"], believe_false: ["„Chyba v dokladu. Ozvěte se příště s listinou.“"], doubt_false: ["„Skepse je rozumná. Doložil jste ji listinou, to oceňuji.“"], doubt_half: ["„Skoro. Pojďme to zapsat jako skoro.“"], doubt_true: ["„Omluvy účtujeme zdarma. Tuto jednou.“"], neutral: ["„Zaznamenáno.“"] },
        react: { believe: ["„Rozumný postoj. Papíry se nemýlí. Nemýlí se ovšem ani pečeť.“"], doubt: ["„Pochybnosti jsou zdravé. Doložte je listinou.“"] } },
      gustav: { name: "Gustav", rel: 0.7, tell: 0, signals: {},
        react: { believe: ["„Dobře. Knihy si ověřte sám. Stojí to pár mincí.“"], doubt: ["„U svědka je pochybnost na místě. Kniha leží na radnici.“"] } },
      lidmila: { name: "Lidmila", rel: 0.6, tell: 0.3, signals: { a: "Lidmila ztiší hlas.", b: "Lidmila ztiší hlas a mrkne ke dveřím." },
        react: { believe: ["„Bolí to, protože je čtvrtek. Ono se ti to možná potvrdí.“"], doubt: ["„Děláš dobře. Já sama nevím, čemu věřit — a to říkám potichu.“"] } },
      brigand: { name: "Zbojník", rel: 0.5, tell: 0.4, signals: { a: "Zbojník pokrčí rameny.", b: "Zbojník pokrčí rameny a nepodívá se ti do očí." },
        react: { believe: ["„No vidíš. Aspoň jeden, kdo poslouchá.“"], doubt: ["„Jak chceš. Mně je to jedno, já jen povídám.“"] } },
    },

    /* pravda fám podle varianty: A kaplan to zorganizoval · B Anička sama · C banka přepadení zinscenovala */
    variants: {
      A: { label: "Kaplan", epilog: "Kaplan Ondřej si nechal zvon přepadnout, aby ho zachránil před bankou. Zbojník dostal zálohu z kasičky kaple." },
      B: { label: "Anička", epilog: "Anička to zorganizovala sama, kaplan o ničem nevěděl. Zbojníka zaplatila z otcových úspor." },
      C: { label: "Banka", epilog: "Banka si přepadení zinscenovala kvůli pojistce. Zbojník věřil, že pracuje pro kapli." },
    },

    claims: {
      c1: {
        by: "svatava", tag: "tracks", place: "tavern",
        text: "Zvon z kaple ukradl Honza z kopců pro sebe.",
        line: "„Zvon z kaple? Ukradl ho Honza z kopců, pro sebe, to ti povídám. Sedněte, ať neděláte průvan.“",
        truth: { A: "half", B: "half", C: "false" },
        verify: { via: "camp", where: "tábor v kopcích", texts: { half: "Tábor opravdu stál v kopcích a zvon tam ležel. Ale Honza ho nechtěl pro sebe, nikdo tu zvon neprodává.", false: "V táboře jsou stopy, ale nikdo tu zvon nechce. Honza ho jen hlídá." } },
        contradicts: ["c6"],
      },
      c2: {
        by: "petr", tag: "people", place: "gate",
        text: "Farář zvon prodal.",
        line: "„Farář ho prodal. Ví to celé město. Ví to celé město.“",
        truth: { A: "false", B: "false", C: "half" },
        verify: { via: "clerk", ask: "lookup_priest", where: "farní kniha na radnici", texts: { false: "Ve farní knize není o prodeji ani zmínka. Farář nic neprodal.", half: "Farář něco podepsal, ale ne prodej: jen kývl na převoz „k opravě“." } },
        contradicts: ["c3", "c4"],
      },
      c3: {
        by: "anicka", tag: "people", place: "chapel",
        text: "Zvon odvezli úředníci nedovolenou cestou.",
        line: "„Přišli úředníci a odvezli ho. Jářku, nedovolenou cestou!“",
        truth: { A: "half", B: "half", C: "true" },
        verify: { via: "clerk", ask: "lookup_register", where: "kniha odvozů na radnici", texts: { half: "Odvoz je zapsaný. Podle knihy legálně, ale podpis kaplana vypadá, že ho psal spěchající člověk.", true: "Odvoz není v knize. Nikdo ho nenařídil, přesto ho někdo zaplatil." } },
        contradicts: ["c2", "c4"],
      },
      c4: {
        by: "gertruda", tag: "paper", place: "bank",
        text: "S zvonem se naložilo podle smlouvy.",
        line: "„Vše proběhlo podle smlouvy. Smlouva ovšem proběhla také — zástava propadla.“",
        truth: { A: "true", B: "true", C: "half" },
        verify: { via: "clerk", ask: "lookup_deed", where: "zástavní listina na radnici", texts: { true: "Listina sedí: zástava propadla a lhůta uplynula.", half: "Listina sedí, ale zvon měl být odvezen až po lhůtě. Banka si pospíšila." } },
        contradicts: ["c2", "c3"],
      },
      c5: {
        by: "lidmila", tag: "omen", place: "healer",
        text: "V noci je u kaple cosi divného a vlci utíkají z lesa.",
        line: "„Vlci utíkají z lesa, protože je pátek. A u kaple je v noci cosi divného — možná zvon, možná ne.“",
        truth: { A: "none", B: "none", C: "none" },
        verify: { via: "night", where: "kaple v noci", texts: { none: "Něco tu je, chlad a ticho. Je to zvon, pověra, nebo vítr? Nic to nepotvrdilo ani nevyvrátilo." } },
      },
      c6: {
        by: "brigand", tag: "people", place: "camp",
        text: "Zbojníkům platili z kaple.",
        line: "„Platili nám z kaple. Zvon měl zůstat u lidí, říkali.“",
        truth: { A: "true", B: "true", C: "half" },
        verify: { via: "camp", where: "tábor v kopcích", texts: { true: "V táboře je kasička s kapličním znakem. Opravdu platili z kaple.", half: "Kasička je z kaple, ale mince v ní patří bance. Někdo je poslal oklikou." } },
        contradicts: ["c1"],
      },
    },

    /* dopady verdiktů: trust → ceny (priceMod), banka poplatek při trust < 0, zlato, flagy */
    verdicts: {
      return: { label: "Vrátit zvon do kaple", at: "chapel", needs: { bell: true }, hint: "kaple a Lidmila ti budou věřit; Zástava bude dražší", effects: { trust: { anicka: 2, lidmila: 1, gertruda: -1 }, flags: ["zvon_return"] }, consumeBell: true, epilogue: "Zvon visí v kapli. Zvoní. Zástava se zlobí." },
      bank: { label: "Odevzdat zvon Zástavě", at: "bank", needs: { bell: true }, hint: "40 🪙 a důvěra Zástavy; kaple se otočí zády", effects: { trust: { gertruda: 2, anicka: -2 }, gold: 40, flags: ["zvon_bank"] }, consumeBell: true, epilogue: "Zástava zvon převzala a vyplatila odměnu. V kapli je ticho." },
      pay: { label: "Splatit dluh kaple", at: "townhall", needs: { gold: 150 }, hint: "150 🪙; všichni budou spokojení", effects: { trust: { anicka: 1, gertruda: 1, lidmila: 1 }, gold: -150, flags: ["zvon_paid"] }, epilogue: "Dluh je splacen. Zvon se vrátil do kaple a nikdo se nezlobí, jen kasa je prázdná." },
      keep: { label: "Nechat si zvon", at: "notebook", needs: { bell: true }, hint: "nic hned; ale nikdo ti nebude věřit", effects: { trust: { anicka: -1, gertruda: -1, lidmila: -1, svatava: -1 }, flags: ["zvon_keep"] }, epilogue: "Zvon máš ty. Lidé si šeptají, kdo ho má." },
      auction: { label: "Dražba proběhla bez tebe", auto: true, effects: { trust: { anicka: -1 }, flags: ["zvon_auction"] }, epilogue: "Lhůta uplynula. Zástava zvon vydražila (nebo ho nikdo nenašel)." },
    },

    open: "A divno u kaple v noci? To nikdo nevysvětlil. Zvon, pověra, nebo jen vítr, to si musíš rozhodnout sám.",
  };

  const KAUZY = { zvon: ZVON };
  return { KAUZY };
});
