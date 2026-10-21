/*
 * Kauzy: fámy, ověřování, jistota, lhůta, verdikty, důvěra. Čisté funkce nad stavem `k` (bez DOMu, bez Math.random).
 * Stav `k` = { id, variant, seed, startDay, claims: { id: { status, belief, via, heardDay, outcome } }, trust, facts, verdict, events }.
 * status: heard → verified | refuted | open (pravda není; nikdy se nerozhodne). Pravda fámy závisí na variantě (ze seedu).
 */
(function (root, factory) {
  const dep = typeof require === "function" ? { KAUZY: require("../data/kauzy.js").KAUZY, createRng: require("../rng.js").createRng } : root.LOM;
  const api = factory(dep.KAUZY, dep.createRng);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Kauza: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function (KAUZY, createRng) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const VARIANTS = ["A", "B", "C"];
  const CLASS_TAG_BONUS = 0.12;
  const RACE_TAG_BONUS = 0.05;
  const label = (p) => (p >= 0.75 ? "jistě" : p >= 0.5 ? "tuším" : "nejasné");

  const def = (k) => {
    const d = KAUZY[k.id];
    if (!d) throw new Error(`Neznámá kauza: ${k.id}`);
    return d;
  };
  const claimDef = (k, cid) => {
    const c = def(k).claims[cid];
    if (!c) throw new Error(`Neznámá fáma: ${cid}`);
    return c;
  };

  function newKauza(seed = 1, id = "zvon") {
    return { id, variant: VARIANTS[(seed >>> 0) % VARIANTS.length], seed: seed >>> 0, startDay: null, claims: {}, trust: {}, facts: {}, verdict: null, events: [] };
  }
  const started = (k) => k.startDay != null;
  /** Má aspoň jednu fámu (Zápisník); lhůta může ještě neběžet (seed z původu). */
  const hasClaims = (k) => !!(k && k.claims && Object.keys(k.claims).length);
  const log = (k, type, extra = {}) => k.events.push({ type, ...extra });

  /** Pravda fámy v této variantě: true | half | false | none. */
  const truthOf = (k, cid) => claimDef(k, cid).truth[k.variant];

  /** Signál NPC (drobná prozrazující věc) — deterministicky ze seedu: stejná kauza, stejné signály. */
  function signalFor(k, cid) {
    const c = claimDef(k, cid);
    const t = truthOf(k, cid);
    const npc = def(k).npcs[c.by];
    if (t === "true" || !npc.tell) return null;
    const roll = createRng((k.seed ^ (cid.charCodeAt(1) * 2654435761)) >>> 0).next();
    if (roll >= npc.tell) return null;
    return t === "false" ? npc.signals.b : npc.signals.a;
  }

  /** Co NPC řekne (věta + případný signál); nemění stav. */
  const say = (k, cid) => ({ line: claimDef(k, cid).line, signal: signalFor(k, cid), by: claimDef(k, cid).by });

  /**
   * Zaslechnutí fámy.
   * `armDeadline` (výchozí true): nastaví `startDay`, pokud ještě není.
   * Seed z původu (Dlužník) volá `armDeadline: false` — fáma je v Zápisníku (`hasClaims`),
   * ale lhůta a služby s `kauzaStarted()` čekají na první hear s `armDeadline` (i stejné cid znovu).
   */
  function hear(k, cid, { day = 1, via = null, armDeadline = true } = {}) {
    const c = claimDef(k, cid);
    const first = !k.claims[cid];
    if (first) {
      k.claims[cid] = { status: "heard", belief: null, via: via || c.by, heardDay: day, outcome: null, attempts: 0 };
      log(k, "claim_heard", { id: cid, day });
    }
    if (armDeadline && k.startDay == null) k.startDay = day;
    return { ok: true, isNew: first, ...say(k, cid) };
  }

  /** Zkušenost Čtení: správné odhady při rozuzlení (věřím a bylo to pravda/napůl, pochybuju a bylo to nepravda/napůl). */
  function readingExp(k) {
    let n = 0;
    for (const [cid, rec] of Object.entries(k.claims)) {
      if (!rec.stance) continue;
      const t = truthOf(k, cid);
      if ((rec.stance === "believe" && t !== "false") || (rec.stance === "doubt" && t !== "true")) n++;
    }
    return n;
  }

  /** Jistota fámy hráčem čtená: zdroj + INT + shoda povolání/rasy s typem fámy − protiřečící se fámy od jiných. Po ověření je to fakt. */
  function certainty(k, cid, { int = 6, classId = null, raceId = null } = {}) {
    const d = def(k);
    const c = claimDef(k, cid);
    const rec = k.claims[cid];
    if (rec && rec.status === "verified") return { p: 1, label: "ověřeno", status: "verified", outcome: rec.outcome };
    if (rec && rec.status === "refuted") return { p: 0, label: "vyvráceno", status: "refuted", outcome: rec.outcome };
    if (rec && rec.status === "open") return { p: 0.5, label: "nejasné", status: "open", outcome: "none" };
    const src = d.npcs[c.by].rel;
    const classTag = classId && d.classTag[classId] === c.tag ? CLASS_TAG_BONUS : 0;
    const raceTag = raceId && d.raceTag && d.raceTag[raceId] === c.tag ? RACE_TAG_BONUS : 0;
    const conflicts = (c.contradicts || []).filter((o) => k.claims[o] && d.claims[o].by !== c.by && k.claims[o].status === "heard").length;
    const exp = Math.min(0.1, 0.02 * readingExp(k)); /* zkušenost z rozuzlených odhadů */
    const p = clamp(src + 0.03 * (int - 6) + classTag + raceTag + exp - 0.1 * conflicts, 0.1, 0.9);
    return { p: Math.round(p * 100) / 100, label: label(p), status: rec ? rec.status : "unheard" };
  }

  /**
   * Ověření: `via` musí odpovídat způsobu fámy (camp | clerk | night) a fáma musí být zaslechnutá.
   * Výsledek podle pravdy ve variantě: true/half → ověřeno (half = „napůl“), false → vyvráceno, none → zůstává otevřené.
   * Vrací { ok, reason?, status, truth, text }.
   */
  function verify(k, cid, { via, day = 1 } = {}) {
    const c = claimDef(k, cid);
    const rec = k.claims[cid];
    if (!rec) return { ok: false, reason: "Nevíš, na co se ptát. Nejdřív se poslechni." };
    if (c.verify.via !== via) return { ok: false, reason: "Tudy to ověřit nejde." };
    if (rec.status === "verified" || rec.status === "refuted") return { ok: false, reason: "Tohle už je ověřené." };
    const truth = truthOf(k, cid);
    rec.attempts = (rec.attempts || 0) + 1;
    rec.outcome = truth;
    rec.status = truth === "false" ? "refuted" : truth === "none" ? "open" : "verified";
    if (rec.status !== "open" && rec.stance === undefined) rec.stance = rec.belief || null; /* názor v okamžiku rozuzlení */
    log(k, rec.status === "refuted" ? "claim_refuted" : "claim_verified", { id: cid, day, truth });
    return { ok: true, status: rec.status, truth, text: c.verify.texts[truth] };
  }

  /** Odpovědi hráče po fámě: [{ id, you, hint }] (you smí být pole variant; hint prozrazuje záměr). */
  const replies = (k) => ["believe", "doubt", "neutral"].map((id) => ({ id, ...def(k).replies[id] }));

  /**
   * Hráčova odpověď na fámu v rozhovoru: believe | doubt nastaví názor (na rozdíl od setBelief nepřepíná zpět), neutral ho nechá být.
   * Nikdy nezaslechne fámu znovu ani nespouští lhůtu. Vrací { ok, changed, pool } — pool = věty, ze kterých NPC zareaguje (nebo null).
   */
  function answer(k, cid, stance, day = 1) {
    const rec = k.claims[cid];
    if (!rec) return { ok: false, changed: false, pool: null };
    let changed = false;
    if (stance === "believe" || stance === "doubt") {
      if (rec.belief !== stance) {
        if (rec.belief) log(k, "belief_changed", { id: cid, from: rec.belief, to: stance, day });
        rec.belief = stance;
        changed = true;
      }
    }
    const pool = (stance === "believe" || stance === "doubt") && def(k).npcs[claimDef(k, cid).by].react?.[stance] || null;
    return { ok: true, changed, pool };
  }

  /**
   * „Vrátit se k věci“: po rozuzlení fámy (ověřeno / vyvráceno) smí hráč jednou navázat na to, co dřív zvolil.
   * Klíč = názor v okamžiku rozuzlení × dopad: believe|doubt × true|half|false, bez názoru `neutral`.
   * Vrací { available, key, you, hint, pool } (you = pole variant hráčovy věty, pool = věty NPC); nemění stav.
   */
  function follow(k, cid) {
    const rec = k.claims[cid];
    if (!rec || rec.followed || (rec.status !== "verified" && rec.status !== "refuted")) return { available: false };
    const stance = rec.stance !== undefined ? rec.stance : rec.belief;
    const key = stance ? `${stance}_${rec.outcome}` : "neutral";
    const d = def(k);
    const f = d.follow[key];
    if (!f) return { available: false };
    const npc = d.npcs[claimDef(k, cid).by];
    return { available: true, key, you: f.you, hint: f.hint, pool: (npc.after && npc.after[key]) || d.afterDefault[key] };
  }

  /** Provede návrat k věci (jen jednou na fámu): zapíše do záznamu, bez dopadu na důvěru. Vrací { ok, key, pool }. */
  function followUp(k, cid, day = 1) {
    const f = follow(k, cid);
    if (!f.available) return { ok: false };
    k.claims[cid].followed = true;
    log(k, "claim_followed", { id: cid, key: f.key, day });
    return { ok: true, key: f.key, pool: f.pool };
  }

  /** Karty kauz do Zápisníku: [{ id, title, brief, rows: nerozuzlené (heard, open) a rozuzlené (verified, refuted) } ]. Řazení uvnitř podle id. */
  function notebook(k) {
    const d = def(k);
    const ids = Object.keys(k.claims).sort();
    const done = (cid) => k.claims[cid].status === "verified" || k.claims[cid].status === "refuted";
    return { id: k.id, title: d.title, brief: d.brief, pending: ids.filter((c) => !done(c)), resolved: ids.filter(done) };
  }

  /* ---------- lhůta ---------- */
  function deadline(k, clock) {
    if (!started(k)) return { started: false, daysLeft: null, over: false };
    const daysLeft = k.startDay + def(k).deadline.days - clock.day;
    return { started: true, daysLeft: Math.max(0, daysLeft), over: daysLeft <= 0 };
  }

  /* ---------- verdikty ---------- */
  const VDEF = (k, id) => {
    const v = def(k).verdicts[id];
    if (!v) throw new Error(`Neznámý verdikt: ${id}`);
    return v;
  };

  /** Lze verdikt vydat tady? ctx = { at: "chapel"|"bank"|"townhall"|"notebook", hasBell, gold } */
  function canVerdict(k, id, ctx = {}) {
    const v = VDEF(k, id);
    if (k.verdict || v.auto) return false;
    if (v.at !== ctx.at) return false;
    if (v.needs?.bell && !ctx.hasBell) return false;
    if (v.needs?.gold && (ctx.gold || 0) < v.needs.gold) return false;
    return true;
  }

  function applyVerdict(k, id, day, auto) {
    const v = VDEF(k, id);
    k.verdict = { id, auto: !!auto, day };
    for (const [npc, d] of Object.entries(v.effects.trust || {})) k.trust[npc] = clamp((k.trust[npc] || 0) + d, -2, 2);
    log(k, "verdict_chosen", { id, auto: !!auto, day });
    return { ok: true, effects: { gold: v.effects.gold || 0, flags: v.effects.flags || [], consumeBell: !!v.consumeBell }, epilogue: v.epilogue };
  }

  function chooseVerdict(k, id, ctx = {}, day = 1) {
    if (!canVerdict(k, id, ctx)) return { ok: false, reason: "Tohle teď nejde." };
    return applyVerdict(k, id, day, false);
  }

  /** Po uplynutí lhůty rozhodne svět. Vrací výsledek nebo null (nic se nestalo). */
  function checkDeadline(k, clock) {
    if (k.verdict || !deadline(k, clock).over) return null;
    return applyVerdict(k, "auction", clock.day, true);
  }

  /** Co se doopravdy stalo (po verdiktu): varianta + otevřená otázka. */
  const epilog = (k) => ({ story: def(k).variants[k.variant].epilog, open: def(k).open });

  /* ---------- důvěra ---------- */
  /** standing = trvalý základ z původu; k.trust = posun kauzy. k smí být null. */
  const trustOf = (k, npc, standing) => {
    const base = (standing && standing[npc]) || 0;
    const fromK = (k && k.trust && k.trust[npc]) || 0;
    return clamp(base + fromK, -2, 2);
  };
  /** Násobek ceny služeb NPC: důvěra −2…+2 → ×1,3…×0,7. Funguje i bez kauzy. */
  const priceMod = (k, npc, standing) => 1 - 0.15 * trustOf(k, npc, standing);
  /** Poplatek Zástavy, když ti nevěří (standing + trust). */
  const bankFee = (k, standing) => (trustOf(k, "gertruda", standing) < 0 ? 5 : 0);

  return { VARIANTS, CLASS_TAG_BONUS, RACE_TAG_BONUS, readingExp, newKauza, started, hasClaims, truthOf, signalFor, say, hear, certainty, verify, replies, answer, follow, followUp, notebook, deadline, canVerdict, chooseVerdict, checkDeadline, epilog, trustOf, priceMod, bankFee, def };
});
