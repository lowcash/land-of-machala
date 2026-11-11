/** Push worldDemo + sceneDemo into SceneView (parallax always on while composing). */
/** Bake key of the prolog scene the composed layers last showed (see syncSceneCompose). */
let sceneSceneKey = "";

function syncSceneCompose() {
  /* Boot hold: the stored state is not applied yet, so composing now would show the defaults first (releaseBootCompose composes). */
  if (bootHold.held()) return;
  if (!LOM.SceneCompose || !LOM.SceneView?.enabled || !sceneDemo?.on) {
    if (LOM.SceneView && sceneDemo && !sceneDemo.on) LOM.SceneView.unmount();
    return;
  }
  if (!worldDemo || !LOM.Instances) return;
  const I = LOM.Instances;
  const candle = worldDemoInst("candle1") || worldDemo.candle;
  const mug = worldDemoInst("mug") || worldDemo.mug;
  const firewood = worldDemoInst("firewood") || worldDemo.firewood;
  if (!candle || !mug || !firewood) return;
  /* Prolog / Postava: the visible bake phase (state.clock) is the truth. The dev world clock starts at real
   * Prague time and may disagree (night at 23:00 vs evening scenario) – taking it here blanked the scene on
   * the first slider move. */
  const onPrologScreen = state.screen === "origins";
  /* Prolog: the composed scene follows the beat (plate = the baked S1/S2, Svatava removed once she leaves). */
  const beat = onPrologScreen ? LOM.SceneCompose.prologBeat((ORIGIN_STEPS[state.originStep] || {}).pick) : null;
  const desc = {
    ...(onPrologScreen ? { phase: prologBakePhase(), plate: prologShotId() } : { time: worldDemo.hour }),
    shot: sceneDemo.shot || "celek",
    show: beat ? LOM.SceneCompose.applyBeatShow(sceneDemo.show, beat) : sceneDemo.show,
    parallax: true,
    parallaxTune: sceneDemo.tune,
    instances: {
      candle: I.variantFor(candle),
      mug: I.variantFor(mug),
      firewood: { state: firewood.state, variant: I.variantFor(firewood).variant },
    },
    /* Every place object by its key (data/scene-objects.js `instance`): state + variant flags. */
    objects: Object.fromEntries(
      WORLD_OBJ_DEFS.map((def) => [def.key, worldDemoInst(def.key)])
        .filter(([, inst]) => inst)
        .map(([key, inst]) => [key, { ...I.variantFor(inst), state: inst.state }])
    ),
    cast: sceneDemo.cast || {},
    weather: sceneDemo.weather || "clear",
    placements: sceneDemo.placements || {},
  };
  /* Prolog: fade only when the scene or time of day changes (a shot change in one scene is a plate cut under the camera tween). */
  let instant = false;
  if (onPrologScreen) {
    const key = prologBgKey();
    /* The first composition is a cut: nothing was shown before it. */
    instant = !sceneSceneKey || !LOM.PrologCamera.prologNeedsSceneFade(sceneSceneKey, key);
    sceneSceneKey = key;
  }
  LOM.SceneView.setFromDesc(desc, { instant });
  /* The plan can recreate the stage (.scene-compose-stage): the hotspot outlines are rebuilt on it, not only on toggle. */
  renderSceneHotspots();
  const plan = LOM.SceneView.getPlan?.();
  syncParticles(plan?.particles);
  updateSceneComposeReadout(plan);
  syncSceneSlotsIfStale();
  LOM.SceneView.setCamera?.(peekSceneCamera(), { snap: bootPoseSnap });
}

function updateSceneComposeReadout(plan) {
  const readout = $("dev-scene-readout");
  if (!readout) return;
  const m = LOM.SceneView?.getMetrics?.() || {};
  const p = plan || LOM.SceneView?.getPlan?.();
  if (!p) {
    readout.textContent = "";
    return;
  }
  const kb = ((m.bytes || p.bytes || 0) / 1024).toFixed(0);
  const bits = [
    `${p.layers.length} vrstev`,
    `${kb} KiB`,
    m.fps ? `~${m.fps} fps` : null,
    p.readout.length ? p.readout.join(" · ") : null,
  ].filter(Boolean);
  readout.textContent = bits.join(" · ");
  renderSceneObjectList(p);
}

const SCENE_OBJ_SOURCE = {
  plate: "v malbě",
  cutout: "výřez",
  legacy: "starý překryv",
  missing: "chybí obraz",
  hidden: "skryto",
  baked: "v malbě, nejde skrýt",
};

