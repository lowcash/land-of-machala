# Rules for contributors and agents

Project: a text-based web RPG, "Land of Machala". The HTML prototype in `prototype/` is a storybook (a playground), not a production base.

- Start with [docs/OVERVIEW.md](docs/OVERVIEW.md), then [docs/architecture.md](docs/architecture.md). If docs and code disagree, the code wins.
- **Public docs and README are English.** Dialogue and UI copy in the game are Czech. Keep public docs short.
- Keep changes small and focused. Plain scripts: no ES modules, no build. Modules in `js/systems/` are pure UMD: no DOM, no `Math.random` (randomness from `rng`/seed).
- **No secrets and no real story** in this repository. The prototype contains only the demo.
- Verify: `node --test prototype/js/test/*.test.js`; `node --check` on changed `.js` files.
- No destructive git commands and no pushing without an explicit request. Commit messages are **English**, Conventional Commits (`feat`, `fix`, `docs`, `test`).
