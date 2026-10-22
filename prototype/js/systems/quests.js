/*
 * Questy: stavy available → active → ready → done. Čisté funkce nad `log` (id → záznam); žádný DOM.
 * kill a arrive se pamatují, have se přepočítává z batohu (`evaluate`), takže ztracená věc vrátí quest do active.
 */
(function (root, factory) {
  const QUEST_BY = (typeof require === "function" ? require("../data/quests.js") : root.LOM).QUEST_BY;
  const api = factory(QUEST_BY);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { Quests: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function (QUEST_BY) {
  const newLog = () => ({});
  const statusOf = (log, id) => log[id]?.status || "available";
  const def = (id) => {
    const d = QUEST_BY[id];
    if (!d) throw new Error(`Neznámý quest: ${id}`);
    return d;
  };

  /**
   * Přijetí u zadavatele. ctx.hasAnywhere(itemId) → true, když věc existuje (batoh / výbava / corpse) - nevydá se znovu.
   * Vrací { ok, reason?, give: [itemId] }; věci do batohu vkládá volající.
   */
  function accept(log, id, ctx = {}) {
    const d = def(id);
    if (statusOf(log, id) !== "available") return { ok: false, reason: "Úkol už máš.", give: [] };
    log[id] = { status: "active", progress: {}, choice: null };
    const give = (d.giveItems || []).filter((i) => !(ctx.hasAnywhere && ctx.hasAnywhere(i)));
    return { ok: true, give };
  }

  /** Zabití: počítá se jen správný druh ve správném terénu. Vrací id questů, kterým progress vzrostl. */
  function onKill(log, { enemyId, terrain }) {
    const hit = [];
    for (const [id, rec] of Object.entries(log)) {
      if (rec.status !== "active") continue;
      for (const o of def(id).objectives) {
        if (o.type !== "kill" || o.enemy !== enemyId || (o.terrain && o.terrain !== terrain)) continue;
        rec.progress = rec.progress || {};
        if ((rec.progress[o.id] || 0) < o.count) {
          rec.progress[o.id] = (rec.progress[o.id] || 0) + 1;
          hit.push(id);
        }
      }
    }
    return hit;
  }

  /** Příchod na políčko. */
  function onArrive(log, x, y) {
    const hit = [];
    for (const [id, rec] of Object.entries(log)) {
      if (rec.status !== "active") continue;
      for (const o of def(id).objectives) {
        rec.progress = rec.progress || {};
        if (o.type === "arrive" && o.cell[0] === x && o.cell[1] === y && !rec.progress[o.id]) {
          rec.progress[o.id] = 1;
          hit.push(id);
        }
      }
    }
    return hit;
  }

  /** Splněnost cílů: [{ obj, cur, max, done }]. ctx.count(itemId) = kolik kusů je v batohu. */
  function progressOf(log, id, ctx = {}) {
    const rec = log[id] || {};
    rec.progress = rec.progress || {};
    return def(id).objectives.map((o) => {
      if (o.type === "have") {
        const cur = Math.min(o.count, ctx.count ? ctx.count(o.item) : 0);
        return { obj: o, cur, max: o.count, done: cur >= o.count };
      }
      if (o.type === "kill") {
        const cur = rec.progress[o.id] || 0;
        return { obj: o, cur, max: o.count, done: cur >= o.count };
      }
      const done = !!rec.progress[o.id];
      return { obj: o, cur: done ? 1 : 0, max: 1, done };
    });
  }

  /** Přepočítá active ↔ ready podle cílů. Vrací id questů, které změnily stav. */
  function evaluate(log, ctx = {}) {
    const changed = [];
    for (const [id, rec] of Object.entries(log)) {
      if (rec.status !== "active" && rec.status !== "ready") continue;
      const all = progressOf(log, id, ctx).every((p) => p.done);
      const next = all ? "ready" : "active";
      if (next !== rec.status) {
        rec.status = next;
        changed.push(id);
      }
    }
    return changed;
  }

  /** Lze odevzdat tady? where = { place } nebo { cell: [x,y] }. */
  function canTurnIn(log, id, where = {}) {
    if (statusOf(log, id) !== "ready") return false;
    const t = def(id).turnIn;
    if (t.place) return where.place === t.place;
    return !!where.cell && where.cell[0] === t.cell[0] && where.cell[1] === t.cell[1];
  }

  /**
   * Odevzdání. Vrací { ok, reason?, reward: { xp, gold, items, flags }, consume }.
   * Odměnu a spotřebu aplikuje volající; quest je hned done (nejde odevzdat dvakrát).
   */
  function turnIn(log, id, where = {}, choiceId = null) {
    const d = def(id);
    if (!canTurnIn(log, id, where)) return { ok: false, reason: statusOf(log, id) === "done" ? "Už odevzdáno." : "Tady to odevzdat nejde." };
    let reward = d.reward || { xp: 0, gold: 0 };
    let flags = [];
    if (d.choices) {
      const c = d.choices.find((x) => x.id === choiceId);
      if (!c) return { ok: false, reason: "Vyber, jak to odevzdat." };
      reward = c.reward;
      flags = c.flags || [];
      log[id].choice = c.id;
    }
    log[id].status = "done";
    return { ok: true, reward: { xp: reward.xp || 0, gold: reward.gold || 0, items: reward.items || [], flags: [...flags, ...(d.reward?.flags || [])] }, consume: d.consume || [] };
  }

  /** Zrušení: quest se vrátí do nabídky; věci vydané při přijetí se odeberou z batohu (jde o `remove`). */
  function abandon(log, id) {
    if (!["active", "ready"].includes(statusOf(log, id))) return { ok: false, remove: [] };
    delete log[id];
    return { ok: true, remove: def(id).giveItems || [] };
  }

  /**
   * Značky na mapě (questhelper): giver ❗ / turnin ❓ na městském políčku nebo cíli, zone = terén kill cíle,
   * target = cíl příchodu, lost = quest věc leží v corpse.
   * ctx: { terrainAt, mapMax, townCell, count, corpses, isQuestItem, offered(place,id) }
   */
  function marks(log, ctx) {
    const out = [];
    const town = ctx.townCell;
    for (const [id, d] of Object.entries(QUEST_BY)) {
      const st = statusOf(log, id);
      if (st === "available") out.push({ kind: "giver", x: town[0], y: town[1], id, text: `${d.title}: nabízí ${d.giver.npc}` });
      if (st === "ready") {
        const c = d.turnIn.cell || town;
        out.push({ kind: "turnin", x: c[0], y: c[1], id, text: `${d.title}: odevzdat (${d.turnIn.npc})` });
      }
      if (st !== "active" && st !== "ready") continue;
      for (const p of progressOf(log, id, ctx)) {
        if (p.done) continue;
        const o = p.obj;
        if (o.type === "kill") {
          for (let y = 0; y <= ctx.mapMax; y++) for (let x = 0; x <= ctx.mapMax; x++) if (ctx.terrainAt(x, y) === o.terrain) out.push({ kind: "zone", x, y, id, text: `${d.title}: ${o.text} (${p.cur}/${p.max})` });
        }
        if (o.type === "arrive") out.push({ kind: "target", x: o.cell[0], y: o.cell[1], id, text: `${d.title}: ${o.text}` });
        if (o.type === "have") {
          const c = (ctx.corpses || []).find((k) => k.items.includes(o.item));
          if (c) out.push({ kind: "lost", x: c.x, y: c.y, id, text: `${d.title}: tady leží „${o.item}“ z tvého těla` });
        }
      }
    }
    return out;
  }

  return { newLog, statusOf, accept, onKill, onArrive, progressOf, evaluate, canTurnIn, turnIn, abandon, marks };
});