/** Dev: the painted-only positions (no instance, one state) with their object and picture source (plan.objects). */
function renderSceneObjectList(p) {
  const box = $("dev-scene-objects");
  const list = box?.querySelector("ul");
  if (!list || !p?.objects) return;
  const labels = (kind) => WORLD_STATE_LABELS[kind === "firewood" ? "firewood" : kind] || {};
  const withCard = new Set(WORLD_OBJ_DEFS.map((d) => sceneObjectOfWorldKey(d.key)?.id).filter(Boolean));
  const rest = p.objects.filter((o) => !withCard.has(o.id));
  const sum = box.querySelector("summary");
  if (sum) sum.textContent = `Další pozice (${rest.length}, jen malba)`;
  list.innerHTML = rest
    .map((o) => {
      const st = labels(o.kind)[o.state] || o.state;
      return `<li data-source="${o.source}" title="${o.file || ""}">${escapeHtml(o.label)}: ${escapeHtml(st)} · ${SCENE_OBJ_SOURCE[o.source] || o.source}</li>`;
    })
    .join("");
}

/**
 * Pan that puts the preset's focus in the middle, clamped to the cover range at its zoom: the picture never leaves
 * an edge of the box uncovered (a focus near the right edge used to pan past it and show a black panel).
 */
function sceneShotPan(shot) {
  const bg = originsPeekBg();
  const scale = shot.zoom || 1;
  if (!bg) return { x: 0, y: 0, scale };
  const W = bg.offsetWidth; /* layout size, untransformed */
  const H = bg.offsetHeight;
  if (!(W > 0 && H > 0)) return { x: 0, y: 0, scale };
  const pan = LOM.PrologCamera.framePan({
    W,
    H,
    s: scale,
    focus: shot.focus,
    bgPos: { x: 0.5, y: 0.5 },
    targetX: W / 2,
    targetY: H / 2,
    cover: true,
  });
  return { x: pan.x, y: pan.y, scale };
}

/**
 * Move the camera to a shot preset (id) or a saved view ({ focus, zoom }). `sel` = the dropdown row to show
 * (the camera id); a manual pan later switches it to "---".
 */
function applySceneShot(shotOrId, { animate = true, sel } = {}) {
  if (!LOM.SceneCompose || !sceneDemo) return;
  const isObj = shotOrId && typeof shotOrId === "object";
  const shot = isObj ? { id: "custom", ease: 0.6, ...shotOrId } : LOM.SceneCompose.shotOf(shotOrId);
  sceneDemo.shot = shot.id;
  sceneDemo.shotSel = sel || (isObj ? LOM.SceneControls?.NONE || "---" : shot.id);
  peekFocus = { x: shot.focus.x, y: shot.focus.y };
  const to = sceneShotPan(shot);
  const bg = originsPeekBg();
  if (!bg) return;
  peekPan = { ...to };
  if (animate && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    bg.style.transition = `transform ${Math.round((shot.ease || 0.75) * 1000)}ms ${SCENE_FADE_EASE}`;
  } else {
    bg.style.transition = "none";
  }
  applyPeekTransform();
  syncSceneCompose();
  renderSceneComposeControls();
}

/** Value the camera dropdown shows: the camera id, or "---" after a manual pan. */
function sceneShotSelValue() {
  const CTL = LOM.SceneControls;
  if (!sceneDemo) return "celek";
  if (sceneDemo.shot === "custom") return CTL.NONE;
  return sceneDemo.shot || "celek";
}

/** Cameras of the dev place: only the real ones (the tavern has the shot presets; a place without a composed scene has none). */
function sceneShotHtml() {
  const CTL = LOM.SceneControls;
  const SC = LOM.SceneCompose;
  const head = sceneSectionHeadHtml(CTL.LABELS.camera, "camera", DEV_RESET_TITLE);
  if (!devPlaceAnchors().length) return `${head}<p class="dev-scene-note">Toto místo zatím nemá kamery.</p>`;
  const anchors = LOM.SceneObjects?.ANCHORS || [];
  const cameras = Object.values(SC.SHOTS).map((s) => ({ id: s.id, label: CTL.shotTitle(s, SC.SLOTS, anchors) }));
  const selected = sceneShotSelValue();
  const items = CTL.cameraItems({ cameras, selected });
  return `${head}
    <div class="dev-scene-row">
      <select id="dev-scene-shot" aria-label="Kamera místnosti: pozice a objekty">${CTL.presetSelectHtml(items, selected)}</select>
    </div>
    <p class="dev-scene-readout" id="dev-scene-readout"></p>`;
}

