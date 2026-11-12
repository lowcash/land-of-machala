/** Jméno hráče: jen jedno slovo (bez mezer / přízvisek); do HTML escapovat. */
function escapeHtml(v) {
  return window.UiKit.esc(v);
}

/* PILGRIM / BASE / RACE_MOD / CLASS_INFO / RACE_INFO: js/data/characters.js */
const { PILGRIM, BASE, RACE_MOD, CLASS_INFO, RACE_INFO } = LOM;
/* nevybrané povolání nebo rasa = neznámý poutník (picks drží výchozí hodnotu jen kvůli datům) */
const pickedClass = () => (state.prologDone.class ? state.picks.class : null);

/** Prolog step nav (side chevrons / swipe / keys). */
function originNavState() {
  const maxReached = Math.max(state.originStep, state.originReached || 0);
  const showNav = maxReached > 0 || state.prologDone.class || state.prologDone.race;
  return {
    showNav,
    canBack: showNav && state.originStep > 0,
    canFwd:
      showNav &&
      (state.originStep < maxReached ||
        (state.originStep === ORIGIN_STEPS.length - 1 && maxReached >= state.originStep)),
    maxReached,
  };
}

function originsCard() {
  return document.querySelector('[data-screen="origins"] .prolog-frame .auth-card');
}

function syncOriginSideNav() {
  const card = originsCard();
  if (!card) return;
  const { showNav, canBack, canFwd } = originNavState();
  card.classList.toggle("has-side-nav", showNav);
  const prev = card.querySelector(":scope > .origin-side-nav.prev");
  const next = card.querySelector(":scope > .origin-side-nav.next");
  [prev, next].forEach((btn) => {
    if (!btn) return;
    btn.hidden = !showNav;
  });
  if (prev) prev.disabled = !canBack;
  if (next) next.disabled = !canFwd;
}

/** Progress dots overlay (outside text flow – no header gap). */
function syncOriginProgress() {
  const el = document.querySelector('[data-screen="origins"] .origin-progress');
  if (!el) return;
  el.innerHTML = `<div class="progress-track">${flowSegsHtml(state.originStep)}</div>`;
}

function goOriginBack() {
  if (state.screen !== "origins") return false;
  if (!originNavState().canBack) return false;
  state.originStep -= 1;
  state.prologShot = null;
  originBackStep = true;
  renderOrigins();
  mirrorLiveToKnobs();
  return true;
}

function goOriginFwd() {
  if (state.screen !== "origins") return false;
  if (state.originStep < ORIGIN_STEPS.length - 1) {
    if (state.originStep >= (state.originReached || 0)) return false;
    state.originStep += 1;
    state.prologShot = null;
    renderOrigins();
    mirrorLiveToKnobs();
    return true;
  }
  if (state.prologDone.origin) {
    afterPrologChoices();
    mirrorLiveToKnobs();
    return true;
  }
  return false;
}

/** Swipe on action box: horizontal = step; vertical only at scroll edge. */
function initPrologStepGestures() {
  const box = $("origins-box");
  if (!box || box.dataset.stepGestures === "1") return;
  box.dataset.stepGestures = "1";
  let tracking = false;
  let startX = 0;
  let startY = 0;
  let startScrollTop = 0;
  let scroller = null;

  const activeScroller = () => {
    const oneScroll =
      window.matchMedia("(max-aspect-ratio: 1/1)").matches ||
      window.matchMedia("(min-aspect-ratio: 1/1) and (max-height: 520px)").matches;
    if (oneScroll) return box.querySelector(".origin-flow-scroll");
    return box.querySelector(".origin-body");
  };

  box.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest?.(".origin-side-nav, .peek-btn, button.choice, a, input, select, textarea")) {
        return;
      }
      const scr = document.querySelector('[data-screen="origins"]');
      if (scr?.classList.contains("is-peek") || scr?.classList.contains("is-peek-expanding")) return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
      scroller = activeScroller();
      startScrollTop = scroller?.scrollTop || 0;
    },
    { passive: true }
  );

  const end = (e) => {
    if (!tracking) return;
    tracking = false;
    if (state.screen !== "origins") return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    /* Touch: higher bar so vertical scroll ≠ accidental step. */
    const thresh = window.matchMedia("(pointer: coarse)").matches ? 72 : 56;
    if (absX >= thresh && absX > absY * 1.35) {
      if (dx > 0) goOriginBack();
      else goOriginFwd();
      return;
    }
    if (absY >= thresh && absY > absX * 1.2 && scroller) {
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const atTop = startScrollTop <= 2;
      const atBottom = startScrollTop >= maxScroll - 2;
      if (dy > 0 && atTop) goOriginBack();
      else if (dy < 0 && atBottom) goOriginFwd();
    }
  };
  box.addEventListener("pointerup", end, { passive: true });
  box.addEventListener("pointercancel", () => {
    tracking = false;
  });
}

/** v3-bohatší 3 beaty; roster zůstává 3×3 (6×6 = later) */
const ORIGIN_STEPS = [
  {
    pick: "class",
    shot: "stand-table" /* camera: who has the player's attention (SCENE_SHOTS id = slot id) */,
    text: "Jsi v krčmě. Dusno od kouře, je cítit pečená cibule a zatuchlina ze starých sudů. Na stole v rohu chrápe pijan a jinak je tu prázdno. Ve vsi se proslýchá, že z kaple zmizel zvon.\nSvatava před tebe postaví korbel: „Platíš hned? Na sekeru mám Karla z kovárny. Co teď vlastně děláš?“",
    /* volba: say = řeč (v uvozovkách), act = gesto (kurzíva), actAfter = gesto až po řeči; použij jen to, co k volbě přirozeně patří */
    choices: [
      { say: "Kácím a chodím po lesích. Mně to stačí.", hint: "dřevorubec", class: "tracker" },
      { act: "Vytáhneš ze záňadří svazek sušených bylin a položíš ho na pult.", hint: "bylinkář", class: "chanter" },
      { say: "Umím číst a psát. Smlouvy čtu i drobným písmem.", hint: "písař", class: "legist" },
      { say: "Já si nic neobjednal.", cheek: true },
    ],
  },
  {
    pick: "race",
    shot: "sit-right",
    lead: {
      tracker: "Svatava jen přikývne a utře pult. Ze zvyku pootočíš hlavu ke dveřím.",
      chanter: "„K pivku se to hodí,“ usměje se Svatava. „Nech to tu.“ Chvíli mlčíš.",
      legist: "Svatava sčítá zářezy na trámu u pultu. Díváš se a nic neříkáš.",
      none: "„Neobjednal,“ zopakuje Svatava. Zvedne korbel a vypije ho do dna, postaví ho prázdný na pult a vůbec ji to nerozhodí.",
    },
    text: "V rohu se pohnou ramena a pijan zvedne hlavu – kouká kamsi vedle tebe.\n„Hej ty. Odkud jsi? A co se u vás pije?“",
    choices: [
      /* znak kraje (pití/jídlo doma) – bez vysvětlení místa; hráč si znaky spojí sám */
      { say: "Tmavé pivo, chleba s kmínem a cibuli k tomu.", hint: "Zdejší", race: "local", bridge: "„To znám,“ řekne pijan a spokojeně si ťukne do korbelu." },
      { say: "Slanou polévku po šichtě.", hint: "Solníci", race: "saltfolk", bridge: "„Z dolů. To je pak žízeň,“ zakašle pijan." },
      { say: "Kyselý kvas.", hint: "Slatiňané", race: "woodfolk", bridge: "„Kvas. To je ze slatí, ne?“ řekne pijan. „Tam prý stezky chodí, kam se jim zachce. Jako já.“" },
      { say: "Víno a pečeného kapra.", hint: "Brodáci", race: "riverfolk", bridge: "„Od vody. Tam prý chlap chytí rybu dřív, než si sundá boty,“ řekne pijan." },
      { say: "Mléko, ještě teplé.", hint: "Pasečané", race: "hillfolk", bridge: "„Mléko. Tam prý ovce ví o zimě dřív než pastýř,“ řekne pijan." },
    ],
  },
  {
    pick: "react",
    /* camera stays on Pijan (slot sit-right); Svatava's slot is hidden from this step on (prologBeat) */
    shot: "sit-right",
    text: "Svatava mezitím odešla do sklepa pro další sud. Chvíli se nic neděje, pak přijde tupá rána. „Čert to vem, herdek, vždyť jsem to tu měla sotva tři dni!“\n„Co zas?“ řekne pijan a opře si hlavu o stůl. Pak se od kaple ozve zvon, jednou. Což je divné, protože žádný tam není. Co uděláš?",
    choices: [
      { say: "Vždyť v kapli žádný zvon není.", act: "Překvapeně vstaneš a vyjdeš ven.", react: "fight", bridge: "Venku mokrá tma a od kaple ticho, jako by tam zvon nikdy nevisel. Vrátíš se dovnitř s prázdnou. Boty máš od bláta." },
      { act: "Neuděláš nic. Počkáš, jestli se to ozve znovu.", react: "hide", bridge: "Chvíli čekáš. Zvon se už neozve." },
      { act: "Sevřeš dřevěný křížek pod košilí.", react: "ward", bridge: "Nic se nestane, a to tě uklidní míň, než čekáš." },
    ],
  },
  {
    pick: "origin",
    shot: "sit-right",
    /* kraj = kultura Machalska; původ = proč jsi tady / jestli tě ve vsi znají */
    text: "Pijan pořád ještě nedotáhl hlavu zpátky na stůl.\n„Jak ses sem vlastně dostal? Sem se chodívá pro pivo.“",
    choices: [
      { say: "Přišel jsem vyrovnat účty.", hint: "dlužník", origin: "debtor" },
      { act: "Ukážeš ruce plné mozolů a spálenin od výhně.", hint: "učeň kováře", origin: "apprentice" },
      { say: "Hlídal jsem bránu. Už ne.", hint: "bývalý strážný", origin: "watchman" },
      { say: "Jen procházím. Zítra zas pokračuju dál.", hint: "poutník", origin: "wayfarer" },
      { act: "Stáhneš si kapuci hlouběji.", origin: "exile" },
      /* jen u kraje Zdejší; ve shrnutí Postavy se „Rodák“ neukazuje (plyne z kraje) */
      { say: "Bydlím tu. Přišel jsem na pivo.", origin: "native" },
    ],
  },
];

/** Původ v prologu podle kraje: Zdejší ⇒ ne poutník; Rodák jen u Zdejších. */
function originChoiceAllowed(c) {
  if (!c?.origin) return true;
  const race = state.picks.race;
  if (c.origin === "native") return race === "local";
  if (c.origin === "wayfarer" && race === "local") return false;
  return true;
}


/**
 * České typo: nezalamovat jednopísmenné / krátké předložky a spojky
 * (a, i, k, o, s, u, v, z, na, do, …) - orphan prevention.
 * HTML tagy nechá být (pracuje po segmentech mimo <>).
 */
