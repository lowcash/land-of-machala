# Architecture (public)

Short map of the 2D prologue. Paths are under `2d/` unless noted.

## Layers

| Layer | Role |
|---|---|
| `app.js` + `index.html` + `styles.css` | state, screens, click handlers, prologue text |
| `js/systems/*.js` | pure rules (no DOM, no `Math.random`) |
| `js/data/*.js` | tables: classes, races, glossary (`kodex.js`) |
| `js/dev/scenarios.js` | storybook presets |

## Adding content

- New glossary term: `js/data/kodex.js` (`term`, `forms`, `short` = word meaning only, not plot).
- Do not put secret story truths in the client.

## Verification (contributors)

```
node --test 2d/js/test/*.test.js
node --check 2d/app.js
```

Play locally by opening `2d/index.html`, or use the [hosted demo](https://lowcash.github.io/land-of-machala/).