/** Plate the dev bar describes: shot key + phase of the current plan (cast and placement choices depend on both). */
function devPlateKey() {
  const SC = LOM.SceneCompose;
  const p = LOM.SceneView?.getPlan?.();
  const onProlog = state.screen === "origins";
  const phase = p?.phase || (onProlog ? prologBakePhase() : SC.phaseOfHour(worldDemo?.hour ?? 18));
  return { shot: SC.shotKeyOf(sceneDemo?.shot), phase };
}

/** Positions (slots) of the place with the actor on each; only actors with a cutout for this plate can be picked. */
function sceneSlotsHtml() {
  const SC = LOM.SceneCompose;
  const CTL = LOM.SceneControls;
  if (!devPlaceAnchors().length) {
    return `<p class="dev-scene-label">Pozice (postavy)</p><p class="dev-scene-note">Toto místo zatím nemá skládanou scénu.</p>`;
  }
  const { shot, phase } = devPlateKey();
  const rows = (SC.SLOTS || [])
    .map((sl) => {
      const who = sceneDemo.cast?.[sl.id] || sl.char;
      const opts = SC.castOptions(sl, shot, phase);
      const missing = opts.some((o) => o.char === who && !o.ok);
      const optHtml = opts
        .map((o) => `<option value="${o.char}" ${o.char === who ? "selected" : ""} ${o.ok ? "" : "disabled"}>${escapeHtml(o.label)}${o.ok ? "" : " (chybí výřez)"}</option>`)
        .join("");
      const shown = !!sceneDemo.show[sl.showKey];
      return `<div class="dev-scene-slot" title="Pozice ${sl.id}: hloubka a pořadí patří pozici; jiná postava potřebuje výřez char-<postava>@${sl.id}">
        <label class="dev-scene-slot-show"><input type="checkbox" data-scene-show="${sl.showKey}" ${shown ? "checked" : ""}/> ${escapeHtml(CTL.slotTitle(sl))}</label>
        <span class="dev-scene-slot-ctl">
          <select data-scene-cast="${sl.id}" aria-label="Kdo stojí na pozici ${sl.n}">${optHtml}</select>
          ${missing ? `<span class="dev-scene-warn">chybí výřez</span>` : ""}
        </span>
      </div>`;
    })
    .join("");
  sceneDemo.slotsKey = `${shot}|${phase}|${devPlaceId()}`;
  return `${sceneSectionHeadHtml("Pozice (postavy)", "slots", DEV_RESET_TITLE)}<div class="dev-scene-slots">${rows}</div>`;
}

/** Čas a počasí: weather behind the window. A kind without its sky picture at this phase is "(chybí)" (disabled), never drawn. */
function sceneWeatherHtml() {
  const SC = LOM.SceneCompose;
  if (!devPlaceAnchors().length) return "";
  const { phase } = devPlateKey();
  const wxOpts = SC.weatherOptions(phase);
  const wx = wxOpts.find((o) => o.id === (sceneDemo.weather || "clear")) || wxOpts[0];
  return `<p class="dev-scene-label">Počasí za oknem</p>
    <div class="dev-scene-row">
      <select id="dev-scene-weather" aria-label="Počasí za oknem">${wxOpts
        .map((o) => `<option value="${o.id}" ${o.id === wx.id ? "selected" : ""} ${o.ok ? "" : "disabled"}>${escapeHtml(o.label)}${o.ok ? "" : " (chybí)"}</option>`)
        .join("")}</select>
      ${wx.ok ? "" : `<span class="dev-scene-warn">chybí</span>`}
    </div>`;
}

/* [key, label, step, format, hint]: the hint says what the knob changes and in which unit (tooltip). */
const SCENE_TUNE_KNOBS = [
  ["maxShiftPx", "Síla", 1, (v) => `${v} px`, "Síla parallaxu: o kolik pixelů (v obraze 1365 px) se posune nejbližší část scény při plném panu. 0 = bez posunu."],
  ["fullPanFrac", "Dosah panu", 0.01, (v) => `${Math.round(v * 100)} %`, "Při jakém posunu kamery (v % šířky obrazu) dosáhne parallax plné síly. Menší číslo = citlivější."],
  ["yScale", "Svislý posun", 0.05, (v) => `×${v.toFixed(2)}`, "Kolik z vodorovného posunu platí i svisle (1 = stejně, 0 = jen vodorovně)."],
  ["charScale", "Hloubka postav", 0.1, (v) => `×${v.toFixed(1)}`, "Násobek hloubky postav (1 = podle dat; víc = postavy se při panu hýbou víc)."],
];

