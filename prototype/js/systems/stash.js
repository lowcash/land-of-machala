/*
 * Úschovna a odložené věci. Čisté funkce bez DOMu a bez Math.random.
 * - úschovna (hospoda): kapacita, poplatek za dny, bez rizika
 * - hromádka na zemi (`open`) a zakopaná (`buried`): riziko rozkradení se řeší líně při návratu, podle uplynulého času; `open` navíc podle terénu (`TUNE.terrainMult`)
 * Rozkradení je deterministické (seed + hromádka + okamžik jejího založení); zloděj bere celou hromádku, ne vybrané kusy: kdykoli se vyhodnotí, vyjde totéž a jen přibývá.
 * Questové a kauzové věci (`isQuest`) se nerozkradou nikdy.
 * Stav: stash = { items: [{ id, day }] } · piles = [{ id, x, y, kind, created, items: [{ id, at, uid }] }], at = absolutní tik.
 */
(function (root, factory) {
  const hash = (typeof require === "function" ? require("./variants.js") : root.LOM.Variants).hash;
  const api = factory(hash);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Stash: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function (hash) {
  /* ladit: všechna čísla na jednom místě */
  const TUNE = {
    stashCap: 6, // věcí v úschovně
    stashFeePerDay: 2, // 🪙 za započatý den, účtuje se při vyzvednutí
    openPerDay: 0.15, // šance, že hromádka na zemi o věc přijde za celý den (12 denních + 8 nočních tiků)
    nightWeight: 2, // noční tik se do rizika počítá dvakrát
    buriedPerDay: 0.02, // zakopaná věc za den (noc nerozhoduje)
    buryTicks: 2, // zakopání stojí tiky
    /* násobek rizika hromádky na zemi (`open`) podle terénu: čím hůř dostupné místo, tím méně zlodějů; neznámý terén = 1 */
    terrainMult: { town: 2, village: 1.5, road: 1.5, plains: 1, forest: 0.5, chapel: 0.5, hills: 0.3 },
  };
  const TICKS_PER_DAY = 20;
  const NIGHT_START = 12; // večer a noc: tiky 12–19
  const NIGHT_TICKS = TICKS_PER_DAY - NIGHT_START;

  const absTick = (clock) => (clock.day - 1) * TICKS_PER_DAY + clock.tick;
  const nightBefore = (t) => Math.floor(t / TICKS_PER_DAY) * NIGHT_TICKS + Math.max(0, (t % TICKS_PER_DAY) - NIGHT_START);

  /** Vážená expozice (tiky) mezi dvěma absolutními tiky: noc u hromádky na zemi váží víc. */
  function exposure(kind, from, to) {
    const total = Math.max(0, to - from);
    const night = Math.max(0, nightBefore(to) - nightBefore(from));
    const w = kind === "open" ? TUNE.nightWeight : 1;
    return total - night + w * night;
  }
  /* mult = násobek podle terénu, jen pro `open` (zakopané beze změny) */
  const perDay = (kind, mult = 1) => (kind === "open" ? Math.min(0.95, TUNE.openPerDay * mult) : TUNE.buriedPerDay);
  const dayUnits = (kind) => {
    const w = kind === "open" ? TUNE.nightWeight : 1;
    return NIGHT_START + w * NIGHT_TICKS;
  };
  /** Šance, že věc odložená v tiku `from` je do tiku `to` pryč. */
  const lossChance = (kind, from, to, mult = 1) => 1 - Math.pow(1 - perDay(kind, mult), exposure(kind, from, to) / dayUnits(kind));
  /** Násobek rizika hromádky podle terénu jejího políčka; `terrainOf(x, y)` předává volající (stash.js zná jen názvy terénu). */
  const terrainMult = (pile, terrainOf) => (terrainOf && TUNE.terrainMult[terrainOf(pile.x, pile.y)]) ?? 1;

  /** Pevný hod [0,1) pro celou hromádku (zloděj bere všechno, nebo nic): stejný seed + hromádka = stejný hod, ať se vyhodnotí kdykoli. */
  const rollFor = (seed, pile) => hash(seed >>> 0, `${pile.kind}:${pile.x},${pile.y}:${pile.created ?? 0}`, 0) / 4294967296;

  const isLost = (seed, pile, item, clock, isQuest, terrainOf) =>
    !(isQuest && isQuest(item.id)) && rollFor(seed, pile, item) < lossChance(pile.kind, item.at, absTick(clock), pile.kind === "open" ? terrainMult(pile, terrainOf) : 1);

  /* ---------- úschovna ---------- */
  const newStash = () => ({ items: [] });
  const stashFull = (s) => s.items.length >= TUNE.stashCap;
  function stashPut(s, itemId, clock) {
    if (stashFull(s)) return { ok: false, reason: "full" };
    s.items.push({ id: itemId, day: clock.day });
    return { ok: true };
  }
  const stashFee = (entry, clock) => TUNE.stashFeePerDay * Math.max(1, clock.day - entry.day);
  /** Vyzvednutí: opts { gold, canFit(id) }. Zlato strhne volající (vrací `fee`). */
  function stashTake(s, index, clock, opts) {
    const e = s.items[index];
    if (!e) return { ok: false, reason: "none" };
    const fee = stashFee(e, clock);
    if (opts.gold < fee) return { ok: false, reason: "gold", fee };
    if (opts.canFit && !opts.canFit(e.id)) return { ok: false, reason: "fit", fee };
    s.items.splice(index, 1);
    return { ok: true, id: e.id, fee };
  }

  /* ---------- hromádky na mapě ---------- */
  const pileAt = (piles, x, y, kind) => piles.find((p) => p.x === x && p.y === y && p.kind === kind) || null;
  /** Přidá věc do hromádky na políčku (založí ji, když tam není). Mutuje `piles`. */
  function dropItem(piles, { x, y, kind, itemId, clock, uid }) {
    let pile = pileAt(piles, x, y, kind);
    if (!pile) {
      pile = { id: `${kind}:${x},${y}`, x, y, kind, created: absTick(clock), items: [] };
      piles.push(pile);
    }
    pile.items.push({ id: itemId, at: absTick(clock), uid });
    return pile;
  }
  /** Vezme jednu věc z hromádky (podle indexu); prázdnou hromádku odstraní. Vrací id věci. */
  function takeFromPile(piles, pile, index) {
    const it = pile.items[index];
    if (!it) return null;
    pile.items.splice(index, 1);
    if (!pile.items.length) piles.splice(piles.indexOf(pile), 1);
    return it.id;
  }
  /** Vyhodnotí rozkradení (volitelně jen pro jedno políčko; `terrainOf(x, y)` = název terénu pro násobič rizika). Vrací nové pole hromádek a seznam ztrát. Nemutuje. */
  function settle(piles, clock, seed, isQuest, cell, terrainOf) {
    const lost = [];
    const out = [];
    for (const p of piles) {
      if (cell && (p.x !== cell.x || p.y !== cell.y)) {
        out.push(p);
        continue;
      }
      const keep = [];
      for (const it of p.items) {
        if (isLost(seed, p, it, clock, isQuest, terrainOf)) lost.push({ x: p.x, y: p.y, kind: p.kind, id: it.id });
        else keep.push(it);
      }
      if (keep.length) out.push({ ...p, items: keep });
    }
    return { piles: out, lost };
  }

  return { TUNE, absTick, exposure, lossChance, terrainMult, rollFor, isLost, newStash, stashFull, stashPut, stashFee, stashTake, pileAt, dropItem, takeFromPile, settle };
});
