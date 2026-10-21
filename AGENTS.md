# Rules for contributors and agents

Project: a text-based web RPG, "Land of Machala". The HTML prototype in `prototype/` is a storybook (a playground), not a production base.

- Start with [docs/README.md](docs/README.md), then [docs/reference/architecture.md](docs/reference/architecture.md) and [docs/reference/mechanics.md](docs/reference/mechanics.md). `docs/reference/` describes how the prototype works today; if docs and code disagree, the code wins.
- The game, its texts, comments, commits and docs are in Czech. Code (names, keys) follows the style of its surroundings. Keep docs short and factual.
- Keep changes small and focused. Plain scripts: no ES modules, no build. Modules in `js/systems/` are pure UMD: no DOM, no `Math.random` (randomness comes from `rng`/seed).
- **No secrets and no real story** in this repository. The prototype contains only the demo.
- Verify: `node --test prototype/js/test/*.test.js` must pass; run `node --check` on changed `.js` files; if numbers or data changed, run `node prototype/js/gen-docs.js` and review `git diff docs/`. For combat: `node prototype/js/sim.js 2000`.
- Do not edit blocks between `<!-- gen:… -->` and `<!-- /gen:… -->` by hand; they are generated.
- No destructive git commands and no pushing without an explicit request. Commit messages use a conventional prefix (`feat`, `fix`, `docs`, `test`).