function sceneTuneDefaults() {
  const P = LOM.SceneCompose.PARALLAX;
  return { maxShiftPx: P.maxShiftPx, fullPanFrac: P.fullPanFrac, yScale: P.yScale, charScale: 1 };
}

/** Factory values of the Efekty section (initSceneComposeDemo and the section ↺ share them). */
function sceneFxFactory() {
  return {
    fx: { parallax: true },
    tune: sceneTuneDefaults(),
    depthOp: 0.55,
    dbg: { depth: false, fixed: false, split: false, sweep: false, hold: 0 },
  };
}

/** Section heading with its ↺ (data-scene-reset = section key, handled in onSceneComposeClick). */
function sceneSectionHeadHtml(label, sec, title) {
  return `<div class="dev-scene-head"><p class="dev-scene-label">${label}</p>${LOM.SceneControls.resetButtonHtml(`data-scene-reset="${sec}"`, title)}</div>`;
}

/** Dev section ↺: the section's values back to the scene preset (same defaults as resetDevWorldSceneFromPreset). */
function resetSceneSection(sec) {
  if (!sceneDemo || !LOM.SceneCompose) return;
  if (sec === "camera") {
    applySceneShot("celek");
  } else if (sec === "slots") {
    sceneDemo.cast = {};
    sceneDemo.placements = {};
  } else if (sec === "fx") {
    Object.assign(sceneDemo, sceneFxFactory());
  } else return;
  renderSceneComposeControls();
  if (worldDemo) renderWorldDemo({ rebuildClock: false });
  syncSceneCompose();
  writeStorybookSession();
}

function sceneTuneRowHtml([k, label, step, fmt, hint]) {
  const [lo, hi] = LOM.SceneCompose.PARALLAX_LIMITS[k];
  const v = sceneDemo.tune[k];
  return `<label class="dev-knob dev-range" title="${hint}">${label}
        <input type="range" data-scene-tune="${k}" min="${lo}" max="${hi}" step="${step}" value="${v}" />
        <output>${fmt(v)}</output></label>`;
}

/**
 * Efekty: one block per effect. The header holds open/close, the on switch and the reset to defaults; the details
 * (left aligned) open below it. Parallax: the px strength first, then the rest. Room for more effects later.
 */
function sceneEffectsHtml() {
  const fx = sceneDemo.fx || { parallax: true };
  const open = !!sceneDemo.tuneOpen;
  const rows = SCENE_TUNE_KNOBS.map(sceneTuneRowHtml).join("");
  return `<div class="dev-scene-row">${LOM.SceneControls.resetButtonHtml('data-scene-reset="fx"', DEV_RESET_TITLE)}</div>
  <div class="dev-fx" data-fx="parallax">
    <div class="dev-fx-head">
      <button type="button" class="dev-fx-toggle" data-scene-fx-open aria-expanded="${open}" aria-controls="dev-fx-parallax">Parallax</button>
      <label class="dev-fx-on" title="Zapnout / vypnout parallax (vypnuto = pevný obraz)"><input type="checkbox" data-scene-fx="parallax" ${fx.parallax !== false ? "checked" : ""}/> zapnuto</label>
    </div>
    <div class="dev-fx-body" id="dev-fx-parallax" ${open ? "" : "hidden"}>
      ${rows}
      <label class="dev-knob dev-range" title="Průhlednost hloubkové mapy přes obraz (tlačítko Hloubka)">Průhl. hloubky
        <input type="range" id="dev-scene-depth-op" min="0.1" max="1" step="0.05" value="${sceneDemo.depthOp}" aria-label="Průhlednost hloubkové mapy" />
        <output>${Math.round(sceneDemo.depthOp * 100)} %</output></label>
      <div class="dev-scene-row">
        <button type="button" class="dev-btn" data-scene-dbg="depth" title="Přes obraz se ukáže mapa hloubky: modrá = daleko (nehýbe se), červená = blízko (hýbe se nejvíc)">Hloubka</button>
        <button type="button" class="dev-btn" data-scene-dbg="split" title="Vlevo obraz bez parallaxu (A), vpravo s parallaxem (B), dělicí čára uprostřed">Půlit A | B</button>
        <button type="button" class="dev-btn" data-scene-dbg="sweep" title="Kamera se sama kolébe z jednoho plného panu do druhého (perioda 4 s)">Kývat</button>
        <button type="button" class="dev-btn" data-scene-hold="-1" title="Podržet plný pan vlevo">Držet vlevo</button>
        <button type="button" class="dev-btn" data-scene-hold="1" title="Podržet plný pan vpravo">Držet vpravo</button>
      </div>
      <p class="dev-scene-readout" id="dev-scene-probes"></p>
    </div>
  </div>`;
}

