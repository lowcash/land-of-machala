# Documentation

Start with the English [OVERVIEW.md](OVERVIEW.md). The detailed docs below are in Czech (the game is Czech-language).

| I want to know… | Where |
|---|---|
| **how it works today** (numbers generated from the code) | [reference/](reference/): [architecture (code map, data formats, how to add things)](reference/architecture.md) · [mechanics (index of mechanics)](reference/mechanics.md) · [combat](reference/combat.md) · [characters](reference/characters.md) · [items](reference/items.md) · [map](reference/map.md) · [places](reference/places.md) · [world](reference/world.md) · [quests](reference/quests.md) · [kauza (rumour cases)](reference/kauza.md) · [storybook](reference/storybook.md) |
| UI conventions | [design/ui.md](design/ui.md) |
| formát changelogu | [reference/architecture.md](reference/architecture.md#changelog-hráče) |

Contributor rules: [../AGENTS.md](../AGENTS.md). `reference/` describes the prototype; if docs and code disagree, the code wins.

Run: open `prototype/index.html`. Tests: `node --test prototype/js/test/*.test.js` · simulation: `node prototype/js/sim.js 2000` · reference tables: `node prototype/js/gen-docs.js`.
