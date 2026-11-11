/**
 * Dev „Svět“: instance předmětů + světové čítače (systems/instances.js).
 * Slider přepočítá od baseline; obraz řídí scene-compose (dev „Scéna“ / SceneView).
 */
let worldDemo = null;
/** Dev scene compositor toggles (checkboxes, follow-action; shot = internal for follow/camera). */
let sceneDemo = null;

/** Current Europe/Prague clock as world hours (0–24, 0.25 step), same zone as the world server. */
function worldHourNow() {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Prague",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
    return Math.round((hour + minute / 60) * 4) / 4;
  } catch (_) {
    return 18;
  }
}

function worldDemoReset(hour) {
  const I = LOM.Instances;
  if (!I) return null;
  const h = clampWorldHour(hour != null ? hour : worldHourNow());
  const objects = {};
  const base = { counters: I.emptyCounters() };
  for (const def of WORLD_OBJ_DEFS) {
    const inst = I.createInstance(def.kind, def.id, "tavern", { worldHour: h, ...(def.opts || {}) });
    objects[def.key] = inst;
    base[def.key] = { ...inst };
  }
  return {
    hour: h,
    base,
    objects,
    /* aliases for compose / follow-action */
    candle: objects.candle1,
    mug: objects.mug,
    firewood: objects.firewood,
    counters: { ...base.counters },
  };
}

function worldDemoRecompute(demo) {
  const I = LOM.Instances;
  const h = clampWorldHour(demo.hour);
  demo.hour = h;
  if (!demo.objects) demo.objects = {};
  const events = [];
  for (const def of WORLD_OBJ_DEFS) {
    const from = demo.base?.[def.key] || demo.objects[def.key];
    if (!from) continue;
    const adv = I.advance({ ...from }, h);
    demo.objects[def.key] = adv.inst;
    if (!demo.base) demo.base = { counters: I.emptyCounters() };
    if (!demo.base[def.key]) demo.base[def.key] = { ...from };
    events.push(...adv.events);
  }
  demo.candle = demo.objects.candle1;
  demo.mug = demo.objects.mug;
  demo.firewood = demo.objects.firewood;
  demo.counters = I.applyEvents(demo.base.counters || I.emptyCounters(), events);
  return demo;
}


/**
 * With the world-time slider the Doba switch is redundant (297. kolo): the slider readout names the asset set. The select
 * stays in the DOM (hidden) because the bake crossfade and the session read it. Without the slider (public demo) it stays.
 */
function hidePhaseKnob() {
  const lbl = document.querySelector('select[data-knob="phase"]')?.closest("label");
  if (lbl) lbl.hidden = true;
}

/** Keep Doba knob in sync when world-hour crosses a bake phase (slider = source of truth). */
function syncPhaseKnobFromWorldHour(hour, { applyBake = true } = {}) {
  const SC = LOM.SceneCompose;
  if (!SC?.phaseOfHour) return;
  const phase = SC.phaseOfHour(hour);
  const sel = document.querySelector('select[data-knob="phase"]');
  if (sel && sel.value !== phase) {
    sel.value = phase;
    if (applyBake && LOM.PHASES) {
      const idx = Math.max(0, LOM.PHASES.findIndex((p) => p.id === phase));
      state.clock = { day: state.clock?.day || 1, tick: idx * LOM.TICKS_PER_PHASE };
      if (state.screen === "origins") setPrologBg();
      else syncPhaseLook();
    }
  }
}

/** Doba → set world hour to a mid-phase value (0–24); recompute instances. */
function syncWorldHourFromPhase(phase) {
  const SC = LOM.SceneCompose;
  if (!worldDemo || !SC?.hourForPhase || !phase) return;
  const next = clampWorldHour(SC.hourForPhase(phase));
  if (next === worldDemo.hour) return;
  worldDemo.hour = next;
  worldDemoRecompute(worldDemo);
  renderWorldDemo({ rebuildClock: true });
}