/** Hosts of the compose controls: camera (Obraz), positions (Místo), effects (Efekty). */
function sceneHosts() {
  return ["dev-weather", "dev-scene-camera", "dev-scene-compose", "dev-scene-effects"].map((id) => $(id)).filter(Boolean);
}

function renderSceneComposeControls() {
  if (!sceneDemo || !LOM.SceneCompose || !LOM.SceneControls) return;
  const shotHost = $("dev-scene-camera");
  const slotsHost = $("dev-scene-compose");
  const fxHost = $("dev-scene-effects");
  if (shotHost) shotHost.innerHTML = sceneShotHtml();
  if (slotsHost) slotsHost.innerHTML = sceneSlotsHtml();
  if (fxHost) fxHost.innerHTML = sceneEffectsHtml();
  renderSceneWeather();
  syncSceneDebugUi();
}

/** Positions depend on the plate (shot × phase) and the place: re-render them only when that changed (keeps an open select). */
function syncSceneSlotsIfStale() {
  const host = $("dev-scene-compose");
  if (!host || !sceneDemo || !LOM.SceneCompose) return;
  const { shot, phase } = devPlateKey();
  if (sceneDemo.slotsKey === `${shot}|${phase}|${devPlaceId()}`) return;
  host.innerHTML = sceneSlotsHtml();
  renderSceneWeather();
}

function renderSceneWeather() {
  const host = $("dev-weather");
  if (host && sceneDemo && LOM.SceneCompose) host.innerHTML = sceneWeatherHtml();
}

/** Chip states from sceneDemo.dbg (also pushes them to the view). Parallax off = the still picture (debug `fixed`). */
function syncSceneDebugUi() {
  if (!sceneDemo) return;
  const d = sceneDemo.dbg;
  const off = sceneDemo.fx?.parallax === false;
  LOM.SceneView?.setDebug?.({ depth: d.depth ? sceneDemo.depthOp : 0, split: d.split, fixed: off, sweep: d.sweep, hold: d.hold });
  for (const host of sceneHosts()) {
    for (const b of host.querySelectorAll("[data-scene-dbg]")) {
      const on = !!d[b.dataset.sceneDbg];
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    }
    for (const b of host.querySelectorAll("[data-scene-hold]")) {
      const on = d.hold === Number(b.dataset.sceneHold);
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    }
  }
}

function updateSceneProbes() {
  const el = $("dev-scene-probes");
  const info = LOM.SceneView?.getDebugInfo?.();
  if (!el || !info) return;
  if (info.mode !== "gl") {
    el.textContent = "pevný obraz (bez WebGL / ?parallax=0)";
    return;
  }
  const px = info.probes.map((p) => `${p.label} ${p.x.toFixed(1)}`).join(" · ");
  el.textContent = `posun px: ${px} · scale ×${info.overscan.toFixed(3)} (max ${info.maxShiftPx} px)`;
}

function onSceneComposeChange(e) {
  const t = e.target;
  if (!t || !sceneDemo) return;
  e.stopPropagation(); /* do not trip storybook knobs / applyScenario */
  const CTL = LOM.SceneControls;
  if (t.id === "dev-scene-shot") {
    const v = CTL.parsePresetValue(t.value);
    if (v.kind === "preset") applySceneShot(v.id);
    writeStorybookSession();
    return;
  }
  if (t.id === "dev-scene-weather") {
    sceneDemo.weather = t.value;
    renderSceneWeather();
    syncSceneCompose();
    writeStorybookSession();
    return;
  }
  if (t.dataset.sceneShow) {
    sceneDemo.show[t.dataset.sceneShow] = t.checked;
    syncSceneCompose();
    writeStorybookSession();
    return;
  }
  if (t.dataset.sceneFx) {
    if (!sceneDemo.fx) sceneDemo.fx = { parallax: true };
    sceneDemo.fx[t.dataset.sceneFx] = t.checked;
    syncSceneDebugUi();
    updateSceneProbes();
    writeStorybookSession();
    return;
  }
  if (t.dataset.sceneCast) {
    const slot = (LOM.SceneCompose.SLOTS || []).find((sl) => sl.id === t.dataset.sceneCast);
    if (!sceneDemo.cast) sceneDemo.cast = {};
    if (!slot || t.value === slot.char) delete sceneDemo.cast[t.dataset.sceneCast];
    else sceneDemo.cast[t.dataset.sceneCast] = t.value;
    $("dev-scene-compose").innerHTML = sceneSlotsHtml();
    syncSceneCompose();
    writeStorybookSession();
  }
}

