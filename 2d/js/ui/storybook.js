let devKnobs = {};

/** Storybook session (Cmd+R): full knobs + world/scene + peek. Defaults only on preset ↺ / change. */
const STORYBOOK_SESSION_KEY = "lom.storybook";
/** True while initDevStorybook boots – loadPreset must not wipe restored world/scene. */
let storybookBooting = false;

function readStorybookSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORYBOOK_SESSION_KEY) || "null");
  } catch (_) {
    return null;
  }
}

function snapshotWorldDemo() {
  if (!worldDemo) return null;
  const base = { counters: worldDemo.base?.counters ? { ...worldDemo.base.counters } : null };
  for (const def of WORLD_OBJ_DEFS) {
    const b = worldDemo.base?.[def.key] || worldDemo.objects?.[def.key];
    base[def.key] = b ? { ...b } : null;
  }
  /* Legacy alias so older session readers still see a candle. */
  if (base.candle1 && !base.candle) base.candle = { ...base.candle1 };
  return { hour: worldDemo.hour, base };
}

function snapshotSceneDemo() {
  if (!sceneDemo) return null;
  return {
    shot: sceneDemo.shot,
    shotSel: sceneDemo.shotSel || null,
    show: sceneDemo.show ? { ...sceneDemo.show } : null,
    cast: sceneDemo.cast ? { ...sceneDemo.cast } : null,
    placements: sceneDemo.placements ? { ...sceneDemo.placements } : null,
    fx: sceneDemo.fx ? { ...sceneDemo.fx } : null,
    tune: sceneDemo.tune ? { ...sceneDemo.tune } : null,
    tuneOpen: !!sceneDemo.tuneOpen,
    dbg: sceneDemo.dbg ? { ...sceneDemo.dbg } : null,
    depthOp: sceneDemo.depthOp,
  };
}

function snapshotDevToggles() {
  if (!state?.dev || typeof state.dev !== "object") return null;
  return { ...state.dev };
}

function writeStorybookSession() {
  if (!state.activeScenario) return;
  try {
    const ph = LOM.phaseOf?.(state.clock)?.id || "evening";
    const knobs = typeof knobsFromUi === "function" ? knobsFromUi() : null;
    sessionStorage.setItem(
      STORYBOOK_SESSION_KEY,
      JSON.stringify({
        scenarioId: state.activeScenario,
        peek: isOriginsPeeking(),
        peekPan: { x: peekPan.x, y: peekPan.y, scale: peekPan.scale },
        peekFocus: { x: peekFocus.x, y: peekFocus.y },
        phase: ph === "afternoon" ? "evening" : ph,
        prologShot: state.prologShot,
        prologStyle: state.prologStyle || DEFAULT_PROLOG_STYLE,
        knobs,
        world: snapshotWorldDemo(),
        scene: snapshotSceneDemo(),
        toggles: snapshotDevToggles(),
      })
    );
  } catch (_) {}
}

/** Apply knob map onto UI controls (does not applyScenario by itself). */
function applyKnobsToUi(knobs) {
  if (!knobs || !LOM.KNOBS) return;
  for (const k of LOM.KNOBS) {
    if (!Object.prototype.hasOwnProperty.call(knobs, k.id)) continue;
    const el = document.querySelector(`[data-knob="${k.id}"]`);
    if (!el) continue;
    const v = knobs[k.id];
    if (k.type === "check") el.checked = v === true || v === "1" || v === 1;
    else el.value = String(v);
  }
}

/** Fresh world + scene from current Doba (or now). Used when preset changes / chrome ↺. */
function resetDevWorldSceneFromPreset() {
  const ph = document.querySelector('select[data-knob="phase"]')?.value;
  const hour =
    (ph && LOM.SceneCompose?.hourForPhase?.(ph)) != null
      ? LOM.SceneCompose.hourForPhase(ph)
      : worldHourNow();
  if (LOM.Instances && $("dev-world-out")) {
    worldDemo = worldDemoRecompute(worldDemoReset(hour));
    renderWorldDemo({ rebuildClock: true });
    syncPhaseKnobFromWorldHour(worldDemo.hour);
  }
  if (sceneDemo && LOM.SceneCompose) {
    sceneDemo.shot = "celek";
    sceneDemo.shotSel = "celek";
    sceneDemo.show = { ...LOM.SceneCompose.DEFAULT_SHOW };
    sceneDemo.cast = {};
    sceneDemo.placements = {};
    renderSceneComposeControls();
    syncSceneCompose();
  }
}