/** Format world hour as HH:MM (24h). 16.75 → 16:45. One day only (0–24). */
function formatWorldClock(hour) {
  let tod = ((Number(hour) % 24) + 24) % 24;
  if (Number(hour) >= 24 && tod === 0) tod = 24; /* slider end = 24:00 */
  let hh = Math.floor(tod);
  let mm = Math.round((tod - hh) * 60);
  if (mm >= 60) {
    hh += 1;
    mm = 0;
  }
  if (hh > 24) hh = 24;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const WORLD_STATE_LABELS = {
  candle: { new: "nová", lit: "hoří", unlit: "zhasnutá", spent: "dohořelá" },
  mug: { full: "plný", part: "poloplný", empty: "prázdný" },
  bread: { whole: "celý", part: "ukousnutý", gone: "snědený" },
  firewood: { burning: "hoří", embers: "žhavé uhlíky", cold: "vyhaslý" },
};

/** Place objects in the tavern demo (4 candles in frame); scene pictures per object: data/scene-objects.js (`instance` = key here). */
const WORLD_OBJ_DEFS = [
  { key: "candle1", kind: "candle", id: "candle#tavern-table-1", label: "Svíčka · stůl", showKey: "candle1", opts: { state: "lit" } },
  { key: "candle2", kind: "candle", id: "candle#tavern-sconce-l", label: "Svíčka · levá stěna", showKey: "candle2", opts: { state: "lit" } },
  { key: "candle3", kind: "candle", id: "candle#tavern-sconce-r", label: "Pochodeň · pravá stěna", showKey: "candle3", opts: { state: "lit" } },
  { key: "candle4", kind: "candle", id: "candle#tavern-bar", label: "Svíčka · zadní stůl", showKey: "candle4", opts: { state: "lit" } },
  { key: "mug", kind: "mug", id: "mug#tavern-bar-1", label: "Korbel", showKey: "mug" },
  {
    key: "firewood",
    kind: "firewood",
    id: "firewood#tavern-hearth-1",
    label: "Krb",
    showKey: "fire",
    opts: { state: "burning", burnCycle: true, logs: 4 },
  },
];

function clampWorldHour(h) {
  const n = Number(h);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(24, Math.round(n * 4) / 4));
}

/** Progress 0–1 and caption for lifetime / fill axis. */
function worldObjProgress(inst) {
  const I = LOM.Instances;
  if (inst.kind === "candle") {
    const burned = I.candleBurnedAt(inst, worldDemo.hour);
    const max = inst.burnMax || 1;
    const left = Math.max(0, max - burned);
    return { pct: burned / max, text: `zbývá ${left.toFixed(1)} / ${max} h`, max, value: burned };
  }
  if (inst.kind === "mug") {
    const max = inst.capacity || 4;
    return { pct: 1 - inst.level / max, text: `${inst.level} / ${max} doušků`, max, value: max - inst.level };
  }
  if (inst.kind === "firewood") {
    const logs = I.firewoodLogsAt(inst, worldDemo.hour);
    const max = inst.logMax || 6;
    return { pct: 1 - logs / max, text: `${logs.toFixed(1)} / ${max} polen`, max, value: max - logs };
  }
  if (inst.kind === "bread") {
    const max = inst.slices || 4;
    return { pct: inst.eaten / max, text: `${inst.eaten} / ${max} snědeno`, max, value: inst.eaten };
  }
  return { pct: 0, text: "", max: 1, value: 0 };
}

/**
 * Dev: put an instance straight into the chosen state (the select used to try one action and snap back when no
 * single action reached it, e.g. spent, embers, empty mug). Builds a fresh instance with the fields of that state.
 */
function worldForceStateOpts(cur, want, h) {
  const I = LOM.Instances;
  const o = { worldHour: h };
  if (cur.kind === "candle") {
    const max = cur.burnMax;
    const burned = I.candleBurnedAt(cur, h);
    o.burnMax = max;
    if (want === "lit") Object.assign(o, { state: "lit", burned: burned >= max ? 0 : burned });
    else if (want === "unlit") Object.assign(o, { state: "unlit", burned: Math.min(max - 0.25, Math.max(0.25, burned)) });
    else if (want === "spent") Object.assign(o, { state: "spent", burned: max, spentAt: h });
  } else if (cur.kind === "mug") {
    const cap = cur.capacity;
    Object.assign(o, { capacity: cap, level: want === "full" ? cap : want === "empty" ? 0 : Math.max(1, Math.floor(cap / 2)) });
  } else if (cur.kind === "bread") {
    const n = cur.slices;
    Object.assign(o, { slices: n, eaten: want === "whole" ? 0 : want === "gone" ? n : 1 });
  } else if (cur.kind === "firewood") {
    Object.assign(o, { logMax: cur.logMax, burnRate: cur.burnRate, burnCycle: true, state: want });
    if (want === "burning") o.logs = Math.max(2, I.firewoodLogsAt(cur, h));
    else if (want === "embers") o.logs = 0;
    else Object.assign(o, { logs: 0, since: h - 2 });
  }
  return o;
}

