/* Postava: základní staty povolání, modifikátory ras a popisy (jediné místo pravdy). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  /** Bez volby rasy/povolání — neutrální poutník (preview na Postavě). */
  const PILGRIM = { str: 6, dex: 6, vit: 6, int: 6, res: "energie", resMax: 12 };

  /** Odchylky od PILGRIM — net ≈ stejný „budget“ mezi povoláními. */
  const BASE = {
    mercenary: { str: 9, dex: 5, vit: 8, int: 4, res: "energie", resMax: 14 },
    tracker: { str: 6, dex: 9, vit: 6, int: 5, res: "energie", resMax: 12 },
    chanter: { str: 4, dex: 5, vit: 5, int: 10, res: "mana", resMax: 16 },
    legist: { str: 5, dex: 5, vit: 6, int: 8, res: "energie", resMax: 12 },
  };

  /** Rasy: součet odchylek vždy +1. */
  const RACE_MOD = {
    local: { str: 0, dex: 0, vit: 1, int: 0, label: "Zdejší" },
    saltfolk: { str: 1, dex: -1, vit: 1, int: 0, label: "Solníci" },
    woodfolk: { str: -1, dex: 1, vit: 0, int: 1, label: "Hvozdáci" },
    riverfolk: { str: 0, dex: 1, vit: 1, int: -1, label: "Brodáci" },
    hillfolk: { str: 1, dex: 1, vit: 0, int: -1, label: "Pasekáři" },
  };

  const STAT_KEYS = ["str", "dex", "vit", "int"];
  const fmtDelta = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

  /** Bonusy z čísel (nepsat ručně dvakrát). */
  function bonusesFrom(mod, against) {
    return STAT_KEYS.filter((k) => (mod[k] || 0) !== (against[k] || 0)).map((k) => ({
      key: k,
      delta: fmtDelta((mod[k] || 0) - (against[k] || 0)),
    }));
  }

  const RACE_INFO = {
    local: {
      label: "Zdejší",
      icon: "👤",
      blurb: "Lidé z Machaly a okolí — znají zdejší zvyky a listiny jim nejsou cizí.",
      bonuses: bonusesFrom(RACE_MOD.local, { str: 0, dex: 0, vit: 0, int: 0 }),
    },
    saltfolk: {
      label: "Solníci",
      icon: "⛏",
      blurb: "Horníci ze solných dolů: silní a houževnatí, v úzkých chodbách méně hbití.",
      bonuses: bonusesFrom(RACE_MOD.saltfolk, { str: 0, dex: 0, vit: 0, int: 0 }),
    },
    woodfolk: {
      label: "Hvozdáci",
      icon: "✧",
      blurb: "Lid z hvozdu — čtou stezky a stopy, úřadům rozumějí hůř.",
      bonuses: bonusesFrom(RACE_MOD.woodfolk, { str: 0, dex: 0, vit: 0, int: 0 }),
    },
    riverfolk: {
      label: "Brodáci",
      icon: "〰",
      blurb: "Říční lid: převozníci a rybáři, kteří přežili povodně a města podezírají.",
      bonuses: bonusesFrom(RACE_MOD.riverfolk, { str: 0, dex: 0, vit: 0, int: 0 }),
    },
    hillfolk: {
      label: "Pasekáři",
      icon: "⛰",
      blurb: "Pastevci z kopců s vlastním nářečím — vydrží zimu, formuláře méně.",
      bonuses: bonusesFrom(RACE_MOD.hillfolk, { str: 0, dex: 0, vit: 0, int: 0 }),
    },
  };

  const CLASS_INFO = {
    mercenary: {
      label: "Žoldák",
      icon: "⚔",
      tag: "lidé",
      blurb: "Žije z meče a výslechu — v hospodě i v zákeřném boji čte lidi.",
      bonuses: bonusesFrom(BASE.mercenary, PILGRIM),
    },
    tracker: {
      label: "Stopař",
      icon: "◎",
      tag: "stopy",
      blurb: "Stezky, tábor a stopy ve dne; zvěř i lupiči po něm nechávají stopu.",
      bonuses: bonusesFrom(BASE.tracker, PILGRIM),
    },
    chanter: {
      label: "Zaříkávač",
      icon: "✦",
      tag: "znamení",
      blurb: "Znamení, noc a pověry — zda to kouzlo, strach nebo víra, nevíš jistě.",
      bonuses: bonusesFrom(BASE.chanter, PILGRIM),
    },
    legist: {
      label: "Zákoník",
      icon: "📜",
      tag: "listiny",
      blurb: "Inkoust a pečeť: na radnici a v Zástavě najde mezery ve smlouvách.",
      bonuses: bonusesFrom(BASE.legist, PILGRIM),
    },
  };

  return { PILGRIM, BASE, RACE_MOD, CLASS_INFO, RACE_INFO };
});
