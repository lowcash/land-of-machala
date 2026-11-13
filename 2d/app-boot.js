/* počasí v obraze prologu (obloha v okně): prolog-<shot>-<ph>-<počasí>-16x9; výběr padá na jasno, dokud finál chybí */
const PROLOG_WEATHER_KINDS = ["overcast", "rain", "fog", "snow"];
for (const shot of ["s1", "s2"]) {
  for (const ph of PROLOG_BAKE_PHASES) {
    const key = `tavern-prolog-photoreal-${shot}-${ph}`;
    BG_WEB[key] = `${BG_DIR}tavern/prolog-${shot}-${ph}-16x9`;
    BG[key] = `${BG_WEB[key]}-${PROLOG_WEB.jpeg[0]}.jpeg`;
    BG_BAKE.add(key);
    for (const wx of PROLOG_WEATHER_KINDS) {
      const wk = `${key}-${wx}`;
      BG_WEB[wk] = `${BG_DIR}tavern/prolog-${shot}-${ph}-${wx}-16x9`;
      BG[wk] = `${BG_WEB[wk]}-${PROLOG_WEB.jpeg[0]}.jpeg`;
      BG_BAKE.add(wk);
    }
  }
}
let prologCamResizeT = 0;
window.addEventListener("resize", () => {
  clearTimeout(prologCamResizeT);
  prologCamResizeT = setTimeout(() => {
    prologCamKey = "";
    applyPrologCamera(false);
  }, 120);
});
/* po změně velikosti okna / otočení přenačti jen tehdy, když se změnila vybraná šířka souboru */
let prologBgWidth = 0;
window.addEventListener("resize", () => {
  const w = bakeWidth(PROLOG_WEB.avif);
  if (w === prologBgWidth) return;
  prologBgWidth = w;
  if (state.screen === "origins") setPrologBg();
});

document.body.addEventListener("click", (e) => {
  const t = e.target.closest("[data-goto],[data-act],[data-origin-choice]");
  if (!t) return;

  if (t.dataset.goto) {
    const dest = t.dataset.goto;
    const fromDev = !!t.closest?.(".storybook-bar");
    /* DEV / navigace: vždy čistý stav cílové obrazovky */
    if (fromDev || dest !== state.screen) {
      clearUiScrollMem();
    }
    if (dest === "origins") {
      /* čistý prolog */
      state.originStep = 0;
      state.originReached = 0;
      prologSeenSteps.clear();
      state.prologDone = { class: false, race: false, origin: false };
      state.prologStory = false;
      state.prologReact = null;
      state.prologBridges = {};
      state.prologReply = null;
      state.prologCheek = 0;
    }
    setScreen(dest);
    return;
  }

  if (t.dataset.originChoice !== undefined) {
    if (typeof PLAY_PROLOG !== "undefined" && PLAY_PROLOG) return;
    const step = ORIGIN_STEPS[state.originStep];
    const choice = step && step.choices && step.choices[Number(t.dataset.originChoice)];
    if (!choice) return;
    /* drzá odpověď: prolog jde dál bez povolání (neznámý poutník), Svatava to komentuje v dalším kroku */
    if (choice.cheek) state.prologCheek += 1;
    if (choice.cheek) state.prologDone.class = false; /* drzá odpověď po dřívější volbě živnosti: poutník bez živnosti */
    state.prologReply = null;
    if (choice.class) {
      state.picks.class = choice.class;
      state.prologDone.class = true;
    }
    if (choice.race) {
      state.picks.race = choice.race;
      state.prologDone.race = true;
      /* Zdejší = odsud; Rodák jako tichý default, dokud v kroku původu nezvolíš jinak */
      if (choice.race === "local") {
        state.picks.origin = "native";
        state.prologDone.origin = true;
      } else if (state.picks.origin === "native") {
        state.picks.origin = null;
        state.prologDone.origin = false;
      }
    }
    if (choice.origin) {
      state.picks.origin = choice.origin;
      state.prologDone.origin = true;
    }
    if (choice.react) state.prologReact = choice.react;
    state.prologBridges = { ...state.prologBridges, [state.originStep]: choice.bridge || "" };
    state.originReached = Math.max(state.originReached || 0, state.originStep);
    if (state.originStep < ORIGIN_STEPS.length - 1) {
      state.originStep += 1;
      state.originReached = Math.max(state.originReached, state.originStep);
      state.prologShot = null; /* story drives bake shot again */
      renderOrigins();
      mirrorLiveToKnobs();
    } else {
      saveProlog();
      afterPrologChoices();
      mirrorLiveToKnobs();
    }
    return;
  }

  const act = t.dataset.act;
  if (!act) return;

  if (act === "start-back") closeStartModal();
  if (act === "demo-restart") {
    clearProlog();
    location.reload();
  }
  if (act === "prolog-peek") {
    const scr = document.querySelector('[data-screen="origins"]');
    const peeking =
      !!scr &&
      (scr.classList.contains("is-peek") || scr.classList.contains("is-peek-expanding"));
    if (peeking) exitPeekMode();
    else enterPeekMode();
    setPeekButtonState(t, !peeking);
    return;
  }
  if (act === "origin-back") {
    goOriginBack();
  }
  if (act === "origin-fwd") {
    goOriginFwd();
  }
});