function nbspCzech(input, opts = {}) {
  if (!input || typeof input !== "string") return input;
  if (opts.tail) input = input.replace(/ ([^ <>]+)$/, "\u00A0$1"); /* poslední slovo nikdy samo na řádku */
  /* krátká slova (předložky, spojky, "se", "je"...) se vážou k NÁSLEDUJÍCÍMU slovu: nikdy nezůstanou na konci řádku */
  const short =
    "a|i|k|o|s|u|v|z|na|ke|ve|do|od|po|za|se|si|by|že|až|či|už|co|to|tu|ze|ani|ale|jak|jen|pro|bez|pod|nad|při|nebo|je|jsi|jsem|mu|ho|ti|mi|tě|ať|já|my|ty|on|ona|jde|má";
  const re = new RegExp(`(?<=^|[\\s\\u00A0>])(${short}) (?=\\S)`, "gi");
  const fix = (text) => text.replace(re, "$1\u00A0");
  return input.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, text) => (tag ? tag : fix(text)));
}

/* pozadí scény jsou pečené prolog záběry níže (assets/runtime/locations/tavern/) */
const BG_DIR = "../assets/runtime/locations/";
const BG = {};
/* Jediné místo prologu (dev Místo, pozadí); ostatní místa nejsou součástí tohoto repozitáře. */
const PLACE = { tavern: { title: "Hostinec U Přívozu", bg: "tavern" } };
/* Prolog: pečené záběry (fotorealismus, jediný styl) × S1/S2 × fáze (světlo v obraze → sky bake); afternoon → evening. */
const PROLOG_BAKE_PHASES = ["morning", "noon", "evening", "night"];
const DEFAULT_PROLOG_STYLE = "photoreal";
const BG_BAKE = new Set();
/* photoreal: upscalované varianty `prolog-<shot>-<ph>-16x9-<šířka>.<ext>` (assets/pipelines/layers/upscale.py, tabulka WEB); BG_WEB drží základ cesty */
const PROLOG_WEB = { avif: [720, 1280], webp: [1280], jpeg: [1280] };
/** Largest prolog camera zoom (PROLOG_CAMERA); the bake width is chosen so this zoom is still sharp. */
const PROLOG_DETAIL_ZOOM = 2;
const BG_WEB = {};
/** CSS `image-set()` s `type()` (výběr AVIF → WebP → JPEG prohlížečem); starší prohlížeč dostane jen JPEG. */
const IMAGE_SET_TYPE =
  typeof CSS !== "undefined" && CSS.supports?.("background-image", 'image-set(url("a.avif") type("image/avif"))');
const MIME = { avif: "image/avif", webp: "image/webp", jpeg: "image/jpeg" };
/** Šířka souboru podle okna: nejmenší ≥ potřeba (cover → delší strana 16:9), jinak největší. */
function bakeWidth(widths) {
  /* Before layout (0×0) never pick the smallest tier – that locked a 720px bake and looked like heavy JPEG/upscale mush. */
  const vw = window.visualViewport?.width || window.innerWidth || 0;
  const vh = window.visualViewport?.height || window.innerHeight || 0;
  if (!(vw > 0 && vh > 0)) return widths[widths.length - 1];
  /* The camera zooms the picture (PROLOG_DETAIL_ZOOM): pick the width that stays sharp at that zoom. */
  const need = Math.max(vw, (vh * 16) / 9) * Math.min(window.devicePixelRatio || 1, 3) * PROLOG_DETAIL_ZOOM;
  return widths.find((w) => w >= need * 0.9) || widths[widths.length - 1];
}
/** Hodnota `background-image` pro klíč pozadí; photoreal prolog = image-set podle šířky okna. */
function bgImageValue(key) {
  const base = BG_WEB[key];
  if (!base || !IMAGE_SET_TYPE) return `url("${BG[key] || BG.default}")`;
  const set = Object.entries(PROLOG_WEB).map(([ext, ws]) => `url("${base}-${bakeWidth(ws)}.${ext}") type("${MIME[ext]}")`);
  return `image-set(${set.join(", ")})`;
}

/** Concrete file URLs for bake decode (same order as image-set: AVIF → WebP → JPEG). */
function bakeCandidateUrls(key) {
  const base = BG_WEB[key];
  if (!base) {
    const u = BG[key] || BG.default;
    return u ? [u] : [];
  }
  if (!IMAGE_SET_TYPE) return [`${base}-${bakeWidth(PROLOG_WEB.jpeg)}.jpeg`];
  return Object.entries(PROLOG_WEB).map(([ext, ws]) => `${base}-${bakeWidth(ws)}.${ext}`);
}

const BAKE_DECODE_MS = 1200;
const bakeDecodeCache = new Map();
let bakeApplyGen = 0;

/** Warm HTTP + decode cache so CSS background-image swap does not flash empty. */
function decodeBakeUrl(url) {
  let p = bakeDecodeCache.get(url);
  if (p) return p;
  p = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    let settled = false;
    const ok = () => {
      if (settled) return;
      settled = true;
      if (typeof img.decode === "function") {
        img.decode().then(
          () => resolve(url),
          () => resolve(url)
        );
      } else resolve(url);
    };
    img.onload = ok;
    img.onerror = () => {
      bakeDecodeCache.delete(url);
      reject(new Error("bake decode failed"));
    };
    img.src = url;
    if (img.complete && img.naturalWidth) ok();
  });
  bakeDecodeCache.set(url, p);
  return p;
}

/**
 * Resolve when at least one bake candidate is decoded (or timeout / miss).
 * timeoutMs 0 = wait until load finishes (prefetch).
 */
async function ensureBakeReady(key, { timeoutMs = BAKE_DECODE_MS } = {}) {
  if (!key || !BG_BAKE.has(key)) return true;
  const urls = bakeCandidateUrls(key);
  if (!urls.length) return true;
  const load = (async () => {
    for (const url of urls) {
      try {
        await decodeBakeUrl(url);
        return true;
      } catch (_) {
        /* try next format */
      }
    }
    return false;
  })();
  if (!timeoutMs) return load;
  const result = await Promise.race([
    load,
    new Promise((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
  ]);
  return result === true;
}

/** Prefetch other phases, other shot, and next origin-step shot (deduped via cache). */
function prefetchBakeNeighbors(key) {
  if (!key || !BG_BAKE.has(key)) return;
  const m = /^tavern-prolog-([^-]+)-(s[12])-(morning|noon|evening|night)(?:-(overcast|rain|fog))?$/.exec(key);
  if (!m) return;
  const [, style, shot, phase, wx] = m;
  const sfx = wx ? `-${wx}` : "";
  const otherShot = shot === "s1" ? "s2" : "s1";
  const keys = new Set();
  for (const ph of PROLOG_BAKE_PHASES) {
    if (ph !== phase) keys.add(`tavern-prolog-${style}-${shot}-${ph}${sfx}`);
  }
  keys.add(`tavern-prolog-${style}-${otherShot}-${phase}${sfx}`);
  if (state.screen === "origins") {
    const next = ORIGIN_STEPS[state.originStep + 1];
    if (next) {
      const nextShot = next.pick === "class" ? "s1" : "s2";
      keys.add(`tavern-prolog-${style}-${nextShot}-${phase}${sfx}`);
    }
  }
  keys.forEach((k) => {
    if (BG_BAKE.has(k)) void ensureBakeReady(k, { timeoutMs: 0 });
  });
}

/** Verze prototyupu - bump při smysluplném releasu; © rok = aktuální. */
const APP_VERSION = "0.1.1";
const APP_YEAR = new Date().getFullYear();

const makeState = () => ({
  screen: "origins",
  originStep: 0,
  /** Soft storybook override for bake shot ("s1"|"s2"); null = derive from originStep. */
  prologShot: null,
  picks: { class: "tracker", race: "local", origin: null },
  name: "",
  gender: "m", /* m | f; pozdější skloňování */
  literacy: 0, /* 0 neumí / 1 slabě / 2 plynně (písař start 2) */
  log: "",
  guest: false,
  originReached: 0,
  prologDone: { class: false, race: false, origin: false },
  prologBridges: {} /* krok prologu → věta, kterou navazuje další krok */,
  prologStory: false,
  prologReact: null,
  prologReply: null,
  prologCheek: 0 /* kolikrát hráč v prologu odseknul; zatím jen počítadlo drzosti */,
  /* herní doba jen pro pečený záběr prologu (js/systems/clock.js) */
  clock: LOM.newClock(),
  seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0,
  /* dev přepínače (viz LOM.TOGGLES) */
  dev: {},
  activeScenario: null,
});
const state = makeState();

/** Prozatím: po 4 krocích prologu konec ukázky (bez obrazovky Postava). Veřejný export přepíná PUBLIC_DEMO v js/ui/devbar.js. */
const DEMO_END_AFTER_PROLOG = true;
const FLOW_SEGS = DEMO_END_AFTER_PROLOG ? ORIGIN_STEPS.length : ORIGIN_STEPS.length + 1; /* +1 = Původ, když není jen ukázka */

function flowSegsHtml(activeIdx) {
  return Array.from({ length: FLOW_SEGS }, (_, i) => {
    const cls = `progress-seg${i === activeIdx ? " active" : ""}${i < activeIdx ? " done" : ""}`;
    return `<span class="${cls}" aria-hidden="true"></span>`;
  }).join("");
}

function $(id) {
  return document.getElementById(id);
}

/** DEV panel je plovoucí overlay – neukrajuje layout (--dev-pad = 0). */
function syncDevPad() {
  document.documentElement.style.setProperty("--dev-pad", "0px");
}

/** Filled by initDevBar – keeps floating bar inside the visual viewport (anywhere on screen). */
let clampDevBar = () => {};

/**
 * Keep --vvh/--vvw in sync with the *visual* viewport.
 * Fixed shells sized to layout/dvh get their bottom cropped when the mobile URL bar shows.
 */
function syncVisualViewportVars() {
  const vv = window.visualViewport;
  const w = vv ? vv.width : window.innerWidth;
  const h = vv ? vv.height : window.innerHeight;
  const top = vv ? vv.offsetTop : 0;
  const left = vv ? vv.offsetLeft : 0;
  const root = document.documentElement;
  root.style.setProperty("--vvw", `${w}px`);
  root.style.setProperty("--vvh", `${h}px`);
  root.style.setProperty("--vv-top", `${top}px`);
  root.style.setProperty("--vv-left", `${left}px`);
}

function initVisualViewportVars() {
  syncVisualViewportVars();
  window.addEventListener("resize", syncVisualViewportVars);
  /* iOS PWA landscape: vv / safe-area settle in waves after rotate. */
  const resyncVv = () => {
    syncVisualViewportVars();
    [50, 150, 350, 600].forEach((ms) => setTimeout(syncVisualViewportVars, ms));
  };
  window.addEventListener("orientationchange", resyncVv);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncVisualViewportVars);
    window.visualViewport.addEventListener("scroll", syncVisualViewportVars);
  }
}

/**
 * Prolog camera: zoom + pan the bake (bg transform = the same channel as peek / storybook shots, so the
 * scene compositor's parallax follows it) toward whoever has the player's attention. The pan is clamped
 * so the zoomed element always covers its box: no empty strip, whatever the viewport.
 */
