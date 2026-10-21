# UI

Jedna URL `/`. Shell + panely. Stejné funkce na desktopu i mobilu. Klikací ověření: [`prototype/`](../../prototype/). Do tohoto dokumentu zapisovat, až řekneme „takhle to drží“. Pravdy ano, HTML 1:1 ne (produkce Next + Postgres, tech.md).

## Pojmy a flow

**Město** = bezpečné služby · **původ** = tutorial voleb → class/race · **prolog** = příběhové volby před původem · **prozkoumat okolí** = směry ven.

```
landing → auth → select_char ⇄ create_char → hub ←→ travel ←→ combat/event/camp
hub → panely: inv | char | bank | shop | quests | market
dead → hub (respawn) · sleeping → hub (ráno)
```
Přechody jen přes Server Action + změnu `character.state` / otevřeného panelu.

## Shell a layout

```
.game-frame
  status-row (hráč | kontext)
  mid-stage (log [+ enemy sprite jen boj])
  dock-stack (L | R)
player-footer   ← full-bleed sourozenec (ne uvnitř max-width)
```
- `max-width: 72rem`, `--game-min: 20rem` (320 px), `--shell-w` ~38rem; boxy, log i dock sdílejí šířku `--col-w`; footer full-bleed; pozadí = lehký filtr.
- Malý displej (šířka < 768 nebo výška ≤ 700): log má garantovaných ~32 % výšky, dock se zmenší a scrolluje uvnitř; prázdný sticky pruh se skryje. Žádný horizontální scroll od 320 px.
- Spacing jen `--space-1…5`, `--gap`, `--stack`; děti `margin: 0`, rytmus dává parent `gap`, padding jen uvnitř komponent. Layout wrappery jsou essenciální.
- Panely: Inventář · Postava · Úkoly (záložky **Úkoly | Zápisník**, Zápisník až po první fámě) · Mapa · Nastavení (žebříčky vnořeně) · FAQ/Podmínky. Overlay nad hrou, pod footerem; pre-game = `is-fullscreen`; vnořené = `panelStack`.
- **Dismiss o 1 úroveň všude** (panely, equip, místo: services/talk → hub → náměstí; Esc stejně). Sticky head, × centrovaný, tip clamp. Labely sekcí vlevo, chrome/progress uprostřed.
- Footer: Postava · Inv · Úkoly · Mapa · Menu. Puntík u Úkolů (a na záložce Zápisník) = nová fáma od posledního otevření Zápisníku. Klávesy: jedna pref `hotkeys` (footer 1–5 + boj QWER…); na touch se řádek v Nastavení nezobrazuje.

## Landing, auth, prolog, původ

- Landing: brand + 1 tagline + auth (`landing-auth-only`), vertikálně na střed, bez boxů, kronik a citátů. Footer: Nastavení · FAQ · Podmínky (fullscreen); FAQ = exclusive accordion. Auth alt = `btn-ghost`.
- `screenChrome()` pro auth („Účet“ + sub), prolog a Postavu; sub copy *Vytvoř svého hrdinu* / *Vítej zpět*. Flow track 4 segy; prolog = 3 kroky + obrazovka **Postava** (rasa, povolání, původ).
- Postava: dlaždice, klik znovu = odznačení; bez volby = PILGRIM; do hry až rasa + povolání + původ. 5 ras, 4 povolání, 5 původů; dlaždice se zalomí. Kostka jen jméno. Flash staty; u původu řádek efektů z dat.
- Legal (indie): deaktivace účtu, 14 dnů obnovení, pak výmaz. Bez „stub“ úvodních tipů v legal/FAQ/původu.

## Herní obrazovka

**Boxy postavy:** L = HP/energie + ATK/DEF (zlato ne: měšec = inventář, banka = kontext banky). R = kontext / nepřítel. HP/energie jako ikona, ATK/DEF/🪙 jako chip; den/počasí také chip. Výdrž 🥾 (cesta) ≠ mana/energie (boj).
**Kontext vs log:** souřadnice/název lokace = kontext box; log = atmosféra bez duplicitního meta. Telegraph záměru jen v logu.
**Log:** `.scene` full-width; you L / foe R s delay (bez „Jméno:“), `fresh` jen nová strana; fade mask shora/zdola. Vstup na místo = prose + greeting; rozhovor/služby otevřou beat hned.
**Boj:** jeden seznam, útok nahoře, přežití/útěk dole. Konec = sprite pryč + loot modal; hráč claimne ručně a odejde (bez auto-timeoutu). Enemy sprite jen v boji, bez stínového obdélníku. Inventář v boji lze prohlížet.
**Akční dock:** jeden `action-panel` (bez lane wrapperů), scrolluje celý, sticky uvnitř; větné volby, důležité pojmy `.hl`; potion = text + ikona 🧪. Mapa jen ve footeru.