function worldForceState(target, want) {
  const I = LOM.Instances;
  if (!worldDemo || !I) return;
  worldDemoRecompute(worldDemo);
  const cur = worldDemoInst(target);
  if (!cur || cur.state === want) return;
  const h = worldDemo.hour;
  const inst = I.advance(I.createInstance(cur.kind, cur.id, cur.place, worldForceStateOpts(cur, want, h)), h).inst;
  worldDemo.objects[target] = inst;
  if (!worldDemo.base) worldDemo.base = { counters: I.emptyCounters() };
  worldDemo.base[target] = { ...inst };
  if (target === "candle1") worldDemo.candle = inst;
  if (target === "mug") worldDemo.mug = inst;
  if (target === "firewood") worldDemo.firewood = inst;
  renderWorldDemo({ rebuildClock: false });
  highlightWorldObject(target);
}

/** Scene object (anchor) of a dev world instance key (data/scene-objects.js `instance`). */
function sceneObjectOfWorldKey(key) {
  return (LOM.SceneObjects?.OBJECTS || []).find((o) => o.instance === key) || null;
}

/** A state changed: outline the object for a moment instead of moving the camera (author, 297. kolo). */
function highlightWorldObject(key) {
  const obj = sceneObjectOfWorldKey(key);
  if (obj?.bbox) LOM.SceneView?.highlight?.(obj.bbox);
}

/** Object back to its preset instance at the current world hour, default object on the anchor (state only, no render). */
function worldResetObjectState(key) {
  const I = LOM.Instances;
  const def = WORLD_OBJ_DEFS.find((d) => d.key === key);
  if (!I || !worldDemo || !def) return false;
  const inst = I.createInstance(def.kind, def.id, "tavern", { worldHour: worldDemo.hour, ...(def.opts || {}) });
  if (!worldDemo.objects) worldDemo.objects = {};
  if (!worldDemo.base) worldDemo.base = { counters: I.emptyCounters() };
  worldDemo.objects[key] = inst;
  worldDemo.base[key] = { ...inst };
  if (key === "candle1") worldDemo.candle = inst;
  if (key === "mug") worldDemo.mug = inst;
  if (key === "firewood") worldDemo.firewood = inst;
  const obj = sceneObjectOfWorldKey(key);
  if (obj && sceneDemo?.placements) delete sceneDemo.placements[obj.id];
  return true;
}

/** ↺ on an object card: the state reset, then the list re-renders and the object is highlighted. */
function worldResetObject(key) {
  if (!worldResetObjectState(key)) return;
  renderWorldDemo({ rebuildClock: false });
  highlightWorldObject(key);
}

/** One-step actions that can move toward a chosen state (dev). */
function worldActionTowardState(inst, want) {
  if (inst.kind === "candle") {
    if (want === "lit" && (inst.state === "new" || inst.state === "unlit")) return "light";
    if ((want === "unlit" || want === "spent") && inst.state === "lit") return "extinguish";
    if (want === "new" && inst.state !== "new") return "replace";
  }
  if (inst.kind === "mug") {
    if (want === "empty" || want === "part") return inst.level > 0 ? "drink" : null;
  }
  if (inst.kind === "firewood") {
    if (want === "burning" && inst.state !== "burning") return "feed";
    if ((want === "embers" || want === "cold") && inst.state === "burning") return "extinguish";
  }
  if (inst.kind === "bread") {
    if (want === "part" || want === "gone") return inst.eaten < (inst.slices || 4) ? "eat" : null;
  }
  return null;
}