/* Framing per attention target (image-space focus 0..1, zoom ≥ 1). Self-contained: the public build has no scene compositor. */
const PROLOG_CAMERA = {
  celek: { id: "celek", focus: { x: 0.5, y: 0.48 }, zoom: 1, ease: 0.75 },
  "stand-table": { id: "stand-table", focus: { x: 0.42, y: 0.4 }, zoom: 1.6, ease: 0.8 },
  "sit-right": { id: "sit-right", focus: { x: 0.86, y: 0.42 }, zoom: 1.9, ease: 0.8 },
};
/** Storybook: poslední knob Místo (prolog ho bere). */
let storyPlaceId = "tavern";

/** place id (knob) → klíč v BG / PLACE.bg */
function bgKeyFromPlaceId(placeId) {
  if (placeId && PLACE[placeId]?.bg) return PLACE[placeId].bg;
  if (placeId && BG[placeId]) return placeId;
  return "tavern";
}

/** out = nebe/slunce; in = interiér (světlo místnosti); tavern = okno + světlo; bake = pečený render (bez CSS tónu) */
function skyKindForBg(bgKey) {
  if (BG_BAKE.has(bgKey)) return "bake";
  if (bgKey === "tavern") return "tavern";
  const indoor = new Set(["smith", "healer", "townhall", "senik", "nocleh", "chalupa", "zastava"]);
  return indoor.has(bgKey) ? "in" : "out";
}

/**
 * Crossfade bake (and other BG) – CSS cannot interpolate background-image.
 * Overlay holds the outgoing frame; base gets the next; overlay fades out.
 */
function crossfadeLandingBg(el, nextImage, { force = false, durationMs = SCENE_FADE_MS } = {}) {
  const cs = getComputedStyle(el);
  const prev = el.style.backgroundImage || cs.backgroundImage || "";
  /* Peek i klasický režim: stejný crossfade (pan/zoom zůstane na elementu). */
  if (force || peekReduceMotion() || !prev || prev === "none" || prev === nextImage) {
    el.querySelectorAll(".bg-crossfade").forEach((n) => n.remove());
    el.style.backgroundImage = nextImage;
    return;
  }
  let overlay = el.querySelector(":scope > .bg-crossfade");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "bg-crossfade";
    overlay.setAttribute("aria-hidden", "true");
    el.appendChild(overlay);
  }
  overlay.style.backgroundImage = prev;
  overlay.style.backgroundSize = el.style.backgroundSize || cs.backgroundSize;
  overlay.style.backgroundPosition = el.style.backgroundPosition || cs.backgroundPosition;
  overlay.style.backgroundRepeat = el.style.backgroundRepeat || cs.backgroundRepeat;
  overlay.style.transition = "none";
  overlay.style.opacity = "1";
  overlay.classList.remove("is-out");
  el.style.backgroundImage = nextImage;
  void overlay.offsetWidth;
  overlay.style.transition = `opacity ${durationMs}ms ease`;
  overlay.classList.add("is-out");
  overlay.style.opacity = "0";
  const done = (e) => {
    if (e && e.target !== overlay) return;
    if (e && e.propertyName && e.propertyName !== "opacity") return;
    overlay.removeEventListener("transitionend", done);
    overlay.remove();
  };
  overlay.addEventListener("transitionend", done);
  setTimeout(() => done(), durationMs + 80);
}

/** Daypart switch (same shot, other time of day): a slower cross-fade so the light change reads as a fade, not a cut. */
const DAYPART_FADE_MS = 750;
/** Time of day of a prolog bake key (…-s1-evening-overcast → "evening"), or null. */
function bakePhaseOfKey(key) {
  const parts = String(key || "").split("-");
  return PROLOG_BAKE_PHASES.find((p) => parts.includes(p)) || null;
}

function applyBgToEls(els, key) {
  /* null / "" = záměrně bez pozadí (předvolba bez pečeného bake) */
  if (!key) {
    bakeApplyGen += 1;
    els.forEach((el) => {
      el.dataset.bg = "";
      el.dataset.sky = "none";
      el.querySelectorAll(".bg-crossfade").forEach((n) => n.remove());
      el.style.backgroundImage = "none";
      el.style.backgroundColor = "#140e0c";
    });
    return;
  }
  const img = bgImageValue(key);
  const sky = skyKindForBg(key);
  const shade =
    sky === "bake"
      ? null
      : sky === "out"
        ? `linear-gradient(180deg, rgba(8,12,28,0.2) 0%, transparent 42%), linear-gradient(90deg, rgba(10,6,4,0.48), rgba(10,6,4,0.08) 48%, rgba(10,6,4,0.42))`
        : `linear-gradient(90deg, rgba(18,10,6,0.45), rgba(18,10,6,0.12) 42%, rgba(18,10,6,0.4))`;
  const nextImage = shade ? `${shade}, ${img}` : img;
  /* Snapshot soft vs hard before any await; keep previous paint until decode. */
  const token = ++bakeApplyGen;
  /* Crossfade only on a scene or time-of-day change; another shot of the same scene is a cut under the camera tween. */
  const plan = els.map((el) => {
    const soft = sky === "bake" && !!el.dataset.bg && el.dataset.bg !== key && LOM.PrologCamera.prologNeedsSceneFade(el.dataset.bg, key);
    return { el, soft, daypart: soft && bakePhaseOfKey(el.dataset.bg) !== bakePhaseOfKey(key) };
  });
  const paint = () => {
    if (token !== bakeApplyGen) return;
    plan.forEach(({ el, soft, daypart }) => {
      el.dataset.bg = key;
      el.dataset.sky = sky;
      el.style.backgroundColor = "";
      if (soft) crossfadeLandingBg(el, nextImage, { durationMs: daypart ? DAYPART_FADE_MS : SCENE_FADE_MS });
      else {
        el.querySelectorAll(".bg-crossfade").forEach((n) => n.remove());
        el.style.backgroundImage = nextImage;
      }
    });
    if (sky === "bake") prefetchBakeNeighbors(key);
  };
  if (sky !== "bake") {
    paint();
    return;
  }
  ensureBakeReady(key).then(paint, paint);
}

/** Prozatím: pečené pozadí jen u prologu (S1/S2). */
const BG_ONLY_PROLOG = true;


/** Fáze pro pečený prolog (afternoon nemá bake → evening). */
function prologBakePhase() {
  const ph = LOM.phaseOf?.(state.clock)?.id || "evening";
  if (ph === "afternoon") return "evening";
  return PROLOG_BAKE_PHASES.includes(ph) ? ph : "evening";
}
/** Bake shot: soft knob override, else from prolog progress (class step = S1). */
function prologShotId() {
  if (state.prologShot === "s1" || state.prologShot === "s2") return state.prologShot;
  const step = ORIGIN_STEPS[state.originStep];
  return step?.pick === "class" ? "s1" : "s2";
}

/**
 * Step → scene visibility (deterministic from the current step only).
 * All four prolog beats keep the tavern plate; Svatava leaving is a cast hide, not a blackout.
 */
function prologSceneVisibleForStep(stepIndex = state.originStep) {
  const pick = (ORIGIN_STEPS[stepIndex] || {}).pick;
  return !!(LOM.PrologScene && LOM.PrologScene.visibleForPick(pick));
}

/** Eye control only while a bake/scene is on for this step. */
function syncPeekButtonForStep() {
  const btn = document.querySelector(".peek-btn");
  if (!btn) return;
  const show = state.screen === "origins" && prologSceneVisibleForStep(state.originStep);
  btn.hidden = !show;
  if (!show && typeof isOriginsPeeking === "function" && isOriginsPeeking()) {
    exitPeekMode();
    setPeekButtonState(btn, false);
  }
}

/**
 * Prolog / Postava: pečená krčma S1/S2 × doba. Storybook: jen `tavern`; jiné místo → bez pozadí.
 * Visibility follows the current step only (no stale soft shot / boot flash).
 */
function prologBgKey() {
  if (!prologSceneVisibleForStep(state.originStep)) return null;
  const place = state.activeScenario ? storyPlaceId : "tavern";
  if (place !== "tavern") return null;
  const key = `tavern-prolog-${DEFAULT_PROLOG_STYLE}-${prologShotId()}-${prologBakePhase()}`;
  // denní počasí jen s hotovým finálem (PROLOG_WEATHER_FINALS); jinak jasná sada (okno skládá scene-compose)
  return pickPrologWeatherKey(key, PROLOG_WEATHER ? weatherNow().kind : "clear", PROLOG_WEATHER_FINALS, PROLOG_WEATHER);
}
/**
 * Pick prolog bake key for a weather kind. Missing final → clear base key.
 * Contract mirrored in 2d/js/test/prolog-weather-selection.test.js.
 */
function pickPrologWeatherKey(baseKey, kind, finals, enabled) {
  if (!enabled || !baseKey) return baseKey;
  if (!kind || kind === "clear") return baseKey;
  const wk = `${baseKey}-${kind}`;
  return finals && finals.has(wk) ? wk : baseKey;
}
/** Počasí dne ze semínka (js/systems/weather.js, docs/reference/weather.md). */
function weatherNow() {
  return LOM.Weather.weatherFor(state.seed, state.clock.day);
}
/* Počasí v obraze prologu (okno: zataženo, déšť, mlha, sníh). Finály pozadí chybí → prolog padá na jasno. */
const PROLOG_WEATHER = true;
/* Klíče finálních obrazů počasí prologu na disku (prolog-<shot>-<ph>-<počasí>-16x9). Zatím žádné. */
const PROLOG_WEATHER_FINALS = new Set();
/** Částice (js/systems/particles.js): kontext podle záběru, doby a počasí; jen u fotorealistického stylu. */
function syncParticles(composeParticles) {
  const base = {
    on: true, // jediný styl: fotorealismus
    phase: prologBakePhase(),
    shot: prologShotId(),
    weather: "clear", // déšť a mlha jen v okně obrazu počasí (composeParticles), nikdy v místnosti
    flames: undefined /* per-object flames only while composing (setContext merges, so clear them) */,
  };
  if (composeParticles) {
    base.phase = composeParticles.phase || base.phase;
    base.shot = composeParticles.shot || base.shot;
    base.candleFlame = composeParticles.candleFlame;
    base.candleSmoke = composeParticles.candleSmoke;
    base.fireSparks = composeParticles.fireSparks;
    base.flames = composeParticles.flames;
    base.weather = composeParticles.weather || "clear"; // only with the window picture of that weather (plan)
  }
  LOM.ParticlesView?.setContext(base);
}
function setPrologBg() {
  applyBgToEls(
    [...document.querySelectorAll('[data-screen="origins"] .landing-bg')],
    prologBgKey()
  );
  syncPhaseLook();
  if (sceneDemo?.on && LOM.SceneView?.enabled) {
    if (prologSceneVisibleForStep(state.originStep)) syncSceneCompose();
    else {
      if (typeof sceneSceneKey !== "undefined") sceneSceneKey = "";
      LOM.SceneView.unmount();
      syncParticles();
    }
  } else syncParticles();
  syncPeekButtonForStep();
}
/**
 * Snapshot ::before / ::after sky tones into real overlays, then swap data-phase and fade the overlays out.
 * CSS cannot interpolate pseudo backgrounds; this matches DAYPART_FADE_MS of the bake cross-fade.
 */