initVisualViewportVars();
initDevBar();
initStatusBox();
initPrologPeekGestures();
initPrologStepGestures();
window.addEventListener("resize", syncDevPad);
window.addEventListener("orientationchange", () => setTimeout(syncDevPad, 50));
syncDevPad();

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideFloatTip();
    closeStartModal();
  }
  if (e.target.matches?.("input, textarea, select")) return;
  if (state.screen === "origins" && !document.querySelector('[data-screen="origins"].is-peek')) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goOriginBack();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goOriginFwd();
    }
  }
});



setTimeout(revealBootScene, 600);
initDevStorybook();

document.addEventListener("click", (e) => {
  const icon = e.target.closest(".stat-icon");
  if (!icon) {
    document.querySelectorAll(".stat-icon.is-tip").forEach((n) => n.classList.remove("is-tip"));
    if (!e.target.closest("abbr.kodex")) hideFloatTip();
  }
});

/* wheel nad sticky zpět → scroll těla akčního panelu */
document.addEventListener(
  "wheel",
  (e) => {
    const sticky = e.target.closest?.(".action-sticky");
    if (!sticky) return;
    const scroller = sticky.parentElement?.querySelector(".action-scroll");
    if (!scroller) return;
    scroller.scrollTop += e.deltaY;
    e.preventDefault();
  },
  { passive: false }
);

document.querySelectorAll(".origin-acc").forEach((el) => {
  el.addEventListener("toggle", () => {
    /* jen jedna sekce otevřená (v shrnutí po prologu jsou otevřené všechny) */
    if (el.open && !state.prologStory) {
      document.querySelectorAll(".origin-acc").forEach((other) => {
        if (other !== el) other.open = false;
      });
    }
    bindOriginScrollFade();
  });
});

/* "Admin" switch (#admin-switch, top-left, same icon and slot as the 2D switch in the admin): one address, the server decides
   what "/" shows (one-url-views). It is shown only when /auth/whoami lists the view (`pnpm dev` or an admin session on the world
   server; observer tokens never get the 2D, players never the admin); a click stores the view (POST /auth/view) and
   reloads "/". Never on file:// or in the public demo. The eye ("Rozhlédnout se") is only a camera toggle: no route, no /auth/view. */
(() => {
  if (PUBLIC_DEMO || !/^https?:$/.test(location.protocol)) return;
  const switches = [[$("admin-switch"), "admin"]].filter(([el]) => el);
  if (!switches.length) return;
  /* Copy of ClientState.watchIdentity / authVerifyDecision (2d/js/ui/client-state.js), inlined because this page does not load that file.
     One identity per browser profile: a stale tab that sees another identity clears sessionStorage and reloads "/".
     Only 401/403 clear; 5xx / network keep the session. Stale responses are ignored by request generation. */
  const authVerifyDecision = (status, networkError) => {
    if (networkError) return "retry";
    const s = Number(status);
    if (!isFinite(s) || s <= 0) return "retry";
    if (s === 401 || s === 403) return "logout";
    if (s >= 200 && s < 300) return "keep";
    return "retry";
  };
  const watchWho = (who) => {
    if (!who) return;
    const key = (w) => (w ? `${w.role}:${w.actorId || ""}` : "");
    const loaded = key(who);
    let last = 0;
    let checkGen = 0;
    const check = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 2000) return;
      last = Date.now();
      const gen = ++checkGen;
      fetch("/auth/whoami", { credentials: "same-origin", cache: "no-store" })
        .then((r) => {
          if (gen !== checkGen) return undefined;
          const d = authVerifyDecision(r.status, false);
          if (d === "logout") return null;
          if (d === "retry") return undefined;
          return r.json();
        })
        .then((w) => {
          if (gen !== checkGen || w === undefined || (w && key(w) === loaded)) return;
          try { sessionStorage.clear(); } catch (e) { /* blocked storage: nothing to clear */ }
          location.replace("/");
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
  };
  fetch("/auth/whoami", { credentials: "same-origin", cache: "no-store" })
    .then(async (r) => {
      const decision = authVerifyDecision(r.status, false);
      const body = await r.json().catch(() => null);
      if (decision === "keep") { watchWho(body); return body; }
      if (decision === "logout") accessNotice(body && body.reason);
      /* retry / 5xx: keep any stored session; the admin switch simply stays hidden until a later focus check */
      return null;
    })
    .then((who) => {
      const views = (who && who.views) || [];
      for (const [el, view] of switches) {
        if (!views.includes(view)) {
          console.info(
            `[2D] #admin-switch stays hidden: /auth/whoami ${who ? `lists views [${views.join(", ")}] without "${view}"` : "gave no session"}. ` +
              "The switch needs an admin session on the world server, or the local dev server (pnpm dev), which always answers as admin."
          );
          continue;
        }
        el.hidden = false;
        clampDevBar();
        el.addEventListener("click", (e) => {
          e.preventDefault();
          fetch("/auth/view", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ view }) })
            .then((r) => {
              if (r.ok) location.replace("/");
            })
            .catch(() => {});
        });
      }
    })
    .catch(() => {});
})();
/* The 2D boots straight into the prolog for everyone (the landing/auth screen belongs to the later superstructure).
   The stored prolog is restored for the scenario it was saved under (a dev pick keeps its own prolog step too) and the
   origins view repainted with it. */
if (restoreProlog() && state.screen === "origins") renderOrigins();
state.guest = true;
if (!state.activeScenario) setScreen("origins");
/* Stored state is in place now: release the boot hold, so the scene is composed once with it (no default first). */
releaseBootCompose();