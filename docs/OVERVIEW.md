# Overview

Public snapshot of **Land of Machala**: a text RPG. Play the hosted demo; clone this repo if you want the source.

Dialogue and UI copy in the game are in Czech. This overview and contributor notes are English.

## Layout (from `2d/`)

| Path | What it is |
|---|---|
| `index.html`, `app.js`, `styles.css` | UI: prologue screens, state, rendering |
| `js/data/` | pure data: classes, races, glossary |
| `js/systems/` | pure rules (clock, weather, prologue camera, particles, glossary, text variants) – unit-tested |
| `js/dev/scenarios.js` | storybook scenes (dev bar; on Pages use `?dev=1`) |
| `js/test/` | `node --test` |

Plain `<script>` tags, no build. Modules are UMD (Node + browser).

## Core ideas

- **Prologue:** four choices in a tavern; the camera frames whoever speaks, and the whole scene can be viewed and dragged.
- **Rules stay pure:** no DOM, no `Math.random`; seeds and clocks are passed in.

## Dig deeper

1. [architecture.md](architecture.md) – code map and data shapes  
2. `2d/js/systems/prolog-camera.js` and its test – a pure-rules example  