function crossfadeSkyPhase(el, nextPhase) {
  const prev = el.dataset.phase;
  if (prev === nextPhase) return;
  const sky = el.dataset.sky;
  if (!prev || !sky || sky === "bake" || sky === "none" || peekReduceMotion()) {
    el.dataset.phase = nextPhase;
    return;
  }
  el.querySelectorAll(":scope > .sky-crossfade").forEach((n) => n.remove());
  const layers = ["::before", "::after"];
  const overlays = [];
  for (const pseudo of layers) {
    let cs;
    try {
      cs = getComputedStyle(el, pseudo);
    } catch (_) {
      continue;
    }
    if (!cs || cs.content === "none") continue;
    const bg = cs.backgroundImage;
    const bgc = cs.backgroundColor;
    if ((!bg || bg === "none") && (!bgc || bgc === "rgba(0, 0, 0, 0)" || bgc === "transparent")) continue;
    const overlay = document.createElement("div");
    overlay.className = "sky-crossfade";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.position = "absolute";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = pseudo === "::before" ? "1" : "2";
    overlay.style.left = cs.left;
    overlay.style.right = cs.right;
    overlay.style.top = cs.top;
    overlay.style.bottom = cs.bottom;
    overlay.style.width = cs.width;
    overlay.style.height = cs.height;
    overlay.style.borderRadius = cs.borderRadius;
    overlay.style.background = cs.background;
    overlay.style.backgroundImage = cs.backgroundImage;
    overlay.style.backgroundColor = cs.backgroundColor;
    overlay.style.boxShadow = cs.boxShadow;
    overlay.style.opacity = "1";
    overlay.style.transition = "none";
    el.appendChild(overlay);
    overlays.push(overlay);
  }
  el.dataset.phase = nextPhase;
  if (!overlays.length) return;
  void el.offsetWidth;
  overlays.forEach((overlay) => {
    overlay.style.transition = `opacity ${DAYPART_FADE_MS}ms ease`;
    overlay.style.opacity = "0";
    const done = (e) => {
      if (e && e.target !== overlay) return;
      if (e && e.propertyName && e.propertyName !== "opacity") return;
      overlay.removeEventListener("transitionend", done);
      overlay.remove();
    };
    overlay.addEventListener("transitionend", done);
    setTimeout(() => done(), DAYPART_FADE_MS + 80);
  });
}

/** Fáze dne: data-phase + CSS vrstvy (nebe/světlo), ne jen filter ([faze-dne-vizual]). */
function syncPhaseLook() {
  const ph = LOM.phaseOf?.(state.clock)?.id || "afternoon";
  document.body.dataset.phase = ph;
  document.querySelectorAll(".landing-bg").forEach((el) => {
    crossfadeSkyPhase(el, ph);
  });
}

/**
 * Storybook: open relevant Detail sections. Only from preset dropdown / chrome ↺ –
 * never on refresh, knob tweak, or applyScenario (session sections are source of truth).
 * Legacy "svet" also opens cas + world (Čas / Obraz / Místo hierarchy).
 */
function focusDevForScenario(secs = []) {
  const bar = document.querySelector(".storybook-bar");
  if (!bar || bar.hidden || !secs.length) return;
  const openIds = new Set(secs);
  if (openIds.has("svet")) {
    openIds.add("cas");
    openIds.add("world");
  }
  const prefs = loadDevBarPrefs();
  bar.querySelectorAll("details.dev-sec[data-sec]").forEach((el) => {
    const id = el.dataset.sec;
    if (!openIds.has(id)) return; /* leave user-closed / user-open alone */
    el.open = true;
    prefs.sections[id] = true;
  });
  saveDevBarPrefs(prefs);
}

/** Which Detail sections the current screen wants when user picks a preset / ↺. */
function focusDevForCurrentScreen() {
  if (state.screen === "origins") focusDevForScenario(["svet"]);
}

function closeStartModal() {
  $("start-modal")?.classList.add("hidden");
}

function ensureStartModal() {
  let el = $("start-modal");
  if (el) return el;
  el = document.createElement("aside");
  el.id = "start-modal";
  el.className = "modal-overlay hidden";
  el.setAttribute("role", "dialog");
  el.addEventListener("click", (e) => {
    if (e.target === el) closeStartModal();
  });
  document.body.appendChild(el);
  return el;
}

/** Konec ukázky po 4 krocích prologu (bez Postavy): demo + znovu. */
function openDemoPrologEndModal() {
  const el = ensureStartModal();
  el.setAttribute("aria-label", "Ukázková verze");
  /* no chrome header: centred text only (modal-centred) */
  el.innerHTML = `<div class="modal-sheet confirm-sheet modal-centred">
      <p>${nbspCzech("Toto je ukázková verze, další část je ve vývoji. Prolog si můžeš projít znovu.", { tail: true })}</p>
      <div class="modal-actions confirm-actions">
        <button type="button" class="btn btn-primary" data-act="demo-restart">Projít prolog znovu</button>
      </div>
    </div>`;
  el.classList.remove("hidden");
  el.querySelector("[data-act=demo-restart]")?.focus();
}

/** Po poslední volbě prologu: konec ukázky (další část hry tu není). */
function afterPrologChoices() {
  openDemoPrologEndModal();
}

/**
 * Toast = drobné potvrzení / chyba (důležité události příběhu jdou do logu přes logSys).
 * Doba = clamp(3500, 45 ms × znaků, 9000); hover/touch = pauza; klik / × = zavřít; max 3 najednou.
 * On origins: host sits inside .origins-stage (letterbox/pillarbox – not in the bars).
 * Elsewhere: reparent to body. Dev bar stays free over the full visual viewport.
 */
const TOAST_MAX = 3;
const toastMs = (text) => Math.min(9000, Math.max(3500, Math.round(String(text).length * 45)));

function placeToastHost() {
  const host = $("toast-host");
  if (!host) return;
  const stage = document.querySelector('[data-screen="origins"]:not(.hidden) .origins-stage');
  const target = stage || document.body;
  if (host.parentElement !== target) target.appendChild(host);
  host.classList.toggle("in-stage", !!stage);
}

function attachToast(el, ms) {
  placeToastHost();
  const host = $("toast-host") || document.body;
  if (ms == null) ms = toastMs(el.textContent);
  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    if (el.classList.contains("leaving")) return;
    el.classList.add("leaving");
    el.classList.remove("show");
    setTimeout(() => el.remove(), 240);
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(dismiss, ms);
  };
  el.setAttribute("role", "status");
  const x = document.createElement("button");
  x.type = "button";
  x.className = "toast-dismiss";
  x.setAttribute("aria-label", "Zavřít");
  x.textContent = "×";
  x.addEventListener("click", (e) => {
    e.stopPropagation();
    dismiss();
  });
  el.appendChild(x);
  el.addEventListener("click", dismiss);
  el.addEventListener("pointerenter", () => clearTimeout(timer));
  el.addEventListener("pointerleave", arm);
  /* nejstarší pryč, ať se jich nehromadí víc než TOAST_MAX */
  const live = [...host.querySelectorAll(".toast:not(.leaving)")];
  while (live.length >= TOAST_MAX) live.shift()._dismiss();
  el._dismiss = dismiss;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  arm();
}

function toast(msg, ms) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  attachToast(el, ms);
}

/* Calm Czech notices for a refused session or login; `reason` is the server's machine-readable value (auth.js), never token data. */
const ACCESS_NOTICE = {
  suspended: "Přístup je pozastaven. Obraťte se na hostitele hry.",
  revoked: "Tento odkaz už neplatí.",
  expired: "Platnost odkazu vypršela.",
};
function accessNotice(reason) {
  const msg = ACCESS_NOTICE[reason];
  if (msg) toast(msg, 9000);
}

/** Scroll lane / panel - klíč = stav; jiný stav = nahoře, stejný = pamatovat */
const laneScrollMem = {};
let laneScrollKey = null;

function clearUiScrollMem() {
  Object.keys(laneScrollMem).forEach((k) => delete laneScrollMem[k]);
  laneScrollKey = null;
}

function setScreen(name) {
  const arriving = state.screen !== name;
  if (arriving) {
    /* A tip anchored on the view we leave must not stay on screen. */
    if (typeof hideFloatTip === "function") hideFloatTip();
    lastOriginStep = -1;
    lastRevealed = "";
    clearUiScrollMem();
    if (name === "origins") {
      /* peek se nepřenáší do dalšího vstupu; applyScenario / boot-peek obnoví ukázku */
      if (!document.documentElement.classList.contains("boot-peek")) {
        exitPeekMode();
        setPeekButtonState(document.querySelector(".peek-btn"), false);
      }
    }
  }
  state.screen = name;
  document.querySelectorAll("[data-screen]").forEach((el) => {
    el.classList.toggle("hidden", el.getAttribute("data-screen") !== name);
  });
  placeToastHost();
  /* Před prvním paintem origins: boot-peek už skrývá melt (inline script + CSS). */
  if (name === "origins" && document.documentElement.classList.contains("boot-peek")) {
    document.querySelector('[data-screen="origins"]')?.classList.add("is-peek");
  }
  document.querySelectorAll(".dev-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.goto === name));
  if (name === "origins") setPrologBg();
  render();
  if (name === "origins") {
    requestAnimationFrame(() => {
      clampDevBar();
      window.dispatchEvent(new Event("resize"));
    });
  }
}

/** CSS `word-in` duration – keep in sync with styles.css `.w` animation. */
const REVEAL_WORD_MS = 320;

/**
 * Náběh textu: slova postupně (fade). Kodexová hesla (`abbr.kodex`) naběhnou ve stejném
 * pořadí jako okolní text (ne dřív než dojde řada na ně). `prefers-reduced-motion` vypne.
 * @returns {number} ms when the last word finishes (delay + stagger + word anim).
 */
function revealText(el, { step = 26, max = 1100, delay = 0 } = {}) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return delay;
  const ops = [];
  const collect = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.matches?.("abbr.kodex")) {
        ops.push({ kind: "kodex", el: node });
        return;
      }
      [...node.childNodes].forEach(collect);
      return;
    }
    if (node.nodeType === Node.TEXT_NODE && /[\S]/.test(node.nodeValue || "")) ops.push({ kind: "text", node });
  };
  [...el.childNodes].forEach(collect);
  let total = 0;
  for (const op of ops) {
    total += op.kind === "kodex" ? 1 : op.node.nodeValue.split(/[ \t\n]+/).filter(Boolean).length;
  }
  if (!total) return delay;
  const per = Math.min(step, max / Math.max(total, 1));
  let i = 0;
  for (const op of ops) {
    if (op.kind === "kodex") {
      op.el.classList.add("w");
      op.el.style.setProperty("--d", `${delay + Math.round(i++ * per)}ms`);
      continue;
    }
    const frag = document.createDocumentFragment();
    for (const part of op.node.nodeValue.split(/([ \t\n]+)/)) {
      if (!part) continue;
      if (/^[ \t\n]+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
        continue;
      }
      const w = document.createElement("span");
      w.className = "w";
      w.style.setProperty("--d", `${delay + Math.round(i++ * per)}ms`);
      w.textContent = part;
      frag.appendChild(w);
    }
    op.node.replaceWith(frag);
  }
  return delay + Math.round((total - 1) * per) + REVEAL_WORD_MS;
}

