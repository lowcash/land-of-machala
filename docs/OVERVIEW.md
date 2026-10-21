# Overview (English)

A short English map of the project. The detailed docs in [reference/](reference/) are in Czech; the numbers in their tables are generated from the code, so they are always current.

## Layout (paths from `prototype/`)

| Path | What it is |
|---|---|
| `index.html`, `app.js`, `styles.css` | the UI: screens, state, rendering, dialogues, place content. Not pure. |
| `js/rng.js` | seeded random numbers (mulberry32). Nothing in the rules uses `Math.random`. |
| `js/data/` | pure data: enemies, characters (classes, races), origins, items, map (7×7 grid), quests, the "Zvon" case, name pools, glossary. |
| `js/systems/` | pure rules, unit-tested: combat, world (time, encounter spots, XP, death), quests, rumour cases (`kauza`), text variants, stash, names, saves. |
| `js/dev/scenarios.js` | the built-in storybook: scenes, knobs, toggles, and the "system status" list. |
| `js/sim.js` | bot simulation of combat balance. `js/gen-docs.js` regenerates tables in `docs/reference/`. |
| `js/test/` | tests (`node --test`). |

Plain `<script>` tags, no build, no ES modules. Every module is UMD: it works in Node (`module.exports`) and in the browser (`window.LOM`). Script order in `index.html` matters.

## Core mechanics

- **Combat (1 vs 1, turn based).** The enemy picks a hidden intent (heavy, quick, guard); you see a hint labelled sure / I think so / unclear, and the label is the real chance that the hint is right (it rises with INT, experience with that enemy and a foresight potion; elites bluff). The right reaction cuts damage and returns a counter-strike. Heavy attacks and specials cost a resource, so spamming one action does not win. Below a health threshold an enemy may offer surrender.
- **Time and the world.** A day has 20 ticks in 5 phases. Encounters sit in fixed spots derived from the game seed (nothing spawns while you walk); tracks are visible by day only; cleared spots reset the next day.
- **Death.** Everything you carry stays in your corpse on the map; you wake up at the healer with a stick and a tunic. Quest items never duplicate. A bank keeps gold safe.
- **Rumour cases ("kauza").** People tell conflicting stories. Your certainty about a rumour depends on how reliable the source is, your INT, your class and race, and contradictions. You verify rumours at places (camp, town hall registers, chapel at night); a deadline forces the world to decide if you do not.
- **Character.** Race, class and origin (start place, gold, relationships) are chosen at creation. Relationships ("standing") and trust change prices.
- **Stash, drop and bury.** A tavern stash, items left on the map (visible, may be stolen, evaluated lazily and deterministically) and buried items (hidden, with a shovel).
- **Saving.** Versioned JSON in `localStorage`; combat is not saved.

## Where to start reading

1. [reference/architecture.md](reference/architecture.md): code map, data formats, how to add content.
2. [reference/mechanics.md](reference/mechanics.md): one row per mechanic, with the key numbers and where they live in code.
3. `prototype/js/systems/combat.js` and its test: the cleanest example of the pure-rules style.
