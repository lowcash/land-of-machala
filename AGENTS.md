# Pravidla pro agenty

Platí pro každého agenta i přispěvatele. Projekt: textová webová RPG „Land of Machala“, HTML prototyp ve `prototype/` je storybook, ne základ produkce.

- Nejdřív [docs/README.md](docs/README.md), pak [docs/reference/architecture.md](docs/reference/architecture.md) a [docs/reference/mechanics.md](docs/reference/mechanics.md). `docs/reference/` je pravda o prototypu; při rozporu platí kód.
- Česky: dokumentace, komentáře, texty ve hře, commity. Kód ve stylu okolí. Dokumentace věcně a stručně.
- Změny malé a cílené. Klasické skripty, žádné ES moduly ani build. Moduly v `js/systems/` jsou čisté UMD: bez DOMu, bez `Math.random` (náhoda přes `rng`/seed).
- **Žádné tajemství ani skutečný příběh** v repu. Prototyp obsahuje jen demo.
- Ověření: `node --test prototype/js/test/*.test.js` musí projít; `node --check` na změněné `.js`; změnila se čísla nebo data: `node prototype/js/gen-docs.js` a zkontroluj `git diff docs/`. Boj: `node prototype/js/sim.js 2000`.
- Negeneruj ručně bloky mezi `<!-- gen:… -->` a `<!-- /gen:… -->`.
- Žádné destruktivní git příkazy a push bez výslovného zadání. Commity česky s konvenčním prefixem (`feat`, `fix`, `docs`, `test`).
