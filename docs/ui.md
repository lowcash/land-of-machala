# UI

One URL `/`. Shell + panels. Same features on desktop and phone. Clickable check: [`prototype/`](../prototype/). Record decisions here once we say “this is how it sticks.” Truths yes; HTML 1:1 no (production is Next + Postgres).

## Terms and flow

**Town** = safe services · **origin** = start situation · **prologue** = story choices before the summary screen · **explore** = directions out.

```
landing → auth → select_char ⇄ create_char → hub ←→ travel ←→ combat/event/camp
hub → panels: inv | char | bank | shop | quests | market
dead → hub (respawn) · sleeping → hub (morning)
```

In the prototype today: landing (private build) → prologue → character summary → town. The public demo skips landing and ends the morning after prologue.

## Shell and layout

```
.game-frame
  status-row (player | context)
  mid-stage (log [+ enemy sprite in combat only])
  dock-stack (L | R)
player-footer   ← full-bleed sibling (not inside max-width)
```

- `max-width: 72rem`, `--game-min: 20rem` (320 px), `--shell-w` ~38rem; boxes, log and dock share `--col-w`; footer full-bleed; background = light filter.
- Small screen (width < 768 or height ≤ 700): log keeps ~32 % height; dock shrinks and scrolls inside; empty sticky strip hides. No horizontal scroll from 320 px.
- Spacing only `--space-1…5`, `--gap`, `--stack`; children `margin: 0`; rhythm from parent `gap`; padding only inside components.
- Panels: Inventory · Character · Quests (tabs **Quests | Notebook**, Notebook after first rumour) · Map · Settings · FAQ/Terms. Overlay above the game, under the footer; pre-game = `is-fullscreen`; nested = `panelStack`.
- **Dismiss one level everywhere** (panels, equip, place: services/talk → hub → square; Esc the same). Sticky head, centred ×, tip clamp. Section labels left; chrome/progress centred.
- Footer: Character · Inv · Quests · Map · Menu. Dot on Quests (and Notebook tab) = new rumour since last Notebook open. Keys: one pref `hotkeys` (footer 1–5 + combat QWER…); hide the Settings row on touch.

## Landing, auth, prologue, character

- Landing: brand + 1 tagline + auth (`landing-auth-only`), vertically centred, no boxes or chronicle quotes. Footer: Settings · FAQ · Terms (fullscreen); FAQ = exclusive accordion. Auth alt = `btn-ghost`.
- `screenChrome()` for auth (“Account” + sub), prologue and Character; flow track segments; prologue = livelihood → region → bell → origin, then **Character**: summary + name, “Replay prologue”; manual tiles only from the storybook.
- Character: tiles, click again = deselect; no pick = pilgrim defaults. Dice = name only. Flash stats; origin shows an effects line from data.
- Legal (indie): account deactivation, 14-day restore, then delete.

## Game screen

**Character boxes:** L = HP/energy + ATK/DEF (gold is inventory / bank context). R = context / enemy. Travel stamina 🥾 ≠ combat resource.
**Context vs log:** coordinates / place name = context box; log = atmosphere without duplicate meta. Intent telegraph only in the log.
**Log:** `.scene` full-width; you L / foe R with delay; `fresh` only on the new side; fade mask top/bottom.
**Combat:** one list, attack up, survive/flee down. End = sprite gone + loot modal (manual claim). Enemy sprite only in combat.
**Action dock:** one `action-panel`, full scroll, sticky inside; story choices; important terms `.hl`.

| state | sticky top | body |
|---|---|---|
| Square | Explore | Machala sections (POI) |
| Place hub | Leave | talk / services / look |
| Service / talk | Back to main offer (+ log beat) | table / dialogue |
| Outskirts | Back to square | Where next |
| Combat | — | attack up, survive down |

Services ordered by priority; Back always sticky above scroll. Conversation: thread appends; exhausted topic = disabled “You already covered that”.

## Inventory, gear, map

- Inventory: fixed 4×4 (16 slots), DnD to a cell; equip from bag only, **no DnD**: click slot → centred popover (list → confirm).
- Map: footer 🗺, 7×7 fog/known/here, N/S/E/W, town (3,3) = 🏛, no teleport. “You are here” in `map-meta`.

## Settings, text, feedback

- Settings: in-game ☰; on landing, footer text. Account · language · sound; leaderboards nested; delete = type `SMAZAT` + 14-day deactivation.
- Glossary: `abbr.kodex` (dotted underline); hover/tap shows `short` in `#float-tip`; pref `kodex` (default on). Word meaning only — no plot.
- **Toast × log:** story/system events = lasting `log-bubble sys`; toast = small confirmations/errors. Never `alert()`.
- Version: `APP_VERSION` + `APP_YEAR`.

## Dev bar (storybook)

- Visible on `file:` / `localhost` (and `127.0.0.1`); elsewhere hidden. `?dev=1` always, `?dev=0` never; Ctrl+Shift+D toggles. Collapsed default: Scene · Reset · Detail · Systems.

## UI kit (prefer these before new chrome)

| component | variants |
|---|---|
| `btn` | `primary` · `ghost` · `back` · `action` · `link` |
| `screenChrome` | label ± arrows ± segs ± `sub` |
| `stat-icon` | tip / flash |
| `dock-ico` | footer quick actions |
| `pick-tile` | selected / toggle off |
| `panel` | sheet · fullscreen · nested stack |
| `log-bubble` | scene / you / foe / meta / sys |
| `itemTile` / bag-slot | browse; equip only on Character |
| `action-panel` | one column of choices |