/* Parallax tuning + debug chips (dev only). Nothing here reaches applyScenario / the storybook knobs. */
function onSceneComposeInput(e) {
  const t = e.target;
  if (!t || !sceneDemo) return;
  if (t.dataset?.sceneTune) {
    e.stopPropagation();
    const k = t.dataset.sceneTune;
    sceneDemo.tune[k] = Number(t.value);
    const fmt = SCENE_TUNE_KNOBS.find((x) => x[0] === k)?.[3];
    if (fmt && t.nextElementSibling) t.nextElementSibling.textContent = fmt(sceneDemo.tune[k]);
    syncSceneCompose();
    updateSceneProbes();
    writeStorybookSession();
  } else if (t.id === "dev-scene-depth-op") {
    e.stopPropagation();
    sceneDemo.depthOp = Number(t.value);
    if (t.nextElementSibling) t.nextElementSibling.textContent = `${Math.round(sceneDemo.depthOp * 100)} %`;
    syncSceneDebugUi();
    writeStorybookSession();
  }
}

function onSceneComposeClick(e) {
  const b = e.target?.closest?.("button");
  if (!b || !sceneDemo) return;
  const d = sceneDemo.dbg;
  const CTL = LOM.SceneControls;
  if (b.dataset.sceneDbg) {
    d[b.dataset.sceneDbg] = !d[b.dataset.sceneDbg];
    if (b.dataset.sceneDbg === "sweep" && d.sweep) d.hold = 0;
  } else if (b.dataset.sceneHold) {
    const h = Number(b.dataset.sceneHold);
    d.hold = d.hold === h ? 0 : h;
    if (d.hold) d.sweep = false;
  } else if (b.dataset.sceneReset) {
    resetSceneSection(b.dataset.sceneReset);
  } else if (b.hasAttribute("data-scene-fx-open")) {
    sceneDemo.tuneOpen = !sceneDemo.tuneOpen;
    b.setAttribute("aria-expanded", String(sceneDemo.tuneOpen));
    const body = $(b.getAttribute("aria-controls"));
    if (body) body.hidden = !sceneDemo.tuneOpen;
  } else return;
  e.stopPropagation();
  syncSceneDebugUi();
  updateSceneProbes();
  writeStorybookSession();
}

function initSceneComposeDemo() {
  if (!LOM.SceneCompose || !LOM.SceneControls || !$("dev-scene-compose")) return;
  /* Always on in Scéna (disable only with ?compose=0). Parallax comes with it. */
  sceneDemo = {
    on: true,
    shot: "celek",
    shotSel: "celek",
    show: { ...LOM.SceneCompose.DEFAULT_SHOW },
    cast: {},
    weather: "clear",
    placements: {},
    ...sceneFxFactory(),
    tuneOpen: false,
  };
  renderSceneComposeControls();
  for (const host of sceneHosts()) {
    if (host.dataset.sceneBound) continue;
    host.dataset.sceneBound = "1";
    host.addEventListener("change", onSceneComposeChange);
    host.addEventListener("input", onSceneComposeInput);
    host.addEventListener("click", onSceneComposeClick);
  }
  document.addEventListener("lom:scene-metrics", () => {
    updateSceneComposeReadout();
    updateSceneProbes();
    renderSceneHotspots();
  });
  const box = $("origins-box");
  if (box && !box.dataset.sceneBreathBound) {
    box.dataset.sceneBreathBound = "1";
    let breathResume = 0;
    box.addEventListener(
      "scroll",
      () => {
        LOM.SceneView?.pauseBreathForUi?.();
        clearTimeout(breathResume);
        breathResume = setTimeout(() => LOM.SceneView?.resumeBreathForUi?.(), 600);
      },
      true
    );
  }
  LOM.SceneView?.mount?.();
  syncSceneCompose();
}