function restoreWorldDemoFromSession(snap) {
  if (!snap || !LOM.Instances || !$("dev-world-out")) return false;
  const hour = clampWorldHour(snap.hour != null ? Number(snap.hour) : worldHourNow());
  const demo = worldDemoReset(hour);
  if (snap.base?.counters) demo.base.counters = { ...snap.base.counters };
  for (const def of WORLD_OBJ_DEFS) {
    const legacy = def.key === "candle1" ? snap.base?.candle : null;
    const src = snap.base?.[def.key] || legacy;
    if (src) demo.base[def.key] = { ...src };
  }
  worldDemo = worldDemoRecompute(demo);
  renderWorldDemo({ rebuildClock: true });
  syncPhaseKnobFromWorldHour(worldDemo.hour, { applyBake: false });
  return true;
}

function restoreSceneDemoFromSession(snap) {
  if (!snap || !sceneDemo || !LOM.SceneCompose) return false;
  if (snap.show) sceneDemo.show = LOM.SceneCompose.normalizeShow(snap.show);
  /* Old snapshots carry legacy shot ids (svatava/pijan): map them so the Kamera select matches an option. */
  sceneDemo.shot = LOM.SceneCompose.shotIdOf(snap.shot || "celek");
  sceneDemo.shotSel = sceneDemo.shot === "custom" ? LOM.SceneControls?.NONE || "---" : sceneDemo.shot;
  /* cast and placements are keyed by slot id / anchor id (unchanged since before the slot-key refactor): no legacy pass needed. */
  sceneDemo.cast = snap.cast ? { ...snap.cast } : {};
  sceneDemo.placements = snap.placements ? { ...snap.placements } : {};
  /* Old sessions kept "Bez parallaxu" as the debug flag `fixed`; it is the on switch of the Parallax effect now. */
  sceneDemo.fx = snap.fx ? { parallax: true, ...snap.fx } : { parallax: !snap.dbg?.fixed };
  if (snap.tune) sceneDemo.tune = { ...sceneTuneDefaults(), ...snap.tune };
  if (snap.tuneOpen != null) sceneDemo.tuneOpen = !!snap.tuneOpen;
  if (snap.dbg) sceneDemo.dbg = { ...sceneDemo.dbg, ...snap.dbg };
  if (snap.depthOp != null) sceneDemo.depthOp = Number(snap.depthOp) || sceneDemo.depthOp;
  renderSceneComposeControls();
  if (sceneDemo.shot && sceneDemo.shot !== "custom") applySceneShot(sceneDemo.shot, { animate: false, sel: sceneDemo.shotSel });
  else syncSceneCompose();
  return true;
}

function restoreDevTogglesFromSession(snap) {
  if (!snap || typeof snap !== "object") return false;
  for (const [id, v] of Object.entries(snap)) {
    if (typeof v === "boolean") state.dev[id] = v;
  }
  document.querySelectorAll("[data-toggle]").forEach((el) => {
    const id = el.dataset.toggle;
    if (id && typeof state.dev[id] === "boolean") el.checked = state.dev[id];
  });
  syncDevHitboxes();
  return true;
}

/** Seed / re-apply saved peek camera. Safe before enterPeekMode (no clamp while layout is empty). */
function restorePeekCameraFromSession(snap) {
  if (!snap?.peek || state.screen !== "origins") return false;
  if (snap.peekFocus && typeof snap.peekFocus.x === "number" && typeof snap.peekFocus.y === "number") {
    peekFocus = { x: snap.peekFocus.x, y: snap.peekFocus.y };
  }
  if (snap.peekPan && typeof snap.peekPan.x === "number") {
    peekPan = {
      x: snap.peekPan.x,
      y: Number(snap.peekPan.y) || 0,
      scale: Math.max(1, Number(snap.peekPan.scale) || 1),
    };
    /* Only clamp/paint once the cover/stage layout exists – otherwise clampPeekPan would zero the pan. */
    if (peekLayout.ew > 0 && peekLayout.vw > 0) {
      clampPeekPan();
      applyPeekTransform();
    }
    if (sceneDemo && snap.scene?.shot === "custom") {
      sceneDemo.shot = "custom";
      const sel = snap.scene.shotSel;
      sceneDemo.shotSel = sel && sel !== (LOM.SceneControls?.NONE || "---") ? LOM.SceneCompose.shotIdOf(sel) : LOM.SceneControls?.NONE || "---";
      const host = $("dev-scene-camera");
      if (host && LOM.SceneControls) host.innerHTML = sceneShotHtml();
    }
  }
  return true;
}

/**
 * Postaví celou scénu ze scénáře (+ přepisy z knobů) od čistého stavu a otevře obrazovku.
 * Stejný scénář + stejné knoby = stejný stav (seed).
 * Peek (👁) se po apply obnoví, pokud zůstáváme v prologu.
 */