function worldActionsFor(inst) {
  if (inst.kind === "candle") {
    const a = [];
    if (inst.state === "new" || inst.state === "unlit") a.push(["light", "Zapálit"]);
    if (inst.state === "lit") a.push(["extinguish", "Zhasnout"]);
    if (inst.state !== "new" || inst.burned > 0) a.push(["replace", "Vyměnit"]);
    return a;
  }
  if (inst.kind === "mug") {
    return inst.level > 0 ? [["drink", "Napít se"]] : [];
  }
  if (inst.kind === "firewood") {
    const a = [];
    if (LOM.Instances.firewoodLogsAt(inst, worldDemo.hour) < inst.logMax) a.push(["feed", "Přiložit"]);
    if (inst.state === "burning") a.push(["extinguish", "Uhasit"]);
    return a;
  }
  if (inst.kind === "bread") {
    return inst.eaten < (inst.slices || 4) ? [["eat", "Uštípnout"]] : [];
  }
  return [];
}

/** Object select of an anchor: what stands there; objects without a cutout for this anchor are listed but cannot be picked. */
function worldObjPlaceSelectHtml(anchor) {
  const SO = LOM.SceneObjects;
  const SC = LOM.SceneCompose;
  if (!SO?.placementOptions || !anchor) return "";
  const p = LOM.SceneView?.getPlan?.();
  const ctx = { phase: p?.phase || SC.phaseOfHour(worldDemo?.hour ?? 18), shot: SC.shotKeyOf(sceneDemo?.shot), meta: SC.layerMeta };
  const cur = sceneDemo?.placements?.[anchor.id] || anchor.object;
  const opts = SO.placementOptions(anchor, ctx)
    .map((o) => {
      const sel = o.id === cur ? " selected" : "";
      const dis = o.ok ? "" : " disabled";
      return `<option value="${o.id}"${sel}${dis}>${escapeHtml(o.label)}${o.ok ? "" : " (chybí výřez)"}</option>`;
    })
    .join("");
  return `<label class="dev-obj-state" title="Co na této pozici stojí. Jiný objekt potřebuje vlastní výřez object-<objekt>@<pozice>.">objekt
        <select data-scene-place="${anchor.id}">${opts}</select></label>`;
}

/** One object position (anchor) with the object on it: state (no zoom on change), progress, actions, reset. */
function worldObjCardHtml(objDef, inst) {
  const key = objDef.key;
  const def = LOM.Instances.KINDS[inst.kind];
  const labels = WORLD_STATE_LABELS[inst.kind] || {};
  const prog = worldObjProgress(inst);
  const sceneObj = sceneObjectOfWorldKey(key);
  const anchor = sceneObj ? LOM.SceneObjects.anchorById(sceneObj.id) : null;
  const pickable = sceneObj ? LOM.SceneObjects.pickableStates(sceneObj, def.states || [], inst.state) : def.states || [];
  const states = pickable.map((s) => `<option value="${s}" ${s === inst.state ? "selected" : ""}>${labels[s] || s}</option>`).join("");
  const acts = worldActionsFor(inst)
    .map(
      ([act, label]) =>
        `<button type="button" class="dev-btn dev-obj-act" data-world-act="${act}" data-world-target="${key}">${label}</button>`
    )
    .join("");
  const pct = Math.round(Math.min(1, Math.max(0, prog.pct)) * 100);
  const placed = sceneDemo?.placements?.[anchor?.id];
  const warn = placed && placed !== anchor.object ? `<span class="dev-scene-warn">chybí výřez</span>` : "";
  return `<div class="dev-obj" data-world-target="${key}">
    <div class="dev-obj-head"><span class="dev-obj-name" title="Pozice objektu (kotva ${anchor ? anchor.id : key})">${escapeHtml(anchor ? anchor.label : objDef.label)}</span>
      ${LOM.SceneControls.resetButtonHtml(`data-world-obj-reset="${key}"`, DEV_RESET_TITLE)}
    </div>
    <div class="dev-obj-head dev-obj-head--controls">
      ${anchor ? worldObjPlaceSelectHtml(anchor) : ""}
      <label class="dev-obj-state">stav
        <select data-world-state data-world-target="${key}">${states}</select>
      </label>
      ${warn}
    </div>
    <div class="dev-obj-prog" title="${prog.text}">
      <div class="dev-obj-bar"><i style="width:${pct}%"></i></div>
      <span class="dev-obj-prog-label">${prog.text}</span>
    </div>
    ${acts ? `<div class="dev-obj-acts">${acts}</div>` : ""}
  </div>`;
}