let lastRevealed = "";

function choiceIsPicked(choice) {
  if (choice.cheek) return !state.prologDone.class && (state.prologCheek || 0) > 0;
  if (choice.class) return state.prologDone.class && state.picks.class === choice.class;
  if (choice.race) return state.prologDone.race && state.picks.race === choice.race;
  if (choice.origin) return state.prologDone.origin && state.picks.origin === choice.origin;
  if (choice.react) return state.prologReact === choice.react;
  return false;
}

/**
 * Okraj scrollu → fade (nahoru / dolů).
 * opts.topEl / bottomEl = samostatné překryvy (Postava: pod sticky Kraj/Živnost);
 * opts.mask = true → i při overlays nastav fade-top/bottom (prolog: CSS overlay
 *   gradients on clip/flow; classes drive opacity – šipky mimo).
 * bez overlays: třídy fade-top / fade-bottom na el.
 *
 * Overflow check uses content box (ignores padding) so leftover pad cannot
 * flash ▴▾ when the text already fits.
 */
function scrollContentNeedsOverflow(el) {
  const style = getComputedStyle(el);
  const padT = parseFloat(style.paddingTop) || 0;
  const padB = parseFloat(style.paddingBottom) || 0;
  const contentBox = el.clientHeight - padT - padB;
  const contentSize = el.scrollHeight - padT - padB;
  return contentSize > contentBox + 1;
}

/** Per-step scroll-fade flags for revisited prolog steps (sync on mount, no grow-in). */
const prologFadeByStep = Object.create(null);

function bindScrollFade(el, opts = {}) {
  if (!el) return;
  const topEl = opts.topEl || null;
  const bottomEl = opts.bottomEl || null;
  const useOverlay = !!(topEl || bottomEl);
  const cacheKey = opts.cacheKey;
  const snap = !!opts.snap;
  if (snap) el.classList.add("fade-snap");
  const update = () => {
    const needsScroll = scrollContentNeedsOverflow(el);
    /* While boot-settling or a pending restore, keep scrollTop even if layout has not measured overflow yet. */
    if (
      !needsScroll &&
      el.scrollTop &&
      !BootHold.skipEntrance(document.documentElement) &&
      !pendingPrologScroll
    ) {
      el.scrollTop = 0;
    }
    const canUp = needsScroll && el.scrollTop > 2;
    const canDown = needsScroll && el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    if (useOverlay) {
      topEl?.classList.toggle("is-on", canUp);
      bottomEl?.classList.toggle("is-on", canDown);
    }
    if (!useOverlay || opts.mask) {
      el.classList.toggle("fade-top", canUp);
      el.classList.toggle("fade-bottom", canDown);
    }
    if (cacheKey != null) {
      prologFadeByStep[cacheKey] = { top: canUp, bottom: canDown };
    }
  };
  /* Revisited step: apply cached fade classes before first paint so --pf/--fade do not animate from 0. */
  if (snap && cacheKey != null && prologFadeByStep[cacheKey]) {
    const c = prologFadeByStep[cacheKey];
    if (!useOverlay || opts.mask) {
      el.classList.toggle("fade-top", !!c.top);
      el.classList.toggle("fade-bottom", !!c.bottom);
    }
    if (useOverlay) {
      topEl?.classList.toggle("is-on", !!c.top);
      bottomEl?.classList.toggle("is-on", !!c.bottom);
    }
  }
  if (!el.dataset.fade) {
    el.dataset.fade = "1";
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener(
      "scroll",
      () => {
        if (prologSessionReady) scheduleSavePrologScroll();
      },
      { passive: true }
    );
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => update());
      ro.observe(el);
      el._scrollFadeRo = ro;
    }
  }
  update();
  if (snap) {
    /* Drop fade-snap after two frames so later user scrolls can ease again. */
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.classList.remove("fade-snap");
      })
    );
  } else {
    requestAnimationFrame(update);
  }
}

/**
 * Scroll ▴▾:
 * - one-scroll (portrait / short landscape) → pair on the card (whole column)
 * - desktop two panes → pair per pane (text / choices), not one OR’d pair
 * opts.snap: already-visited / boot – fade state is final at first paint (no grow-in).
 */
function bindPrologScrollFades(box, opts = {}) {
  if (!box) return;
  const snap =
    !!opts.snap ||
    BootHold.skipEntrance(document.documentElement) ||
    prologSeenSteps.has(state.originStep);
  if (snap) box.classList.add("fade-snap");
  else box.classList.remove("fade-snap");
  const card = originsCard();
  const cardTop = card?.querySelector(":scope > .origin-scroll-edge.top");
  const cardBottom = card?.querySelector(":scope > .origin-scroll-edge.bottom");
  const oneScroll =
    window.matchMedia("(max-aspect-ratio: 1/1)").matches ||
    window.matchMedia("(min-aspect-ratio: 1/1) and (max-height: 520px)").matches;
  const flowScroll = box.querySelector(".origin-flow-scroll");
  const body = box.querySelector(".origin-body");
  const choices = box.querySelector(".choice-stack");
  const bodyPane = box.querySelector(".origin-scroll-pane.body-pane");
  const choicePane = box.querySelector(".origin-scroll-pane.choices-pane");
  const clear = (el) => el?.classList.remove("fade-top", "fade-bottom");
  clear(box);
  clear(flowScroll);
  clear(body);
  clear(choices);
  cardTop?.classList.remove("is-on");
  cardBottom?.classList.remove("is-on");
  box.querySelectorAll(".pane-edge").forEach((h) => h.classList.remove("is-on"));
  const stepKey = `${state.originStep}:${oneScroll ? "flow" : "panes"}`;

  if (oneScroll && flowScroll) {
    bindScrollFade(flowScroll, {
      topEl: cardTop,
      bottomEl: cardBottom,
      mask: true,
      snap,
      cacheKey: `${stepKey}:flow`,
    });
    if (snap) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => box.classList.remove("fade-snap"))
      );
    }
    return;
  }
  const bindPane = (pane, scroller, part) => {
    if (!pane || !scroller) return;
    bindScrollFade(scroller, {
      topEl: pane.querySelector(":scope > .pane-edge.top"),
      bottomEl: pane.querySelector(":scope > .pane-edge.bottom"),
      mask: true,
      snap,
      cacheKey: `${stepKey}:${part}`,
    });
  };
  bindPane(bodyPane, body, "body");
  bindPane(choicePane, choices, "choices");
  if (snap) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => box.classList.remove("fade-snap"))
    );
  }
}

function syncDevHitboxes() {
  document.documentElement.classList.toggle("debug-hitboxes", !!state.dev?.hitboxes);
  renderSceneHotspots();
}

/** Plate frame of the scene objects (frame px, same 1365×768 as js/ui/scene-view.js). */
const SCENE_HOTSPOT_FRAME = { w: 1365, h: 768 };

/**
 * Ohraničení UI: outline the interactive scene objects (those with a world `instance`, i.e. actions) inside the
 * scene stage. Rebuilt after every scene plan (the stage can be recreated); cleared when the option is off.
 */
function renderSceneHotspots() {
  const stage = document.querySelector('[data-screen="origins"] .scene-compose-stage');
  if (!stage) return;
  stage.querySelectorAll(".scene-hotspot").forEach((n) => n.remove());
  if (!state.dev?.hitboxes) return;
  for (const obj of LOM.SceneObjects?.OBJECTS || []) {
    if (!obj.instance || !obj.bbox) continue;
    const b = obj.bbox;
    const el = document.createElement("div");
    el.className = "scene-hotspot";
    el.dataset.hotspot = obj.id;
    el.style.left = `${(b.x / SCENE_HOTSPOT_FRAME.w) * 100}%`;
    el.style.top = `${(b.y / SCENE_HOTSPOT_FRAME.h) * 100}%`;
    el.style.width = `${(b.w / SCENE_HOTSPOT_FRAME.w) * 100}%`;
    el.style.height = `${(b.h / SCENE_HOTSPOT_FRAME.h) * 100}%`;
    stage.appendChild(el);
  }
}

/** Fade u Postavy: jen dole (nahoře sticky Kraj/Živnost musí zůstat celé). */
function bindOriginScrollFade() {
  const scroll = document.querySelector(".origin-scroll");
  const wrap = scroll?.closest(".origin-scroll-wrap");
  if (!scroll || !wrap) return;
  bindScrollFade(scroll, {
    bottomEl: wrap.querySelector(".origin-edge-fade.bottom"),
  });
}

/** Tělo volby v prologu: gesto (kurzíva) a/nebo řeč v uvozovkách, v libovolném pořadí. */
function choiceBodyHtml(c) {
  const act = (t) => `<em class="choice-act">${nbspCzech(t)}</em>`;
  const parts = [];
  if (c.act) parts.push(act(c.act));
  if (c.say) parts.push(`„${nbspCzech(c.say)}“`);
  if (c.title) parts.push(nbspCzech(c.title, { tail: true }));
  if (c.actAfter) parts.push(act(c.actAfter));
  return parts.join(" ");
}

let lastOriginStep = -1;
/** Crossfade between prologue action-box steps (keep below scene 420ms). */
const ORIGIN_STEP_FADE_MS = 200;
/* Back navigation: a short crossfade and no word reveal again (the text was already read). */
const ORIGIN_BACK_FADE_MS = 120;
let originBackStep = false;
let originStepFadeToken = 0;
/** Cancels a pending text→choices reveal when the step paints again. */
let originRevealToken = 0;
/** Steps whose word reveal already ran this prolog session: back or forward to them paints at once (reset on restart). */
const prologSeenSteps = new Set();

/**
 * Runs cb once el is actually painted inside its scroll container (IntersectionObserver clips by ancestors, so an
 * element scrolled out of its pane waits). Without IntersectionObserver it runs at once.
 */
function whenInView(el, cb) {
  if (!el || typeof IntersectionObserver === "undefined") {
    cb();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    cb();
  });
  io.observe(el);
}

