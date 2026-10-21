/* Události boje → české řádky (log). Žádná pravidla, jen text. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  /* [jistě, tuším, nejasné] */
  const HINT = {
    heavy: ["Chystá těžký úder.", "Zdá se, že chystá těžký úder.", "Nejasné… možná těžký úder."],
    quick: ["Chystá rychlý výpad.", "Zdá se, že chystá rychlý výpad.", "Nejasné… možná rychlý výpad."],
    guard: ["Stahuje se do obrany.", "Zdá se, že se stahuje do obrany.", "Nejasné… možná se jen brání."],
  };
  const SPECIAL = {
    mercenary: { name: "Úder štítem", hit: "Úder štítem" },
    tracker: { name: "Přesná střela", hit: "Přesná střela" },
    chanter: { name: "Zaříkání", hit: "Zaříkání — protivník zaváhal: z víry, nebo ze strachu" },
    legist: { name: "Důrazná výtka", hit: "Důrazná výtka" },
  };

  /** Indicie, kterou vidí hráč: míra jistoty mění tón věty. */
  function hintText(hint) {
    if (!hint) return "";
    const i = hint.confidence === "jistě" ? 0 : hint.confidence === "tuším" ? 1 : 2;
    return HINT[hint.id][i];
  }

  const NAME = { heavy: "těžký úder", quick: "rychlý výpad", guard: "obrana" };

  /** Jen pro dev: co nepřítel skutečně udělá × co hráč vidí × šance, že indicie sedí. */
  function devLine(c) {
    const ok = c.hint.id === c.trueIntent;
    return `<span class="dev-tag">DEV · skutečně: ${NAME[c.trueIntent]} · indicie ukazuje: ${NAME[c.hint.id]} ${ok ? "✓ sedí" : "✗ mýlí se"} · šance, že sedí: ${Math.round(c.readChance * 100)} %</span>`;
  }

  function specialName(classId) {
    return (SPECIAL[classId] || SPECIAL.mercenary).name;
  }

  /** events → { you, foe, meta } */
  function combatLines(events, c) {
    const you = [];
    const foe = [];
    let meta = "";
    for (const ev of events) {
      switch (ev.t) {
        case "hit":
          if (ev.action === "special") you.push(`${(SPECIAL[c.p.classId] || SPECIAL.mercenary).hit} — jistý zásah ${ev.dmg}.`);
          else if (ev.action === "quick") you.push(ev.intent === "heavy" ? `Rychlý výpad přeruší těžký úder — ${ev.dmg}.` : `Rychlý výpad — ${ev.dmg}.`);
          else you.push(ev.intent === "guard" ? `Těžký úder proráží obranu — ${ev.dmg}.` : `Těžký úder — ${ev.dmg}.`);
          break;
        case "miss":
          you.push("Míjíš.");
          break;
        case "guard":
          you.push("Zvedáš obranu.");
          break;
        case "evade":
          you.push("Couváš a hledáš mezeru — příští útěk bude snazší.");
          break;
        case "observe":
          you.push("Pozoruješ nepřítele — příští tah ho přečteš líp.");
          break;
        case "heal":
          you.push(`Vypil jsi odvar. +${ev.amount} HP.`);
          break;
        case "foresight":
          you.push("Odvar předtuchy — příštích pár tahů čteš nepřítele jasněji.");
          break;
        case "flee_fail":
          you.push("Útěk selhal.");
          break;
        case "enemy_hit": {
          const tag = ev.reduced ? (ev.action === "evade" ? "uhýbáš" : "blokuješ") : "";
          if (ev.intent === "guard") foe.push(`Brání se — slabý protiúder (${ev.dmg}).`);
          else if (ev.intent === "heavy") foe.push(tag ? `Těžký úder — ${tag} na ${ev.dmg}.` : `Těžký úder — ${ev.dmg} dmg.`);
          else foe.push(tag ? `Rychlý výpad — ${tag} na ${ev.dmg}.` : `Rychlý výpad — ${ev.dmg} dmg.`);
          break;
        }
        case "riposte":
          foe.push(`Tvůj protiúder ${ev.dmg}.`);
          break;
        case "surrender_offer":
          meta = `${c.enemyName} zvedá ruce — chce se vzdát. Můžeš ho ušetřit.`;
          break;
        case "desperate":
          meta = `${c.enemyName} vidí, že už nemáš sílu, a tlačí na pilu.`;
          break;
        case "next_intent":
          meta = [meta, hintText(ev.hint)].filter(Boolean).join(" ");
          break;
        default:
      }
    }
    return { you: you.join(" "), foe: foe.join(" "), meta };
  }

  /** Slovní stav nepřítele místo přesného HP: q = počet plných dílků baru (1–4). */
  function enemyCondition(c) {
    const f = c.enemyHp / c.enemyMax;
    if (f > 0.75) return { label: "zdravý", q: 4 };
    if (f > 0.5) return { label: "potlučený", q: 3 };
    if (f > 0.25) return { label: "krvácí", q: 2 };
    return { label: "sotva stojí", q: 1 };
  }

  return { hintText, devLine, specialName, combatLines, enemyCondition };
});