/**
 * Dev Čas + Místo. rebuildClock:false keeps the range input alive while dragging.
 * Objects re-render every time (state/progress follow the slider).
 */
function renderWorldDemo({ rebuildClock = true } = {}) {
  const clock = $("dev-world-clock");
  const objects = $("dev-world-objects");
  const out = $("dev-world-out");
  if (!clock || !objects || !out || !worldDemo || !LOM.Instances) return;
  const h = worldDemo.hour;
  /* The slider is the only time control; next to it the asset set the picture uses (ráno / poledne / večer / noc). */
  const labelText = LOM.SceneControls ? LOM.SceneControls.timeReadout(h) : formatWorldClock(h);
  if (rebuildClock || !$("dev-world-hour")) {
    clock.innerHTML = `<label class="dev-knob dev-world-hour-knob">${LOM.SceneControls ? LOM.SceneControls.LABELS.hour : "Hodina scény"}
    <input type="range" id="dev-world-hour" min="0" max="24" step="0.25" value="${h}" />
  </label>
  <span class="dev-world-hour-label" id="dev-world-hour-label" title="Hodina scény · denní doba, podle které se bere sada obrazů">${labelText}</span>`;
    hidePhaseKnob();
  } else {
    const input = $("dev-world-hour");
    const label = $("dev-world-hour-label");
    if (input && document.activeElement !== input) input.value = String(h);
    if (label) label.textContent = labelText;
  }
  /* Objects belong to the place: only a place with anchors (the tavern) has them; switching Místo empties the list. */
  if (!devPlaceAnchors().length) {
    objects.innerHTML = `<p class="dev-scene-note">Objekty: toto místo zatím nemá skládanou scénu (pozice objektů má jen ${escapeHtml(PLACE.tavern?.title || "krčma")}).</p>`;
  } else {
    objects.innerHTML =
      `<p class="dev-scene-label">Objekty na pozicích</p>` +
      WORLD_OBJ_DEFS.map((def) => {
        const inst = worldDemo.objects?.[def.key] || worldDemo[def.key];
        return inst ? worldObjCardHtml(def, inst) : "";
      }).join("") +
      `<details class="dev-scene-objects" id="dev-scene-objects" ${sceneDemo?.objOpen ? "open" : ""}><summary>Další pozice (jen malba)</summary><ul></ul></details>`;
  }
  const c = worldDemo.counters;
  out.textContent = `svět: svíčky ${c.candle_burned} · pivo ${c.ale_drunk} · chléb ${c.bread_eaten} · dřevo ${c.firewood_burned}`;
  syncSceneCompose();
  if (!storybookBooting) writeStorybookSession();
}

function worldDemoInst(target) {
  if (!worldDemo || !target) return null;
  return worldDemo.objects?.[target] || worldDemo[target] || null;
}

function applyWorldDemoAction(target, act) {
  if (!worldDemo || !LOM.Instances || !target || !act) return;
  const I = LOM.Instances;
  worldDemoRecompute(worldDemo);
  const cur = worldDemoInst(target);
  if (!cur) return;
  const r = I.applyAction(cur, act, worldDemo.hour);
  if (!worldDemo.objects) worldDemo.objects = {};
  if (!worldDemo.base) worldDemo.base = { counters: I.emptyCounters() };
  worldDemo.objects[target] = r.inst;
  worldDemo.base[target] = { ...r.inst };
  if (target === "candle1") worldDemo.candle = r.inst;
  if (target === "mug") worldDemo.mug = r.inst;
  if (target === "firewood") worldDemo.firewood = r.inst;
  worldDemo.base.counters = I.applyEvents(worldDemo.counters, r.events);
  worldDemo.counters = { ...worldDemo.base.counters };
  renderWorldDemo({ rebuildClock: false });
  /* No camera move on a state change (297. kolo): the object is outlined briefly instead. */
  highlightWorldObject(target);
}