/** opts.instant: paint the step at once, without the word and choice reveal (back navigation). */
function paintOriginsContent(box, step, opts = {}) {
  if (typeof hideFloatTip === "function") hideFloatTip();
  /* Hidden state is part of the first paint (markup), so the new step never shows fully before its reveal starts. */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = !opts.instant && !reduceMotion;
  const letters = ["A", "B", "C", "D", "E", "F"];
  /* mezivěta po reakci na zvon: krok „domov“ na ni navazuje */
  const lead = step.lead ? step.lead[pickedClass() || "none"] : "";
  const bridge = state.prologBridges?.[state.originStep - 1] || ""; /* Svatavina odpověď nebo následek předchozí volby */
  if (!state.kodexSeen) state.kodexSeen = new Set();
  const bodyRaw = [bridge, lead, step.text]
    .filter(Boolean)
    .join("\n")
    .split("\n")
    .map((para) => `<p class="prose-beat origin-text">${nbspCzech(para, { tail: true })}</p>`)
    .join("");
  const bodyHtml = LOM.Kodex.annotate(bodyRaw, state.kodexSeen);
  const choicesHtml = step.choices
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => (step.pick === "origin" ? originChoiceAllowed(c) : true))
    .map(({ c, i }, n) => {
      const picked = choiceIsPicked(c);
      const letter = letters[n] || String(n + 1);
      return `<button type="button" class="choice btn-action${picked ? " picked" : ""}${wait ? " is-awaiting-reveal" : ""}" style="--i:${n}" data-origin-choice="${i}" aria-pressed="${picked}">
              <span class="choice-letter" aria-hidden="true">${letter}</span>
              <span class="choice-main">
                <strong class="choice-copy">${choiceBodyHtml(c)}</strong>
                ${c.hint ? `<span class="btn-hint">${c.hint}</span>` : ""}
              </span>
            </button>`;
    })
    .join("");
  const paneEdges =
    `<div class="scroll-hint pane-edge top" aria-hidden="true"><span class="edge-chevron">▾</span></div>` +
    `<div class="scroll-hint pane-edge bottom" aria-hidden="true"><span class="edge-chevron">▾</span></div>`;
  box.innerHTML = `
    <div class="origin-flow">
      <div class="origin-flow-scroll">
        <div class="origin-main">
          <div class="origin-scroll-pane body-pane">
            ${paneEdges}
            <div class="scroll-fade-clip">
              <div class="origin-body${wait ? " is-reveal-wait" : ""}">${bodyHtml}</div>
            </div>
          </div>
          ${state.prologReply && step.pick === "class" ? `<p class="prose-beat origin-reply${wait ? " is-reveal-wait" : ""}">${nbspCzech(state.prologReply)}</p>` : ""}
        </div>
        <div class="origin-scroll-pane choices-pane">
          ${paneEdges}
          <div class="scroll-fade-clip">
            <div class="choice-stack">
              ${choicesHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
    `;
  box.dataset.revealed = "1";
  syncOriginProgress();
  syncOriginSideNav();
  const token = ++originRevealToken;
  prologSeenSteps.add(state.originStep);
  if (opts.instant) {
    /* Static paint: no awaiting-reveal class, no word spans; scroll + fades land in final state (no fade grow-in). */
    bindPrologScrollFades(box, { snap: true });
    applyPendingPrologScroll(box);
    bindPrologScrollFades(box, { snap: true });
    /* After layout: re-apply. Clear only outside boot (boot clears in waitBootPose after settling). */
    settlePendingPrologScroll(box, { clear: !BootHold.skipEntrance(document.documentElement) });
    return;
  }
  const choiceBtns = [...box.querySelectorAll(".choice.btn-action")];
  /* One choice after another, each with its own word reveal; a choice starts only once it is in view in its pane. */
  const revealChoicesStaggered = () => {
    if (token !== originRevealToken) return;
    if (!choiceBtns.length) {
      bindPrologScrollFades(box);
      return;
    }
    choiceBtns.forEach((btn, n) => {
      const main = btn.querySelector(".choice-main");
      whenInView(btn, () => {
        window.setTimeout(() => {
          if (token !== originRevealToken) return;
          btn.classList.remove("is-awaiting-reveal");
          if (main) revealText(main, { step: 22, delay: 0 });
          bindPrologScrollFades(box);
        }, n * 160);
      });
    });
  };
  /* Body (then reply) first, choices after the prose. The text is wrapped in word spans only when it is in view. */
  const bodyEl = box.querySelector(".origin-body");
  const replyEl = box.querySelector(".origin-reply");
  whenInView(bodyEl, () => {
    if (token !== originRevealToken) return;
    bodyEl?.classList.remove("is-reveal-wait");
    const bodyEnd = revealText(bodyEl);
    replyEl?.classList.remove("is-reveal-wait");
    const textEnd = replyEl ? revealText(replyEl, { delay: bodyEnd + 80 }) : bodyEnd;
    window.setTimeout(() => revealChoicesStaggered(), reduceMotion ? 0 : Math.max(0, textEnd + 90));
  });
  bindPrologScrollFades(box);
  applyPendingPrologScroll(box);
  bindPrologScrollFades(box);
  settlePendingPrologScroll(box, { clear: !BootHold.skipEntrance(document.documentElement) });
}

/* Prolog state per tab (Admin switch reloads the page): resume the same step. Every access is in try/catch. */
const PROLOG_SESSION_KEY = "lom.prolog";
/** False until boot has read the stored prolog, so an early render cannot overwrite it with defaults. */
let prologSessionReady = false;
/** Held from the start of boot until the stored state is applied (releaseBootCompose): no scene is composed with defaults meanwhile. */
const bootHold = BootHold.create();
/** Scroll of the prolog animation window, restored synchronously before reveal (from lom.prolog.scroll / scrollByStep). */
let pendingPrologScroll = null;
/** Per-step scroll maps for back/forth within the same session (also persisted in the prolog snapshot). */
let prologScrollByStep = Object.create(null);
let prologScrollSaveRaf = 0;

function readPrologScrollMap(box) {
  const root = box || $("origins-box");
  if (!root) return null;
  return BootHold.scrollFromSnapshot({
    scroll: {
      body: root.querySelector(".origin-body")?.scrollTop || 0,
      choices: root.querySelector(".choice-stack")?.scrollTop || 0,
      flow: root.querySelector(".origin-flow-scroll")?.scrollTop || 0,
    },
  });
}

/** Apply the stored scroll map onto the current origins box (sync; fade classes update via bind). */
function applyPendingPrologScroll(box) {
  const root = box || $("origins-box");
  if (!root || !pendingPrologScroll) return false;
  return BootHold.applyScrollMap(pendingPrologScroll, {
    body: root.querySelector(".origin-body"),
    choices: root.querySelector(".choice-stack"),
    flow: root.querySelector(".origin-flow-scroll"),
  });
}

/**
 * Re-apply pending scroll after layout (two rAFs). clear: drop the pending map after settle
 * (boot keeps it until waitBootPose so a late layout pass can restore again).
 */
function settlePendingPrologScroll(box, opts) {
  const root = box || $("origins-box");
  if (!root || !pendingPrologScroll) return;
  const clear = !!(opts && opts.clear);
  applyPendingPrologScroll(root);
  requestAnimationFrame(() => {
    applyPendingPrologScroll(root);
    requestAnimationFrame(() => {
      applyPendingPrologScroll(root);
      if (clear) pendingPrologScroll = null;
    });
  });
}

function scheduleSavePrologScroll() {
  if (prologScrollSaveRaf || !prologSessionReady) return;
  prologScrollSaveRaf = requestAnimationFrame(() => {
    prologScrollSaveRaf = 0;
    saveProlog();
  });
}

/** Bound by initDevStorybook so chrome ↺ can re-apply the selected preset (loadPreset is local there). */
let loadDevPreset = () => {};

/** Dev ↺: forget the stored prolog and the storybook session, then re-apply the preset of the selected scenario. */
function resetDevToPreset() {
  clearProlog();
  try {
    sessionStorage.removeItem(STORYBOOK_SESSION_KEY);
  } catch (_) {}
  loadDevPreset();
}

/* The prolog is stored with the scenario id it belongs to; restoreProlog only applies it to that same scenario. */
function saveProlog() {
  if (!prologSessionReady) return;
  try {
    const snap = Object.assign(LOM.PrologCamera.prologSnapshot(state), {
      scenarioId: state.activeScenario,
    });
    const scroll = readPrologScrollMap();
    if (scroll) {
      snap.scroll = scroll;
      if (lastOriginStep >= 0) prologScrollByStep[lastOriginStep] = scroll;
    }
    snap.scrollByStep = prologScrollByStep;
    sessionStorage.setItem(PROLOG_SESSION_KEY, JSON.stringify(snap));
  } catch (_) {}
}

function clearProlog() {
  try {
    sessionStorage.removeItem(PROLOG_SESSION_KEY);
  } catch (_) {}
  pendingPrologScroll = null;
  prologScrollByStep = Object.create(null);
}

/** Returns true when a stored prolog was applied (the caller then repaints the origins view). */
function restoreProlog() {
  let raw = null;
  try {
    raw = JSON.parse(sessionStorage.getItem(PROLOG_SESSION_KEY) || "null");
  } catch (_) {
    raw = null;
  }
  /* A stored prolog of another scenario (stale, or before a dev pick in this boot) is not applied. */
  const snap = BootHold.snapshotForScenario(raw, state.activeScenario);
  const r = snap ? LOM.PrologCamera.prologRestore(snap, ORIGIN_STEPS.length) : null;
  prologScrollByStep = Object.create(null);
  if (snap && snap.scrollByStep && typeof snap.scrollByStep === "object") {
    Object.keys(snap.scrollByStep).forEach((k) => {
      const map = BootHold.scrollFromSnapshot({ scroll: snap.scrollByStep[k] });
      if (map) prologScrollByStep[k] = map;
    });
  }
  const stepKey = r ? String(r.originStep) : null;
  /* Only scrollByStep for the restored step: never fall back to snap.scroll (that belongs to the step last saved). */
  pendingPrologScroll =
    (stepKey != null && prologScrollByStep[stepKey]) ||
    (stepKey != null && prologScrollByStep[Number(stepKey)]) ||
    null;
  if (r) {
    const { picks, prologDone, ...rest } = r;
    Object.assign(state, rest);
    if (picks) Object.assign(state.picks, picks);
    if (prologDone) Object.assign(state.prologDone, prologDone);
    /* Steps read before the reload paint at once (no word reveal again). */
    for (let i = 0; i <= state.originReached; i++) prologSeenSteps.add(i);
  }
  prologSessionReady = true;
  return !!r;
}

