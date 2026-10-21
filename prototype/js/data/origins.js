/* Původy: startovní místo, zlato, vztahy, uvítání. Nezávislé na rase a povolání. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ORIGINS = {
    debtor: {
      id: "debtor",
      label: "Dlužník",
      icon: "⛓",
      blurb: "Dlužíš Zástavě a znáš lidi z kopců — začínáš v hostinci s málem a s poplatkem v bance.",
      start: { place: "tavern" },
      gold: 30,
      bank: 0,
      item: null,
      standing: { gertruda: -1, brigand: 1 },
      energyBonus: 0,
      hearClaim: "c6",
      greet: {
        bank: ["„Ah. Dlužník. Účet běží — a poplatek také.“", "„Účet existuje. Poplatek také.“"],
        tavern: ["„Sedněte. Platit budete tak jako tak — to už víte.“"],
      },
      intro: "Vracíš se do Machaly s dluhem v kapse. Hostinec voní pivem. Zástava si tě pamatuje.",
      effectsLine: "Zlato 30 · poplatek v Zástavě · lupiči tě znají",
    },
    apprentice: {
      id: "apprentice",
      label: "Učeň kováře",
      icon: "🔨",
      blurb: "Karel tě zná z výhně — začínáš v kovárně se slevou a s nářadím v batohu.",
      start: { place: "smith" },
      gold: 60,
      bank: 20,
      item: "gloves",
      standing: { karel: 2 },
      energyBonus: 0,
      hearClaim: null,
      greet: {
        smith: ["„Zdař Bůh. Tvou práci poznám i se zavřenýma očima.“", "„Ocel drží. Ty taky. Co potřebuješ?“"],
      },
      intro: "Kovárna voní železem. Karel přikývne — učeň se vrací.",
      effectsLine: "Zlato 60 · banka 20 · sleva u kováře · rukavice",
    },
    watchman: {
      id: "watchman",
      label: "Bývalý strážný",
      icon: "🛡",
      blurb: "Petrové tě znají jménem; Svatava má pro tebe levnější drb. Začínáš u brány.",
      start: { place: "gate" },
      gold: 70,
      bank: 0,
      item: null,
      standing: { petr: 2, svatava: 1 },
      energyBonus: 0,
      hearClaim: null,
      greet: {
        gate: ["„Hlídám bránu. A ty… tebe znám. Hlídám bránu.“", "„Ty. Jo. Ty. Jdi dál.“"],
        tavern: ["„Bývalý strážný. Drb máš levněji — platit stejně budeš.“"],
      },
      intro: "Brána vrže. Petr přikývne, jako bys odtud nikdy neodešel.",
      effectsLine: "Zlato 70 · stráže tě znají · Svatava ti věří",
    },
    wayfarer: {
      id: "wayfarer",
      label: "Poutník z Brodu",
      icon: "🎒",
      blurb: "Cizinec z Brodu — víc zlata a výdrže, ale lidé se ptají, kdo jsi. Začínáš na cestě u města.",
      start: { cell: [3, 2] },
      gold: 100,
      bank: 0,
      item: null,
      standing: {},
      energyBonus: 2,
      hearClaim: null,
      greet: {
        tavern: ["„Cizinec? Sedněte. Platit budete tak jako tak.“", "„Z Brodu? Inu. Pivo nejdřív, otázky potom.“"],
        healer: ["„Cizinec. Bolí to, protože je čtvrtek — a protože jsi daleko.“"],
        bank: ["„Cizinec. Smlouva platí stejně. Lhůta také.“"],
        smith: ["„Cizinec. Ocel drží. Jméno méně.“"],
        market: ["„Naposledy! Jenom pro vás — a pro cizince taky naposledy.“"],
        townhall: ["„Cizinec. Dotaz? Formulář máme. Na odpovědi.“"],
      },
      intro: "Cesta u brány. V batohu zlato z Brodu, v nohou prach. Město se ptá, kdo jsi.",
      effectsLine: "Zlato 100 · výdrž +2 · cizinec",
    },
    exile: {
      id: "exile",
      label: "Vyhnanec",
      icon: "☁",
      blurb: "Vyhnaný z města — málo zlata, stráže tě napomenou, lupiči ti rozumějí. Začínáš na okraji lesa.",
      start: { cell: [2, 5] },
      gold: 15,
      bank: 0,
      item: null,
      standing: { petr: -1, brigand: 1 },
      energyBonus: 0,
      hearClaim: null,
      greet: {
        gate: ["„Hlídám bránu. Ty… smíš. Ale zadarmo nic. Hlídám bránu.“", "„Vyhnanec. Jdi. A nic neber.“"],
      },
      intro: "Okraj lesa. Město je blízko a stejně daleko. Stráže tě pustí — s napomenutím.",
      effectsLine: "Zlato 15 · stráže nedůvěřují · těžší start",
    },
  };

  const ORIGIN_IDS = Object.keys(ORIGINS);
  return { ORIGINS, ORIGIN_IDS };
});
