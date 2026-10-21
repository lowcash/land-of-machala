# Questy

Stav: **skutečné** (`prototype/js/systems/quests.js`, data `js/data/quests.js`, testy `js/test/quests.test.js`). Tabulka se generuje (`node prototype/js/gen-docs.js`). Jsou to 3 zkušební questy, ne příběh: slouží k ověření mechaniky.

## Životní cyklus

`available` → (přijmout u zadavatele) `active` → (všechny cíle splněny) `ready` → (odevzdat) `done`.

- **Přijmout:** u zadavatele po příslušné otázce v rozhovoru se objeví „Přijmout úkol“. Quest s vydanou věcí (dopis) vyžaduje místo v batohu.
- **Cíle:** `kill` (druh + terén; zabití jinde se nepočítá; počítá se jen vítězství), `have` (předmět v batohu; **přepočítává se**, ztráta věci vrátí quest z `ready` do `active`), `arrive` (políčko mapy).
- **Odevzdat:** u příjemce (místo ve městě, nebo políčko na mapě). Podruhé nejde. Odměna: zlato, XP (může dát úroveň), předměty; „spotřebuje“ předměty (chléb, dopis). Plný batoh bez místa na odměnu = odmítnuto.
- **Volby:** některé questy se odevzdávají s volbou; volba nastaví **flag** s dopadem na svět (dnes: cena noclehu u Svatavy).
- **Zrušit:** quest se vrátí do nabídky, vydané věci se z batohu odeberou. Věc, která leží v corpse, se znovu nevydá.
- **Smrt:** questové předměty jdou do corpse jako vše ostatní, nezmizí a nevydají se znovu; quest zůstane aktivní.

## Značky na mapě (questhelper)

Mapa a panel Úkoly ukazují: ❗ nabídka (město) · ❓ odevzdat · 📍 cíl příchodu · ▨ oblast úkolu (terén pro zabíjení) · 💀 věc z questu leží v těle. Pod mapou je seznam poznámek se souřadnicemi.

## Přehled questů

<!-- gen:quests -->
| id | název | nabízí | odevzdat | cíle | odměna |
|---|---|---|---|---|---|
| `wolves_outside` | Vlci za hradbami | Lidmila (healer) po otázce `help` | Lidmila (healer) | zabít 2× `wolf` v terénu `forest` | 25 🪙, 40 XP, Kalný odvar |
| `bread_for_uda` | Kůrka pro Svatavu | Svatava z Přívozu (tavern) po otázce `bread` | Svatava z Přívozu (tavern) | mít 1× `ration` | **Dát chléb Svatavě**: 20 XP (flag `svatava_friend`)<br>**Chtít za chléb zaplatit**: 15 🪙, 8 XP (flag `svatava_haggled`) |
| `letter_to_lada` | Dopis do Lady | Gertruda (bank) po otázce `letter` | písař v Ladě, políčko 3,0 | mít 1× `letter`; dojít na 3,0 | 30 🪙, 30 XP |
<!-- /gen:quests -->

Flagy: `svatava_friend` → nocleh 10 🪙 · `svatava_haggled` → nocleh 25 🪙 (základ 20).

## Nedořešeno

- Příběh určí, jestli budou řetězené questy, vyjednávání, časový limit, selhání (smrt zadavatele, uplynulý čas).
- Obnova zabitých cílů: místa se obnovují po dni, takže počet vlků je jen otázkou času; zvážit, jestli má mít quest cílené doupě.
- Poznámky hráče na mapě (vlastní značky) nejsou; značky jsou jen z questů a těla.