| stav | sticky nahoře | tělo |
|---|---|---|
| Náměstí | Prozkoumat okolí | sekce Machala (POI) |
| Místo hub | Opustit ven | rozhovor / nabídka / look |
| Služba / talk | Zpět k hlavní nabídce (+ log beat) | tabulka / dialog |
| Okolí | Zpět na náměstí | Kam dál |
| Boj | — | útok nahoře, přežití dole |

Služby řazené podle priority (heal / prodat·koupit·opravit / …), Zpět vždy sticky nad scrollem, scroll se pamatuje jen ve stejném `laneStateKey`. Místo R je prázdné, dokud L neotevře rozhovor. Konverzace: thread se přidává, nabídka L se mění, vyčerpané téma = disabled „Už jste to probrali“, follow-up hint navazuje. Akční labely: hub = Náměstí / Služby; exits = Ve městě / V krajině + Kam dál. Nabídka: grid 3 sloupce.

## Inventář, výzbroj, mapa

- Inventář: pevný grid 4×4 (16 slotů), DnD na konkrétní buňku, limit kg; typ slotu = tón pozadí, rarita = barva textu. Loot lead jen `+zlato` / `+XP`. Equip jen z batohu, **bez DnD**: klik na slot → popover uprostřed, 2 úrovně (list → confirm). Talenty vedle výzbroje (desktop); dovednosti = sekce v Postavě.
- Mapa: footer 🗺, grid 7×7 fog/known/here, pohyb N/S/E/W, město (3,3) = 🏛, bez teleportu. „Jsi zde“ vždy v `map-meta`, buňky mají title tooltip.

## Nastavení, texty, zpětná vazba

- Nastavení: ve hře ikona ☰, na landingu text ve footeru. Účet · jazyk · zvuk (slidery); žebříčky = tabulka v panelu; odhlásit jen ve hře; odkazy 1×3; smazání = `SMAZAT` + deaktivace 14 dnů. Nested (Nastavení → Žebříčky): spodní sheet s blur underlay.
- Kodex: `abbr.kodex` (tečkované podtržení) v logu; hover/tap ukáže `short` v `#float-tip`; pref `kodex` (Nastavení → „Nápovědy ke slovům“, výchozí zapnuto). Tooltip `#float-tip`. 🪙 *Cena* (obchod) · *Měšec* (hráč). Quest odměny jednotně **Odměna**. Manuál = FAQ. Prolog text = `.prose-beat`.
- **Toast × log:** důležité události příběhu a systému (fáma, ověření, verdikt, přijetí / splnění / odevzdání úkolu, úroveň, lhůta) = trvalá řádka `log-bubble sys` v aktuálním vlákně (`logSys`); toast jen drobné potvrzení a chyby (equip, nedostatek zlata, „nejde“) a krátký odznak, když je přes log panel. Toast vpravo nahoře: doba = clamp(3,5 s; 45 ms × znaků; 9 s), hover/touch pauza, klik zavře, max 3. Nikdy `alert()`.
- Verze: `APP_VERSION` + `APP_YEAR`. XP z boje i questů; zlato = měšec / banka.

## Dev lišta (storybook)

- Viditelná na `file:` / `localhost` (a `127.0.0.1`); jinde skrytá. `?dev=1` vždy, `?dev=0` nikdy; Ctrl+Shift+D přepíná a ukládá `lom.dev`. Skrytá = bez `has-dev`, bez horní mezery (`--dev-pad: 0`).
- Sbalená (výchozí): Scéna · Reset · Detail · Stav systémů. Rozbalený Detail: sekce Postava / Svět / Boj / Ladění (knoby + přepínače); stav v `lom.devBarCollapsed` (JSON: `collapsed` + `sections`).

## UI kit (nové UI nejdřív z tohoto seznamu)

| komponenta | varianty |
|---|---|
| `btn` | `primary` · `ghost` · `back` · `action` · `link` |
| `screenChrome` | label ± šipky ± segs ± `sub` |
| `stat-icon` | tip / flash |
| `dock-ico` | footer rychlé volby |
| `pick-tile` | selected / toggle off |
| `panel` | sheet · fullscreen (pre-game) · nested stack |
| `log-bubble` | scene / you / foe / meta / sys |
| `itemTile` / bag-slot | prohlížení; equip jen v Postavě |
| `action-panel` | jeden sloupec voleb |