function applyScenario(id, knobs = devKnobs) {
  /* During the storybook boot, boot-peek already marks the stage; initDevStorybook owns the single peek re-enter. */
  const restorePeek = !storybookBooting && isOriginsPeeking();
  lastOriginStep = -1;
  lastRevealed = "";
  const base = LOM.SCENARIOS.find((x) => x.id === id);
  if (!base) return;
  const sc = { ...base };
  for (const k of LOM.KNOBS) if (Object.prototype.hasOwnProperty.call(knobs, k.id)) k.apply(sc, knobs[k.id]);

  /* Místo (jen krčma) */
  const place = sc.place || "tavern";
  storyPlaceId = place;

  const keep = { dev: state.dev };
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, makeState(), keep);
  state.activeScenario = id; /* dev scéna */
  state.prologStyle = sc.prologStyle || DEFAULT_PROLOG_STYLE;
  state.prologShot = sc.prologShot === "s1" || sc.prologShot === "s2" ? sc.prologShot : null;
  if (sc.seed != null) state.seed = sc.seed;
  state.name = "Testovací Poutník";
  state.guest = true;
  state.prologDone = { class: true, race: true, origin: true };
  state.picks = { class: "tracker", race: sc.picks?.race || "local", origin: sc.picks?.origin || null };
  if (sc.phase || sc.day) state.clock = { day: sc.day || 1, tick: sc.phase ? LOM.PHASES.findIndex((p) => p.id === sc.phase) * LOM.TICKS_PER_PHASE : state.clock.tick };

  clearUiScrollMem();
  {
    state.prologDone = sc.prologDone
      ? { class: !!sc.prologDone.class, race: !!sc.prologDone.race, origin: !!sc.prologDone.origin }
      : { class: false, race: false, origin: false };
    const step = Math.max(0, Math.min(ORIGIN_STEPS.length - 1, sc.originStep | 0));
    state.originStep = step;
    state.originReached = Math.max(step, state.prologDone.class ? 1 : 0);
    setScreen("origins");
  }
  if (restorePeek && state.screen === "origins") {
    enterPeekMode();
    setPeekButtonState(document.querySelector(".peek-btn"), true);
  }
  writeStorybookSession();
  syncDevUi();
}

/**
 * Živý stav hry → objekt ve tvaru scénáře (pro from() knobs).
 * Předvolba jen nastaví default; pak knoby zrcadlí, co se ve scéně hraje.
 */
function liveAsScenario() {
  const ph = LOM.phaseOf?.(state.clock)?.id || "evening";
  return {
    place: storyPlaceId || "tavern",
    phase: ph === "afternoon" ? "evening" : ph,
    originStep: state.originStep | 0,
    prologShot: prologShotId(),
    prologDone: state.prologDone ? { ...state.prologDone } : { class: false, race: false, origin: false },
    picks: state.picks ? { ...state.picks } : {},
    prologStyle: state.prologStyle || DEFAULT_PROLOG_STYLE,
  };
}

/** Dev knoby ← živá scéna (bez apply; programmatic select nespouští change). */
function mirrorLiveToKnobs() {
  if (!window.LOM?.KNOBS || !state.activeScenario) return;
  fillKnobsFromScenario(liveAsScenario());
}

function syncDevUi() {
  const sel = $("dev-scenario");
  const note = $("dev-note");
  const sc = LOM.SCENARIOS.find((x) => x.id === (sel?.value || state.activeScenario));
  if (note) {
    note.textContent = sc ? sc.note || "" : "";
    note.classList.toggle("hidden", !sc?.note);
  }
  mirrorLiveToKnobs();
  syncDevPad();
}

/** Stav systému: progress tracker from LOM.SYSTEMS (js/dev/scenarios.js), rank funguje → maketa → chybí. Dev box only. */
function renderDevStatus() {
  const st = $("dev-status");
  if (!st || !LOM.SYSTEMS) return;
  const rank = { funguje: 0, maketa: 1, chybí: 2 };
  const list = [...LOM.SYSTEMS].sort((a, b) => rank[a.status] - rank[b.status]);
  const total = Math.round(list.reduce((n, x) => n + x.pct, 0) / list.length);
  st.innerHTML = `
    <div class="box-subhead">
    <p class="dev-total"><strong>Hotovost 2D ≈ ${total} %</strong> <span>(hrubý odhad podle systémů)</span></p>
    <p class="dev-legend"><span class="sys-funguje">funguje</span> = skutečná pravidla, testy · <span class="sys-maketa">maketa</span> = UI je, efekt jen zčásti nebo vůbec · <span class="sys-chybí">chybí</span> = nic</p>
    </div>
    ${["funguje", "maketa", "chybí"]
      .map((stt) => {
        const items = list.filter((x) => x.status === stt);
        if (!items.length) return "";
        return `<details class="dev-sec dev-sys-sec"${stt === "funguje" ? "" : " open"}><summary><span class="sys-${stt}">${stt}</span> ${items.length}</summary><ul class="dev-sys-list">${items
          .map(
            (x) =>
              `<li><span class="dev-sys-name">${x.name}${x.phase ? ` <span class="dev-phase">${x.phase}</span>` : ""}</span><span class="dev-sys-pct">${x.pct}&nbsp;%</span><i class="dev-bar" aria-hidden="true"><b style="width:${x.pct}%"></b></i>${x.note ? `<em class="dev-sys-note">${x.note}</em>` : ""}</li>`
          )
          .join("")}</ul></details>`;
      })
      .join("")}`;
}

