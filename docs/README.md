# Dokumentace

| chci vědět… | kam |
|---|---|
| **jak to dnes opravdu funguje** (čísla generovaná z kódu) | [reference/](reference/): [architecture (mapa kódu, formáty dat, jak přidat)](reference/architecture.md) · [mechanics (rejstřík mechanik)](reference/mechanics.md) · [combat](reference/combat.md) · [characters](reference/characters.md) · [items](reference/items.md) · [map](reference/map.md) · [places](reference/places.md) · [world](reference/world.md) · [quests](reference/quests.md) · [kauza](reference/kauza.md) · [storybook](reference/storybook.md) |
| UI konvence | [design/ui.md](design/ui.md) |
| formát changelogu | [CHANGELOG-FORMAT.md](CHANGELOG-FORMAT.md) |

Pravidla pro přispěvatele: [../AGENTS.md](../AGENTS.md). `reference/` je pravda o prototypu, `design/` je záměr; při rozporu platí kód.

Spuštění: otevři `prototype/index.html`. Testy: `node --test prototype/js/test/*.test.js` · simulace: `node prototype/js/sim.js 2000` · tabulky v `reference/`: `node prototype/js/gen-docs.js`.
