# Changelog

What changed in the playable build and the tooling around it. Newest first. Player-visible changes and public tooling only; nothing from private planning or unpublished story.

Format: dated sections; versions follow `APP_VERSION` in `prototype/app.js` when it changes.

## Unreleased

### Prologue
- Public demo ends after the four prologue choices (no character screen): a short “demo version” modal offers to play the prologue again.
- Storybook default preset is **Prolog · Svatava (S1)** only (other presets removed for now; modes still available via knobs).
- Photorealistic tavern pictures (four times of day, with and without Svatava) are now the default prologue look; the earlier illustrated set stays available in the storybook ("Image style").
- Prologue text now sits below the picture (bottom sheet on desktop, picture on top on phones in portrait, side by side in low landscape) instead of covering it; the panel no longer uses a backdrop blur. A "Show scene" button hides the text and reveals the whole picture.
- Tavern prologue uses finished illustrations for four times of day (morning, noon, evening, night): Svatava at the table (S1), then the sleeper alone (S2). Storybook can switch shot and time of day.

### Storybook (dev bar, `?dev=1`)
- **Scene composition mode**: places are built from layers instead of one picture (sky over the whole area, mountains, hills, ground, then objects sorted by depth). Day phase tints the world; people are a layer too.
- **Tavern exterior and interior** as ready-made scenes (morning/evening, empty/full). Interior has a window that shows the sun or moon only when it is in view, a light shaft on the floor, firelight and candle glow. The door switches between inside and outside.
- **Cameras** (wide, closer, detail left/right/down) with parallax, depth-based object size and smooth transitions.
- Dev bar: one **Scene** section (place, view, camera, time of day, objects), opacity slider down to fully hidden, panel stays inside the viewport (devtools), Demo toggle moved next to the character options.

## 0.1.1 — 2026-10-23 (prologue demo)

- Prologue in the tavern: four choices (trade, region, origin, how you carry yourself), name, and a morning that depends on what you did.
- Landing screen, character summary, morning after the prologue with a "try again" ending for the public demo.
- Time of day look for the tavern, landing and morning (day phases as layers over the same pictures).
- Placeholder hand-drawn SVG set for places, enemies and props.
- Public repository export (code, rules, UI, tests, demo) with a hardened filter.

## Earlier (2026-10-22)

- First four-step prologue, summary screen, text-only RPG prototype with combat, map, rumours and one case (the missing chapel bell).
