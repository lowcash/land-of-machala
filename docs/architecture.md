# Architecture (public)

Short map of the prototype. Paths are under `prototype/` unless noted.

## Layers

| Layer | Role |
|---|---|
| `app.js` + `index.html` + `styles.css` | state, screens, click handlers, place prose |
| `js/systems/*.js` | pure rules (no DOM, no `Math.random`) |
| `js/data/*.js` | tables: items, enemies, origins, map, glossary (`kodex.js`), … |
| `js/dev/scenarios.js` | storybook presets |

## Adding content

- New item / enemy / origin: extend the matching file in `js/data/`, follow neighbouring shape, add a test if it changes a rule.
- New glossary term: `js/data/kodex.js` (`term`, `forms`, `short` = word meaning only, not plot).
- Do not put secret story truths in the client.

## Verification (contributors)

```
node --test prototype/js/test/*.test.js
node --check prototype/app.js
```

Play locally by opening `prototype/index.html`, or use the [hosted demo](https://lowcash.github.io/land-of-machala/).