function renderOrigins() {
  const step = ORIGIN_STEPS[state.originStep];
  const box = $("origins-box");
  if (!box || !step) return;
  const prevStep = lastOriginStep;
  const stepChanged = lastOriginStep !== state.originStep;
  if (stepChanged && prevStep >= 0) {
    const cur = readPrologScrollMap(box);
    if (cur) prologScrollByStep[prevStep] = cur;
    pendingPrologScroll = prologScrollByStep[state.originStep] || null;
  }
  saveProlog();
  const back = originBackStep; /* set by goOriginBack for this one paint only */
  originBackStep = false;
  /* Boot / first composition: land in the final state (no entrance). After reveal, only user steps animate. */
  const bootSkip = BootHold.skipEntrance(document.documentElement);
  /* Back, or a step already revealed this session: quick fade and an instant paint (no word reveal again). */
  const quick = bootSkip || back || prologSeenSteps.has(state.originStep);
  /* Leave peek before the new step's camera: otherwise prologCameraWanted stays false and the speaker never frames. */
  const scrNow = document.querySelector('[data-screen="origins"]');
  if (stepChanged && prevStep >= 0 && scrNow && (scrNow.classList.contains("is-peek") || scrNow.classList.contains("is-peek-expanding"))) {
    exitPeekMode();
    setPeekButtonState(document.querySelector(".peek-btn"), false);
  }
  setPrologBg();
  applyPrologCamera(true);
  const maxReached = Math.max(state.originStep, state.originReached || 0);
  state.originReached = maxReached;
  lastOriginStep = state.originStep;
  /*
   * Opakovaný render stejného kroku (např. po kliku na volbu) nesmí přepsat innerHTML
   * uprostřed náběhu – jen obnoví picked. Jinak druhé volání smaže span.w.
   */
  if (!stepChanged && box.dataset.revealed === "1") {
    box.querySelectorAll("[data-origin-choice]").forEach((btn) => {
      const i = Number(btn.dataset.originChoice);
      const c = step.choices[i];
      if (!c) return;
      const picked = choiceIsPicked(c);
      btn.classList.toggle("picked", picked);
      btn.setAttribute("aria-pressed", String(picked));
    });
    const replyNeed = !!(state.prologReply && step.pick === "class");
    let replyEl = box.querySelector(".origin-reply");
    if (replyNeed) {
      if (!replyEl) {
        replyEl = document.createElement("p");
        replyEl.className = "prose-beat origin-reply";
        box.querySelector(".origin-main")?.appendChild(replyEl);
      }
      replyEl.innerHTML = nbspCzech(state.prologReply);
    } else {
      replyEl?.remove();
    }
    syncOriginProgress();
    syncOriginSideNav();
    bindPrologScrollFades(box);
    applyPendingPrologScroll(box);
    bindPrologScrollFades(box);
    settlePendingPrologScroll(box, { clear: !BootHold.skipEntrance(document.documentElement) });
    return;
  }
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canCrossfade = !bootSkip && stepChanged && box.dataset.revealed === "1" && !reduceMotion;
  if (canCrossfade) {
    const token = ++originStepFadeToken;
    syncOriginProgress();
    syncOriginSideNav();
    box.classList.add("is-exchanging");
    /* Back: quick fade, then the step appears at once (no slow re-animation). */
    box.classList.toggle("is-back", quick);
    window.setTimeout(() => {
      if (token !== originStepFadeToken) return;
      paintOriginsContent(box, step, { instant: quick });
      requestAnimationFrame(() => {
        if (token !== originStepFadeToken) return;
        box.classList.remove("is-exchanging");
        box.classList.remove("is-back");
      });
    }, quick ? ORIGIN_BACK_FADE_MS : ORIGIN_STEP_FADE_MS);
    return;
  }
  box.classList.remove("is-exchanging");
  paintOriginsContent(box, step, { instant: quick });
}

/* Počasí a tělo (js/systems/weather.js, docs/reference/weather.md): počasí dne je ze seedu, hráč ho vidí vždy; stav mokrý/prochladlý
   vzniká krokem po mapě podle výbavy a místa (venku / ve městě pod střechou / u ohně při spaní). */

function render() {
  syncDevPad();
  if (state.screen === "origins") renderOrigins();
}

/** Je prolog právě v režimu 👁 (celá scéna)? */
function isOriginsPeeking() {
  const scr = document.querySelector('[data-screen="origins"]');
  return (
    !!scr &&
    (scr.classList.contains("is-peek") ||
      scr.classList.contains("is-peek-expanding") ||
      scr.classList.contains("is-peek-closing"))
  );
}

function initWorldDemo() {
  if (!LOM.Instances || !$("dev-world-out")) return;
  /* Start at real Prague time; scenario/Doba knobs may snap afterwards. */
  worldDemo = worldDemoRecompute(worldDemoReset(worldHourNow()));
  renderWorldDemo();
  syncPhaseKnobFromWorldHour(worldDemo.hour);
  const panel = $("dev-detail-panel");
  if (!panel || panel.dataset.worldBound) return;
  panel.dataset.worldBound = "1";
  panel.addEventListener(
    "toggle",
    (e) => {
      if (e.target?.id === "dev-scene-objects" && sceneDemo) sceneDemo.objOpen = e.target.open;
    },
    true
  );
  panel.addEventListener("input", (e) => {
    if (e.target?.id !== "dev-world-hour" || !worldDemo) return;
    worldDemo.hour = clampWorldHour(e.target.value);
    worldDemoRecompute(worldDemo);
    /* Live scrub: keep the thumb; objects/progress + bake phase update as we drag. */
    renderWorldDemo({ rebuildClock: false });
    syncPhaseKnobFromWorldHour(worldDemo.hour);
  });
  panel.addEventListener("change", (e) => {
    const t = e.target;
    if (!t || !worldDemo) return;
    if (t.dataset?.scenePlace && sceneDemo) {
      e.stopPropagation();
      const anchor = LOM.SceneObjects?.anchorById?.(t.dataset.scenePlace);
      if (!sceneDemo.placements) sceneDemo.placements = {};
      if (!anchor || t.value === anchor.object) delete sceneDemo.placements[t.dataset.scenePlace];
      else sceneDemo.placements[t.dataset.scenePlace] = t.value;
      renderWorldDemo({ rebuildClock: false });
      if (anchor) LOM.SceneView?.highlight?.(LOM.SceneObjects.byId(anchor.object)?.bbox);
      writeStorybookSession();
      return;
    }
    /* data-world-state has no value: dataset.worldState === "" is falsy, which silently dropped every change */
    if (!t.hasAttribute?.("data-world-state")) return;
    e.stopPropagation();
    const target = t.dataset.worldTarget;
    const want = t.value;
    /* An action when one reaches the state (counters, smoke after snuffing), otherwise set it directly. */
    const cur = worldDemoInst(target);
    if (!cur || cur.state === want) return;
    const act = worldActionTowardState(cur, want);
    const next = act ? LOM.Instances.applyAction(cur, act, worldDemo.hour).inst : null;
    if (next && next.state === want) applyWorldDemoAction(target, act);
    else worldForceState(target, want);
  });
  panel.addEventListener("click", (e) => {
    const t = e.target.closest?.("[data-world],[data-world-act],[data-world-obj-reset]");
    if (!t || !worldDemo || !LOM.Instances) return;
    if (t.dataset.worldObjReset) {
      worldResetObject(t.dataset.worldObjReset);
      writeStorybookSession();
      return;
    }
    const act = t.dataset.worldAct;
    const target = t.dataset.worldTarget;
    if (!act || !target) return;
    applyWorldDemoAction(target, act);
  });
}

