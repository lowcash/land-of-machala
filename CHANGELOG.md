# Changelog

What changed in the playable build and the tooling around it. Newest first. Player-visible changes and public tooling only; nothing from private planning or unpublished story.

Format: dated sections; versions follow `APP_VERSION` in `prototype/app.js` when it changes.

## Unreleased

### World
- **Weather and body:** each day has its weather (clear, overcast, rain, fog) that you always see (a line in the travel text and a chip). Walking outside in rain or fog makes you **wet** and, depending on your gear, **chilled** (cloak, boots, cap, gloves and trousers help; mail and steel do not warm you). Being cold slows travel, lowers DEX, and a frozen character starts fights with 10 % less HP; rain makes fleeing harder and fog easier. A fire or a night at the inn dries and warms you.

### Shell
- Mobile PWA / home-screen install shows a **Machala** icon (`manifest.webmanifest` + 192/512 + apple-touch).
- Play shell is **edge-to-edge** on the visual viewport (bake into notch / home indicator); chrome pads with safe-area. Letterbox and unsafe bands use a soft vignette (`--scene-void`), not a hard cut. After rotate, viewport vars re-sync in waves (iOS PWA landscape).
- Inventory / loot / drag-handle icons sit **optical-center** in their buttons (no low-sitting glyph).
- Tooltips: hover on desktop; **long-press** (~0.5 s) on touch for chrome tips (short tap still runs the button); glossary words toggle on tap. Tips measure before show (no jump) and clamp to the visual viewport.

### Prologue
- Peek eye sits **tight in the top-right** (small inset + safe, not the progress band); landscape clears it with a shorter top pad so copy sits higher, while ‹› left/right gutters stay equal.
- Peek ↔ text exit is smoother: FLIP ends clear on the resting crop (no dim snap); short landscape fades out, swaps to the plate, fades back in.
- Scroll-edge fades use a **soft floor mask** (~0.5 floor + mid stop; text eases, no fade-to-black). Phone landscape text column is wider (~60%) without a double-padded empty right band; ‹› keep the same near·hit·near cross.
- The tavern now **moves**: sparks rise from the fire, candle flames flicker with a soft glow, smoke curls above the candles, and dust motes drift through the evening sunbeam and the moonlight (never over the characters; off with reduced motion or `?particles=0`).
- Photoreal tavern shots refreshed (**r3 / v4**): coif, candle holders, tap-room detail; true 16:9 sizes (720–3840).
- Step copy reveals first, then choices appear one-by-one (each with its own word reveal).
- Scroll ▴▾ sit the same distance from the text as step ‹›; side gutters stay reserved even when ‹› are hidden (no width jump). Eye sits on the stage (viewport top-right = progress inset on every aspect). Phone landscape melts the action box softly into the scene on both sides (left into the picture, right into the bezel) without clipping the text; catch layers keep soft scroll fades from flashing the picture through.
- Soft scroll-edge fades (same floor top and bottom) no longer crop choices or muddy into a hard band.
- Switching prologue shots (and time of day / style) **crossfades** only after the next picture is decoded (neighbors are prefetched) — no hard cut and no black flash while AVIF/WebP loads.
- On taller windows than 16:9 (e.g. **4:3**), the prologue **letterboxes the 16:9 stage** (UI stays inside; soft fade at the image edge into the bars). Peek tips: **Full scene** / **Back**; the same blur/zoom eases in and out — letterbox bars, melt plate blur, and scroll-edge fades all ease with the same timing (no hard cuts).
- Evening and night in the tavern now have **real sunlight and moonlight**: a low sun falls through the small west window onto your table with the shadow of the window frame and of Svatava, and a faint shaft of haze hangs in the air.
- Photographic tavern pictures are now **layered, upscaled and delivered as AVIF/WebP/JPEG** in several widths (720–3840 px): sharper wood, plaster and metal, much smaller downloads, and the browser picks the size for your screen. Four times of day keep the same room; light sources (candles, torch, hearth) follow the time of day.
- Action box uses a **soft melt plate**: oversized dark shade with a long feathered edge and a light blur under the text (no hard glass panel). Portrait phones keep the picture in the upper half with a smooth fade into the text; low landscape keeps the scene on the left with a horizontal fade under the text column and the same melt plate; scroll edges fade with matching up/down hints.
- Public demo ends after the four prologue choices (no character screen): a short “demo version” modal offers to play the prologue again.
- Storybook default preset is **Prolog · Svatava (S1)** only (other presets removed for now; modes still available via knobs).
- Public Pages shows a slim floating bar (drag, collapse, opacity) with **place = tavern** and **four times of day** only — no preset list, mode, image style, or systems panel. Private storybook keeps the full bar.
- Outside the baked prologue shots, place backgrounds are off for now (solid dark).
- The tavern was redrawn period-correct: a married innkeeper in a **linen coif** with a stained, patched apron, clay and wooden mugs (one pewter heirloom), tallow candles in iron holders, a splint torch in an iron bracket beside the hearth, small sausages and an onion braid on the beam, a tap on the keg and a mug shelf (a tap room you can read at a glance); the drinker is drowsy, not cheerful. Morning/noon no longer glow around unlit candles and torches; shadows follow each time of day; the burning torch is now a charred pine splint in an iron bracket and all candles are tallow (brown, lumpy); the evening sky is a golden dusk instead of pink; morning is a cool hazy dawn and noon no longer blows out; the sky and light are consistent across all four times (new set of 8 pictures, AVIF/WebP/JPEG).
- Photorealistic tavern pictures (four times of day, with and without Svatava) are now the default prologue look; the earlier illustrated set stays available in the storybook ("Image style").
- Prologue text now sits below the picture (bottom sheet on desktop, picture on top on phones in portrait, side by side in low landscape) instead of covering it; the panel no longer uses a backdrop blur. A "Show scene" button hides the text and reveals the whole picture.
- Tavern prologue uses finished illustrations for four times of day (morning, noon, evening, night): Svatava at the table (S1), then the sleeper alone (S2). Storybook can switch shot and time of day.

### Storybook (dev bar, `?dev=1`)
- **World** section: scrub world hours (0.25 h steps), light/snuff/replace a sample candle, drink from a mug; see instance state, layer variant key, and aggregate counters (`candle_burned`, `ale_drunk`, …). Engine only — not wired into the prologue picture.
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
