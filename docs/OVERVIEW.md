# Overview

Public snapshot of **Land of Machala**: a text RPG prototype. Play the hosted demo; clone this repo if you want the source.

Dialogue and UI copy in the game are in Czech. This overview and contributor notes are English.

## Layout (from `prototype/`)

| Path | What it is |
|---|---|
| `index.html`, `app.js`, `styles.css` | UI: screens, state, rendering, dialogues |
| `js/rng.js` | seeded RNG (mulberry32); rules never use `Math.random` |
| `js/data/` | pure data: enemies, classes, races, origins, items, map, quests, demo case, names, glossary |
| `js/systems/` | pure rules (combat, world, quests, rumour case, stash, names, saves) — unit-tested |
| `js/dev/scenarios.js` | storybook scenes (dev bar; on Pages use `?dev=1`) |
| `js/test/` | `node --test` |

Plain `<script>` tags, no build. Modules are UMD (Node + browser).

## Core ideas

- **Combat:** enemies telegraph intent; the hint can be wrong. INT, familiarity and potions change how sure you should be.
- **Rumour case (demo):** one missing bell, conflicting stories, a deadline.
- **Death:** gear stays on the corpse; you wake at the healer and walk back.
- **World:** fixed encounter spots from the seed; nothing random-spawns as you walk.

## Dig deeper

1. [architecture.md](architecture.md) — code map and data shapes  
2. `prototype/js/systems/combat.js` and its test — cleanest pure-rules example  
3. [AGENTS.md](../AGENTS.md) — how to change things safely  
