# Postava — staty, rasy, povolání

Stav: skutečné (`prototype/js/data/characters.js`, `statsNow()` v `app.js`). Tabulky se generují (`node prototype/js/gen-docs.js`).

## Klíče

Uložení nemá migrace: jen aktuální `SAVE_VERSION`, starší se tváří jako žádné. Klíče povolání: `mercenary`, `tracker`, `chanter`, `legist`; kmeny / kraje: `local`, `saltfolk`, `woodfolk`, `riverfolk`, `hillfolk`.

## Odvozené hodnoty

| hodnota | vzorec |
|---|---|
| max HP | `40 + VIT·2` |
| ATK | `STR + bonus výbavy` (STR roste s úrovní podle povolání) |
| DEF | `⌊VIT·0,5⌋ + bonus výbavy` |
| zdroj | max podle povolání (energie / mana) |
| výdrž na cestě | 14, −1 za krok, doplní se ve městě (nezávislá na boji) |

Bez volby povolání/rasy platí **poutník** (6/6/6/6), rasa/povolání přičtou odchylky.

## Povolání (4)

<!-- gen:classes -->
| povolání | STR | DEX | VIT | INT | zdroj | max zdroj |
|---|---|---|---|---|---|---|
| `poutník (bez volby)` | 6 | 6 | 6 | 6 | energie | 12 |
| `mercenary` | 9 | 5 | 8 | 4 | energie | 14 |
| `tracker` | 6 | 9 | 6 | 5 | energie | 12 |
| `chanter` | 4 | 5 | 5 | 10 | mana | 16 |
| `legist` | 5 | 5 | 6 | 8 | energie | 12 |
<!-- /gen:classes -->

Speciál v boji: pacholek Úder štítem (ATK), dřevorubec Přesná střela (DEX×1,45), bylinkář Zaříkání (INT×1,3; text nepotvrzuje kouzlo), písař Důrazná výtka (INT×1,1). Povolání čtou typ fám (`classTag`): `people` / `tracks` / `omen` / `paper` — viz [kauza.md](kauza.md).

## Rasy (5)

<!-- gen:races -->
| rasa | STR | DEX | VIT | INT |
|---|---|---|---|---|
| `local` Zdejší | 0 | 0 | 1 | 0 |
| `saltfolk` Solníci | 1 | -1 | 1 | 0 |
| `woodfolk` Slatiňané | -1 | 1 | 0 | 1 |
| `riverfolk` Brodáci | 0 | 1 | 1 | -1 |
| `hillfolk` Pasečané | 1 | 1 | 0 | -1 |
<!-- /gen:races -->

Součet odchylek každé rasy = **+1**. Rasa přidává bonus k jistotě fámy (`raceTag`, +0,05), když typ fámy sedí — sčítá se s bonusem povolání (+0,12), strop 0,9.

## Původy (5)

Třetí volba na obrazovce **Postava**. Mění start (místo/zlato/vztahy), ne boj. `state.origin` + `state.standing`; ceny přes `trustOf(k, npc, standing)`. Dlužník má seed fámu (`hearClaim`) v Zápisníku bez spuštění lhůty (`armDeadline: false`).

<!-- gen:origins -->
| id | název | start | zlato | banka | věc | standing | výdrž |
|---|---|---|---|---|---|---|---|
| `debtor` | Dlužník | místo `tavern` | 30 | 0 | — | `gertruda` -1, `brigand` +1 | — |
| `apprentice` | Učeň kováře | místo `smith` | 60 | 20 | `gloves` | `karel` +2 | — |
| `watchman` | Bývalý strážný | místo `gate` | 70 | 0 | — | `petr` +2, `svatava` +1 | — |
| `wayfarer` | Poutník z Brodu | buňka (3,2) | 100 | 0 | — | — | +2 |
| `exile` | Vyhnanec | buňka (2,5) | 15 | 0 | — | `petr` -1, `brigand` +1 | — |
| `native` | Rodák | místo `market` | 40 | 0 | — | `svatava` +1, `karel` +1, `gertruda` -1 | — |
<!-- /gen:origins -->

## Postup

Za XP se stoupá v úrovních (viz [world.md](world.md)); žádné dovednosti ani talenty (UI „Dovednosti“ je jen zástupná sekce).