/** Aktuální přepínače = zdroj pravdy (select + checkbox knoby). */
function knobsFromUi() {
  const out = {};
  document.querySelectorAll("[data-knob]").forEach((el) => {
    if (el.matches?.('input[type="checkbox"]')) out[el.dataset.knob] = el.checked ? "1" : "0";
    else out[el.dataset.knob] = el.value;
  });
  return out;
}

function knobControlHtml(k) {
  if (k.type === "check") {
    const tipCls = k.tip ? " has-tip" : "";
    const tipAttr = k.tip ? ` data-tip="${String(k.tip).replace(/"/g, "&quot;")}"` : "";
    return `<label class="dev-chk${tipCls}"${tipAttr}><input type="checkbox" data-knob="${k.id}" /> ${k.label}</label>`;
  }
  return `<label class="dev-knob">${k.label}<select data-knob="${k.id}">${(k.opts || [])
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join("")}</select></label>`;
}

/**
 * Naplní přepínače ze scénáře / živého zrcadla.
 * Předvolba + ↺ = default scény; při hraní knoby zrcadlí stav (mirrorLiveToKnobs).
 */
function fillKnobsFromScenario(sc) {
  if (!sc || !window.LOM?.KNOBS) return;
  LOM.KNOBS.forEach((k) => {
    if (k.type === "check") {
      const el = document.querySelector(`input[type="checkbox"][data-knob="${k.id}"]`);
      if (el) el.checked = !!k.from(sc);
      return;
    }
    const sel = document.querySelector(`select[data-knob="${k.id}"]`);
    if (!sel) return;
    let v = k.from(sc);
    if (v === "" || v == null) v = k.opts[0]?.[0] ?? "";
    const vs = String(v);
    if (![...sel.options].some((o) => o.value === vs)) {
      const opt = document.createElement("option");
      opt.value = vs;
      opt.textContent = vs;
      sel.appendChild(opt);
    }
    sel.value = vs;
  });
  devKnobs = knobsFromUi();
}

/** Název scény ve výběru. */
function scenarioOptionLabel(sc) {
  return sc ? sc.label : "";
}

function refreshScenarioOptionLabels(knobs = {}) {
  const sel = $("dev-scenario");
  if (!sel || !window.LOM?.SCENARIOS) return;
  [...sel.options].forEach((opt) => {
    const sc = LOM.SCENARIOS.find((x) => x.id === opt.value);
    if (sc) opt.textContent = scenarioOptionLabel(sc);
  });
}

/** Veřejná lišta: jen Místo (krčma) + Doba (4); bez předvolby / režimu / stylu / systémů. */
const PUBLIC_DEV_KNOB_IDS = new Set(["place", "phase"]);

function publicDevKnobs() {
  return LOM.KNOBS.filter((k) => PUBLIC_DEV_KNOB_IDS.has(k.id)).map((k) => {
    if (k.id !== "place") return k;
    return { ...k, opts: devPlaceOpts().filter(([id]) => id === "tavern") };
  });
}

/**
 * Dev Místo: the prolog place only (PLACE stub; other places are not part of this repo). A place with a composed scene (object anchors) is marked; positions and objects exist only there.
 */
function devPlaceOpts() {
  const hasScene = (id) => (LOM.SceneObjects?.anchorsFor?.(id) || []).length > 0;
  const mark = (id, label) => [id, hasScene(id) ? `${label} · scéna` : label];
  return Object.entries(PLACE).map(([id, p]) => mark(id, p.title || id));
}

/** Place the dev bar describes (Místo knob, else the storybook place). */
function devPlaceId() {
  return document.querySelector('select[data-knob="place"]')?.value || storyPlaceId || "tavern";
}

/** Anchors of the dev place; [] = no composed scene there (no positions, no objects). */
function devPlaceAnchors() {
  return LOM.SceneObjects?.anchorsFor?.(devPlaceId()) || [];
}