function initDevStorybook() {
  const sel = $("dev-scenario");
  const bar = document.querySelector(".storybook-bar");
  if (!window.LOM?.SCENARIOS) return;
  const publicBar = !!PUBLIC_DEMO;
  if (bar) bar.classList.toggle("is-public-demo", publicBar);

  const defaultScenarioId = LOM.SCENARIOS.some((x) => x.id === "start-origins")
    ? "start-origins"
    : LOM.SCENARIOS[0]?.id;
  const scenarioId = () => (publicBar ? defaultScenarioId : sel?.value || defaultScenarioId);

  if (sel) {
    if (publicBar) {
      sel.hidden = true;
      sel.setAttribute("aria-hidden", "true");
    } else {
      const groups = {};
      LOM.SCENARIOS.forEach((sc) => (groups[sc.group] = groups[sc.group] || []).push(sc));
      sel.innerHTML = Object.entries(groups)
        .map(
          ([g, list]) =>
            `<optgroup label="${LOM.GROUPS.indexOf(g) + 1} ${g}">${list.map((sc) => `<option value="${sc.id}">${scenarioOptionLabel(sc)}</option>`).join("")}</optgroup>`
        )
        .join("");
    }
  }
  $("dev-reset")?.toggleAttribute("hidden", publicBar);

  /* 298. kolo: no image-style dropdown in the dev box (photoreal is the only path; the illustrated set was removed in round 312). */
  const knobs = publicBar
    ? publicDevKnobs()
    : LOM.KNOBS.filter((k) => k.id !== "prologStyle").map((k) => (k.id === "place" ? { ...k, opts: devPlaceOpts() } : k));
  const bySec = { cas: [], world: [] };
  knobs.forEach((k) => {
    const sec = DEV_KNOB_SEC[k.id] || "world";
    (bySec[sec] || bySec.world).push(k);
  });
  Object.entries(bySec).forEach(([sec, list]) => {
    const host = document.querySelector(`[data-knob-sec="${sec}"]`);
    if (!host) return;
    const stageChecks = list.filter((k) => k.stage && k.type === "check");
    host.innerHTML = list.filter((k) => !stageChecks.includes(k)).map(knobControlHtml).join("");
    const checks = document.querySelector(`[data-knob-sec="${sec}-checks"]`);
    if (checks) checks.innerHTML = stageChecks.map(knobControlHtml).join("");
  });
  if (publicBar) {
    /* Public: Místo + Doba only (cas/world knobs); hide private image/objects chrome. */
    const pubSecs = new Set(["cas", "world"]);
    document.querySelectorAll(".dev-sec[data-sec], .dev-group").forEach((el) => {
      const sec = el.dataset?.sec;
      if (!sec) {
        el.hidden = true;
        return;
      }
      el.hidden = !pubSecs.has(sec);
      if (pubSecs.has(sec)) el.open = true;
    });
  }

  /**
   * Doba / záběr / styl: jen bake crossfade (peek + pan/zoom zůstanou). Bez applyScenario –
   * akční box a volby prologu se nepřerenderují.
   */
  const softApplyPrologVisuals = ({ fromPhaseKnob = false } = {}) => {
    const ph = document.querySelector('select[data-knob="phase"]')?.value;
    const style = document.querySelector('select[data-knob="prologStyle"]')?.value;
    const shot = document.querySelector('select[data-knob="prologShot"]')?.value;
    if (ph && LOM.PHASES) {
      const idx = Math.max(0, LOM.PHASES.findIndex((p) => p.id === ph));
      state.clock = { day: state.clock?.day || 1, tick: idx * LOM.TICKS_PER_PHASE };
      /* Doba knob snaps the continuous hour; slider remains the source of truth while scrubbing. */
      if (fromPhaseKnob && worldDemo) syncWorldHourFromPhase(ph);
    }
    if (style) state.prologStyle = style;
    if (shot === "s1" || shot === "s2") state.prologShot = shot;
    if (publicBar) storyPlaceId = "tavern";
    const peeking = isOriginsPeeking();
    const savedPan = peeking ? { x: peekPan.x, y: peekPan.y, scale: peekPan.scale } : null;
    if (state.screen === "origins") {
      setPrologBg();
      /* Same 16:9 bake – do not re-layout peek canvas (that looked like a re-zoom). */
      if (peeking && savedPan) {
        peekPan = savedPan;
        clampPeekPan();
        applyPeekTransform();
      }
    } else syncPhaseLook();
    devKnobs = knobsFromUi();
    writeStorybookSession();
    return true;
  };
  const SOFT_PROLOG_KNOBS = new Set(["phase", "prologStyle", "prologShot"]);

  const applyFromKnobs = () => {
    devKnobs = knobsFromUi();
    if (publicBar) {
      softApplyPrologVisuals();
      return;
    }
    refreshScenarioOptionLabels(devKnobs);
    applyScenario(scenarioId(), devKnobs);
  };
  const loadPreset = () => {
    const run = () => {
      const id = scenarioId();
      const sc = LOM.SCENARIOS.find((x) => x.id === id);
      if (sel && !publicBar) sel.value = id;
      fillKnobsFromScenario(sc);
      if (publicBar) {
        /* pevně: origins + krčma; knoby jen place/phase */
        applyScenario(id, { ...knobsFromUi(), place: "tavern" });
        softApplyPrologVisuals();
        /* Preset dropdown / chrome ↺ only – refresh restores session, does not force sections. */
        if (!storybookBooting) {
          resetDevWorldSceneFromPreset();
          focusDevForCurrentScreen();
        }
        return;
      }
      applyFromKnobs();
      /* Preset change / chrome ↺ = factory world+scene + open relevant Detail sections. */
      if (!storybookBooting) {
        resetDevWorldSceneFromPreset();
        focusDevForCurrentScreen();
      }
    };
    /* ↺ / změna předvolby: krátký fade scény (stejný rytmus jako bake). */
    const view = document.querySelector("[data-screen]:not(.hidden)");
    if (!view || peekReduceMotion() || document.documentElement.classList.contains("boot-pending")) {
      run();
      return;
    }
    view.style.transition = `opacity ${SCENE_FADE_MS}ms ease`;
    view.style.opacity = "0";
    window.setTimeout(() => {
      run();
      const next = document.querySelector("[data-screen]:not(.hidden)") || view;
      next.style.transition = "none";
      next.style.opacity = "0";
      void next.offsetWidth;
      next.style.transition = `opacity ${SCENE_FADE_MS}ms ease`;
      next.style.opacity = "1";
      window.setTimeout(() => {
        next.style.transition = "";
        next.style.opacity = "";
      }, SCENE_FADE_MS + 40);
    }, SCENE_FADE_MS);
  };
  document.querySelectorAll("[data-knob-sec]").forEach((el) =>
    el.addEventListener("change", (e) => {
      if (!e.target.dataset?.knob) return;
      const kid = e.target.dataset.knob;
      if (kid === "place") {
        /* Positions and objects belong to the place: rebuild them after the scenario is applied. */
        setTimeout(() => {
          renderSceneComposeControls();
          if (worldDemo) renderWorldDemo({ rebuildClock: false });
        }, 0);
      }
      if (
        SOFT_PROLOG_KNOBS.has(kid) &&
        (publicBar ||
          ((state.screen === "origins") && state.activeScenario))
      ) {
        softApplyPrologVisuals({ fromPhaseKnob: kid === "phase" });
        return;
      }
      applyFromKnobs();
    })
  );
  if (sel && !publicBar)
    sel.addEventListener("change", () => {
      loadPreset();
    });
  loadDevPreset = loadPreset;
  if (!publicBar) $("dev-reset")?.addEventListener("click", resetDevToPreset);
  if (!publicBar) renderDevStatus();
  if (!publicBar) {
    initSceneComposeDemo();
    initWorldDemo();
  }
  const fillDevToggles = (el, list) => {
    if (!el || !list.length) return;
    el.innerHTML = list
      .map(
        (t) =>
          `<label class="dev-chk has-tip" data-tip="${t.tip}"><input type="checkbox" data-toggle="${t.id}" ${state.dev[t.id] ? "checked" : ""} /> ${t.label}</label>`
      )
      .join("");
  };
  const onDevToggleChange = (e) => {
    const id = e.target.dataset?.toggle;
    if (!id) return;
    state.dev[id] = e.target.checked;
    writeStorybookSession();
    if (id === "hitboxes") {
      syncDevHitboxes();
      return;
    }
    render();
  };
  if (!publicBar && LOM.TOGGLES?.length) {
    LOM.TOGGLES.forEach((t) => {
      if (state.dev[t.id] === undefined) state.dev[t.id] = t.default;
    });
    const debugToggles = LOM.TOGGLES.filter((t) => t.group === "debug");
    const debugEl = $("dev-debug-toggles");
    fillDevToggles(debugEl, debugToggles);
    debugEl?.addEventListener("change", onDevToggleChange);
    syncDevHitboxes();
  }
  const savedSession = readStorybookSession();
  if (sel && !publicBar) {
    const bootId =
      savedSession?.scenarioId && LOM.SCENARIOS.some((x) => x.id === savedSession.scenarioId)
        ? savedSession.scenarioId
        : defaultScenarioId;
    if (bootId) sel.value = bootId;
  }
  storybookBooting = true;
  loadPreset();
  /* Restore exact session (knobs + world + scene + peek). Defaults only on preset ↺ / change. */
  if (savedSession && state.activeScenario === savedSession.scenarioId) {
    if (savedSession.knobs) {
      applyKnobsToUi(savedSession.knobs);
      if (publicBar) softApplyPrologVisuals();
      else applyFromKnobs();
    } else {
      if (savedSession.phase && LOM.PHASES) {
        const idx = Math.max(0, LOM.PHASES.findIndex((p) => p.id === savedSession.phase));
        state.clock = { day: state.clock?.day || 1, tick: idx * LOM.TICKS_PER_PHASE };
        const phSel = document.querySelector('select[data-knob="phase"]');
        if (phSel) phSel.value = savedSession.phase === "afternoon" ? "evening" : savedSession.phase;
      }
      if (savedSession.prologStyle) {
        state.prologStyle = savedSession.prologStyle;
        const stSel = document.querySelector('select[data-knob="prologStyle"]');
        if (stSel) stSel.value = savedSession.prologStyle;
      }
      if (savedSession.prologShot === "s1" || savedSession.prologShot === "s2") {
        state.prologShot = savedSession.prologShot;
        const shSel = document.querySelector('select[data-knob="prologShot"]');
        if (shSel) shSel.value = savedSession.prologShot;
      }
      if (state.screen === "origins") setPrologBg();
    }
    if (savedSession.toggles) restoreDevTogglesFromSession(savedSession.toggles);
    if (savedSession.world) restoreWorldDemoFromSession(savedSession.world);
    else resetDevWorldSceneFromPreset();
    if (savedSession.scene) restoreSceneDemoFromSession(savedSession.scene);
    if (savedSession.peek && state.screen === "origins" && prologSceneVisibleForStep(state.originStep)) {
      /* Seed camera BEFORE enterPeekMode so the first paint keeps the saved pose (no rAF flip). */
      restorePeekCameraFromSession(savedSession);
      enterPeekMode({ keepPan: true });
      setPeekButtonState(document.querySelector(".peek-btn"), true);
    }
  } else if (!publicBar) {
    resetDevWorldSceneFromPreset();
  }
  /* boot-peek set the peek classes before the restore; when the restore did not re-enter peek, drop them (no stale letterbox). */
  const scrBoot = document.querySelector('[data-screen="origins"]');
  const wantPeek = !!(savedSession?.peek && state.screen === "origins");
  if (scrBoot && !wantPeek && isOriginsPeeking()) {
    scrBoot.classList.remove("is-peek", "is-peek-expanding", "is-peek-closing", "is-peek-cover", "is-peek-layout");
    resetPeekTransform("instant");
  }
  storybookBooting = false;
  document.documentElement.classList.remove("boot-peek", "boot-storybook");
  writeStorybookSession();
  syncDevUi();
  /* Plynulé zobrazení scény po Cmd+R (až je preset + peek hotový). */
  requestAnimationFrame(() => revealBootScene());
}
/* Boot reveal (Cmd+R fade-in) once the pose is set. The timeout keeps the stage from staying dark if the boot throws. */
const BOOT_POSE_WAIT_MS = 1500;
/* The prolog pose is in when the bake is painted and the camera has been applied to it (else the first visible frames show the un-posed stage). */
function prologPoseReady() {
  if (state.screen !== "origins") return true;
  /* No bake on this step: first paint is already final (nothing to wait for). */
  if (!prologSceneVisibleForStep(state.originStep)) return true;
  const bg = document.querySelector('[data-screen="origins"] .landing-bg');
  if (!bg) return true;
  if (!bg.style.backgroundImage) return false;
  return !!prologCamKey || !prologCameraWanted();
}
/* Ends the boot hold once the stored state is applied: the scene composes once, with that state (never with the defaults first).
   Also called from revealBootScene, so a boot that threw before its end still composes and reveals. */
function releaseBootCompose() {
  if (!bootHold.release()) return;
  setPrologBg();
}
function revealBootScene() {
  releaseBootCompose();
  waitBootPose(performance.now() + BOOT_POSE_WAIT_MS);
}
/* Waits (polling, not rAF: a hidden tab does not run rAF) until the pose is in or the deadline passes, then fades in. */
function waitBootPose(deadline) {
  if (document.documentElement.classList.contains("boot-ready")) return;
  if (!prologPoseReady() && performance.now() < deadline) {
    setTimeout(() => waitBootPose(deadline), 30);
    return;
  }
  bootPoseSnap = false;
  /* Sync scroll + fade of the animation window to the stored snapshot before the body fades in. */
  const box = $("origins-box");
  if (box) {
    bindPrologScrollFades(box, { snap: true });
    applyPendingPrologScroll(box);
    bindPrologScrollFades(box, { snap: true });
  }
  try {
    document.documentElement.classList.add("boot-ready");
    document.documentElement.classList.remove("boot-pending");
    /* One frame after reveal: entrance animations may run again (user-triggered changes only). */
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("boot-settling");
      /* Re-pick bake width / peek canvas now that layout has a real viewport (avoids 720px mush / squeeze). */
      try {
        if (typeof bakeWidth === "function" && typeof PROLOG_WEB !== "undefined") {
          const w = bakeWidth(PROLOG_WEB.avif);
          if (typeof prologBgWidth !== "undefined" && w !== prologBgWidth) {
            prologBgWidth = w;
            if (state.screen === "origins" && typeof setPrologBg === "function") setPrologBg();
          }
        }
        if (typeof isOriginsPeeking === "function" && isOriginsPeeking() && typeof layoutPeekFullImage === "function") {
          layoutPeekFullImage(null, { resetPan: false });
        }
      } catch (_) {}
      /* After settling + possible bake resize: restore action-box scroll once layout is final. */
      if (box) {
        bindPrologScrollFades(box, { snap: true });
        settlePendingPrologScroll(box, { clear: true });
      } else {
        pendingPrologScroll = null;
      }
      /* Two frames: floating boxes may animate open/close on user toggle only. */
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("boxes-boot");
        document.documentElement.classList.add("boxes-ready");
      });
    });
  } catch (_) {
    pendingPrologScroll = null;
  }
}
