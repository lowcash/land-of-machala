# Architektura prototypu

Stav: **skutečný** (ověřeno proti kódu). Prototyp je storybook, ne základ produkce ([../README.md](../README.md), ../design/tech.md). Mechaniky v přehledu: [mechanics.md](mechanics.md). UI konvence: [../design/ui.md](../design/ui.md) (zde se neopakují).

## Soubory

Cesty od `prototype/`. **Čisté** = bez DOMu, bez `Math.random`, jde je testovat v Node.

- `index.html` skelet obrazovek (`data-screen`), dev lišta, `#panel`, `#toast-host`, skripty.
- `app.js` (~5400 řádků) **nečisté**: `state`, render, události, panely, dialogy a **obsah míst** (`PLACE`, `PLACE_ASK`, `PLACE_BEATS`), služby, hooky kauz a questů, drag&drop, dev storybook (`applyScenario`).
- `styles.css` vše vzhledové.
- `js/rng.js` čisté, `createRng(seed)` (mulberry32: `next`, `chance`, `int`, `pick`, `weighted`).
- `js/data/` čistá data: `enemies.js`, `characters.js` (povolání, rasy), `origins.js` (původy), `items.js`, `map.js` (mřížka 7×7, POI, `terrainAt`), `quests.js`, `kauzy.js`, `names.js` (fondy jmen), `kodex.js` (hesla nápověd).
- `js/systems/` čistá pravidla s testy: `combat.js`, `world.js` (čas, místa setkání, XP, smrt a corpse), `quests.js`, `kauza.js`, `variants.js`, `stash.js`, `names.js` (`LOM.Names`), `kodex.js` (`LOM.Kodex`), `save.js` (`LOM.Save` — serializace uložené hry).
- `js/ui/combat-text.js` události boje → české řádky (žádná pravidla, testované jen zčásti).
- `js/dev/scenarios.js` storybook: `SCENARIOS`, `KNOBS`, `TOGGLES`, `SYSTEMS` (stav systémů v dev liště). Čistý, ale používá ho jen dev.
- `js/sim.js` simulace boje botů; `js/gen-docs.js` plní bloky `<!-- gen:x -->` v `docs/reference/`.
- `js/test/*.test.js` testy (`node --test`). `app.js` testy nemá.

## Načítání a UMD

Klasické `<script>`, žádné ES moduly, žádný build. Pořadí v `index.html` je závislostní a **záleží na něm**: `rng` → `data/*` (enemies, characters, origins, items, map, quests, kauzy, names, kodex) → `systems/*` (combat, world, quests, kauza, origin, variants, stash, names, kodex, save; `stash` bere `Variants.hash`) → `ui/combat-text` → `dev/scenarios` → `app.js`.

Každý modul je UMD: `(function (root, factory) { … })` → v Node `module.exports`, v prohlížeči `Object.assign(root.LOM, api)`. Závislosti si bere přes `require`, nebo z `root.LOM`. Výjimky jmenného prostoru: `LOM.Quests`, `LOM.Kauza`, `LOM.Variants`, `LOM.Stash`, `LOM.Names`, `LOM.Kodex`, `LOM.Save` (objekty); ostatní exporty jsou přímo na `LOM` (`LOM.createCombat`, `LOM.buildSpots`, `LOM.ENEMIES`, `LOM.INVENTORY`, `LOM.KAUZY`, `LOM.QUEST_BY`, `LOM.SCENARIOS`, `LOM.KODEX`…). Nový modul = přidat `<script>` na správné místo a do testů `require`.

## Stav

`makeState()` vrací celý `state` (globální `const`, `app.js`). Hlavní pole a kdo je mění:

- **obrazovka a UI**: `screen` (landing, origins, confirm, town, combat), `mode` (town | place | exits), `place`, `placeView` (hub | talk | services | stash | people), `panelStack`, `panelTab`, `cellMenu`. Mění `setScreen`, akce v click handleru.
- **postava**: `picks`, `level`, `xp`, `xpNext`, `hp` (`null` = plné), `gold`, `bank`, `bag` (16 slotů, id nebo `null`), `equipped` (sloty), `travel` (výdrž na cestě). Staty se **nikdy neukládají**, počítá je `statsNow()` z povolání, rasy, úrovně a výbavy.
- **svět**: `mapX`, `mapY`, `discovered`, `clock {day,tick}`, `seed`, `steps`, `spots` (líně z `buildSpots`), `encounter`, `corpses`, `corpseSkip`, `piles`, `stash`, `pileSeq`.
- **boj**: `combat` (objekt z `createCombat` + `turns`, `busy`, `claim`, `spotId`, `camp`), `kills` (po druzích), `flags` (následky voleb, `spared:<id>`).
- **příběh**: `quests` (log), `kauza` (vzniká líně v `kauzaState()` ze `seed`), `kzReply`, `notebookNew`.
- **dialog**: `placeThread`, `cellThread` (vlákna logu), `placeWho`, `placeTalkPath`, `placeTalkDone`, `visits`, `vc` (čítače variant vět).
- **dev**: `dev` (přepínače), `activeScenario`. `audio` a `prefs` jdou do `localStorage` (`lom.prefs`).
- **uložená hra**: `js/systems/save.js` (`LOM.Save`) serializuje whitelist herních polí do JSON `{ v, savedAt, data }` (aktuálně `v: 4`). Bez migrací: jiná verze než aktuální se tváří jako žádné uložení. Ukládá postavu, batoh/výbavu, zlato/banku, polohu a mapu, čas, HP, questy, kauzu, flagy, kills, piles, stash, corpses, seed, spots, dialogové čítače a vygenerované lidi. **Neukládá** UI (panely, vlákna logu, flash, potvrzení), `combat` (reload = konec boje), `audio`/`prefs` (zvlášť), `kodexSeen`/`kodexCache`, `dev`. `Set` (`usedNames`) → pole. Chybějící pole se při načtení doplní výchozími. Klíč: `lom.save`. Čtení/zápis `localStorage` a UI tlačítka patří do `app.js` (modul je čistý), viz [Ukládání](#ukládání-appjs).

Pravidla mění `state` jen přes volající: `systems/*` dostanou kus stavu (`c`, `k`, `log`, `piles`) a mutují ho na místě, nebo vrací výsledek a `app.js` ho aplikuje (zlato, batoh, flagy).

## Scéna, seed, determinismus

- `applyScenario(id, knobs)`: najde scénu, přepíše pole knoby, **zahodí celý `state`** a postaví nový z `makeState()` (zachová `audio`, `prefs`, `dev`). Pak postupně: `seed`, `picks`, `level`/`xp`, `gold`, `bank`, `bag`, `clock` (`day`, `phase`), poloha `at`, `strip`, `corpse`, `encounter`, `hpPct`, `bagAdd`, `spots`, `quests`, `piles`, `stash`, `kauza` (`variant`, `heard`, `verified`, `forgeSeen`, `trust`), `questRefresh()`, reset panelů a vlákna; nakonec větev podle `view` (boj, úvod, prolog, místo, mapa). Stejná scéna + stejné knoby = stejný stav.
- Seed (`state.seed`) určuje: **místa setkání** (`cellSeed(seed,x,y)` → `buildSpots`), **souboj na místě** (`spotFightSeed(seed,spot,day)`: stejné místo ve stejný den = stejný souboj), **variantu kauzy** (`seed % 3`) a **signály NPC**, **rozkradení hromádek** (`rollFor(seed,pile)`), **varianty vět** (`Variants.pick(text,seed,klíč,n)`), **přítomnost osob** (`hash(seed,"here:…:den")`), **obcházení** (`worldRng()` = seed + počet hodů).
- Pravidla v `systems/` nikdy nevolají `Math.random`; berou `rng`/seed. **Mimo determinismus** je jen `app.js`: výchozí seed (`Date.now`), seed boje bez místa (dev tlačítko Boj), `randomName`, drb v hospodě (`RUMORS`).

## Hlavní toky

- **Render**: `render()` volá `syncDevPad`, `syncNotebookDot`, **hooky** `questRefresh()` (přepočet `have` cílů, ohlásí splnění) a `kauzaTick()` (lhůta → automatický verdikt), pak podle `screen` překreslí město (`renderTownActions`, `setLog`) nebo boj (`renderCombat`). Hooky smí volat `logSys`, protože ten `render` nevolá.
- **`renderTownActions()`** složí spodní dock podle `mode` a `placeView`: náměstí (`placeBtn` pro 7 míst), místo (hub, rozhovor, služby, úschovna, lidé), mapa (směry, `kauzaCellButtonsHtml`, `pileButtonsHtml`, `questCellButtonsHtml`, setkání). Tlačítka mají `data-act`, jediný click handler na `document.body` je rozdělí podle `act`.
- **Panely**: `openPanel(kind, opts)` (`character`, `inventory`, `quests` se záložkami quests | notebook, `map`, `settings`, `ranks`, `legal`). `pushFrom` skládá panel nad panel (`panelStack`), `Esc` / klik mimo = o úroveň zpět (`closePanelStep`).
- **Log**: `setLog(html)` jen zapíše HTML do `#town-log` nebo `#combat-log`. Město skládá `townLogHtml(prose, vlákno)`; vlákno místa je `placeThread` (max 10 položek, `pushPlaceTurn`), na mapě `cellThread` (max 6, `kzSay`). Položka `{ you, foe, scene, sys, fresh }`. V boji `combat.turns` a `renderCombatLogHtml`.
- **`logSys(html, icon)`**: důležitá událost = trvalá řádka `sys` ve vlákně podle kontextu (boj, místo, mapa). Pokud nelze (jiná obrazovka) nebo je přes hru panel, přidá navíc toast. **Toast** (`toast`, `toastHtml`) je jen drobné potvrzení a chyba ([../design/ui.md](../design/ui.md)).
- **Dialog**: `PLACE_BEATS[place]` = věty vstupu a odchodu. `PLACE_ASK[place]` = strom uzlů; `place-ask` zapíše otázku hned, odpověď po `DIALOG_DELAY_MS` (520 ms) a jen pokud je hráč pořád v rozhovoru. Uzel odpovězený jednou zmizí (`placeTalkDone`), s `children` se hráč zanoří (`placeTalkPath`). `people` mají vlastní `talk`. `claim` uzlu zavolá `kauzaHear`, takže odpověď je věta z kauzy, ne `ans`. Po rozuzlení fámy přibude uzel „Vrátit se k věci“ (`kauzaFollowNodes`).
- **Služby**: `placeServicesHtml(place)` vykreslí `PLACE[place].services` (filtr `when()`), cenu dává `servicePrice(place, s)` (základ, volby questů, důvěra z kauzy, poplatek banky), tlačítko pošle `data-act="svc"` → `runService(id)` (jedna velká větev podle `state.place`). Nová služba bez větve v `runService` je **maketa**.
- **Boj**: `startCombat` → `createCombat`; `combatTurn(move)` → `resolveTurn`, odpověď nepřítele se zobrazí po 520 ms (`c.busy`); konec `endCombat` (odměna, XP, vyčištění místa, `questEvent("kill")`, loot okno), `leaveCombat` (při `lose` → `dieAndRespawn`).
- **Čas** se posouvá v `moveMap` (1 tik), `endCombat` (2), spánek (`toMorning`), zakopání, vykopání, znamení; `dieAndRespawn` (+4).

## Formáty dat

**Místo** (`PLACE`, `app.js`):
```js
tavern: { title: "Hostinec U Přívozu", npc: "Svatava z Přívozu", role: "hostinská", line: `U ${hl("Svatavy")} teče pěna`, hint: "vejít do hostince", bg: "tavern",
  prose: ["Smích a pěna.", "Krb praská."],            // string | pole variant
  greeting: [`„Co bude?“`, `„Zase ty.“`],
  people: [ /* osoby, viz níže */ ],
  services: [{ id: "rest", name: "Spát", desc: "Heal", price: 20, when: () => true }] }
```
`line` je věta na náměstí (tlačítko), `hint` podtext. `desc` nebo `descHtml: () => …`. `price: 0` = bez ceny.

**Uzel dialogu** (`PLACE_ASK[place]`, `people[].talk`):
```js
{ id: "rumors", title: `Zeptat se na ${hl("drby")}`, hint: "fámy u stolu",
  ask: `„Co se šeptá u stolu?“`, ans: [`„V noci štěkali psi.“`, `„Nic.“`],   // věty smí být pole
  claim: "c1",              // volitelně: odpověď je věta fámy z kauzy
  when: () => kauzaStarted(),  // volitelně: podmínka zobrazení
  children: [ /* vnořené uzly */ ] }
```

**Osoba na místě** (`people`): `{ id, name, role, when: { phases: ["evening","night"], chance: 0.5 }, greeting, bye, talk: [uzly] }`. Hostitel (`npc`) je vždy první; `when.chance` se hází ze seedu a dne.

**Varianta věty**: kdekoli text, smí být pole řetězců. Klíč je `typ:místo:osoba`. `pickV` je čisté (render), `sayV` zvedá čítač `state.vc` (jen z obsluhy akcí). Nikdy stejná dvakrát po sobě. Věty fám (`claim.line`) **musí zůstat jedna**.

**Quest** (`js/data/quests.js`):
```js
{ id: "wolves_outside", title: "Vlci za hradbami",
  giver: { place: "healer", after: "help", npc: "Lidmila" },   // after = id uzlu, po kterém se nabídne Přijmout
  turnIn: { place: "healer", npc: "Lidmila" },                  // nebo { cell: [3,0], npc }
  brief: "…", giveItems: ["letter"],                          // volitelně
  objectives: [{ id: "wolves", type: "kill", enemy: "wolf", terrain: "forest", count: 2, text: "…" }], // kill | have | arrive
  consume: ["ration"],                                         // odebere se při odevzdání
  reward: { xp: 40, gold: 25, items: ["potion"] } }            // nebo choices: [{ id, label, hint, reward, flags }]
```

**Kauza** (`js/data/kauzy.js`, jediná: `zvon`):
```js
zvon = { id, title, brief, deadline: { days: 5, text },
  classTag: { mercenary: "people", tracker: "tracks", chanter: "omen", legist: "paper" },
  raceTag: { local: "paper", saltfolk: "people", woodfolk: "tracks", riverfolk: "omen", hillfolk: "tracks" },
  npcs:  { svatava: { name, rel: 0.45, tell: 0.7, signals: { a, b }, after: {…}, react: { believe: […], doubt: […] } } },
  variants: { A: { label, epilog }, … },                       // varianta ze seedu
  claims: { c1: { by: "svatava", tag: "tracks", place: "tavern", text, line,
                  truth: { A: "half", B: "half", C: "false" },  // true | half | false | none
                  verify: { via: "cask", where, texts: { half, false } }, contradicts: ["c6"] } },
  replies, follow, afterDefault,                               // věty hráče a NPC po rozuzlení
  verdicts: { return: { label, at: "chapel", needs: { bell: true }, hint, effects: { trust: { anicka: 2 }, gold, flags }, consumeBell, epilogue } },
  open: "…" }
```
`rel` = výchozí jistota zdroje, `tell` = šance signálu při `half`/`false`, `verify.via` = `cask` | `cart` | `forge` | `clerk` | `night`.

**Scéna** (`js/dev/scenarios.js`): `{ id, group, label, note, seed, view, at: [x,y], phase, day, picks, level, xp, gold, bank, bag: "full" | [id…], bagAdd, hpPct, corpse, strip, encounter, fight: { enemy, enemyHpPct, loot }, spots: [{x,y,enemy,when}], quests, variant, kauza: { heard, verified, startDay, forgeSeen, trust }, piles, stash, placeView }`. Hlavička souboru popisuje pole.
**Knob**: `{ id, label, opts: [[hodnota, popisek]], from: (sc) => hodnota, apply: (sc, hodnota) => … }`; `apply` přepíše pole scény, změna postaví scénu znovu.

**Mapa** (`js/data/map.js`): `MAP_SIZE` 7, `GRID` (řádky y=6…0), `POI` (town, village, chapel, forge, cart), `TERRAIN_CS`, `TERRAIN_BG`, `terrainAt(x,y)`, `cellLabel(x,y)`. Pravda o terénu: [map.md](map.md).

**Předmět** (`js/data/items.js`): `{ id, icon, name, tip, slot, atk?, def?, weight, rarity, quest? }`; kategorie plyne ze `slot`. `quest: true` = nikdy nezmizí z corpse, nerozkradne se.
**Nepřítel** (`js/data/enemies.js`): `{ id, name, level, type, hp, def, dmg: { heavy, quick, guard }, tactics: { weights: {heavy, quick, guard}, adapt, feint }, surrenderAt?, reward: { gold: [lo,hi], xp, loot: [{ id, p }] } }`.
**Původ** (`js/data/origins.js` + `systems/origin.js`): `{ id, label, icon, blurb, start: { place } | { cell: [x,y] }, gold, bank, item?, standing: { npcId: −2…+2 }, energyBonus?, hearClaim?, greet: { placeId: string[] }, intro, effectsLine }`. `Origin.apply(state, id)` → patch; `null`/neznámý id = bez efektů. Standing se sčítá s důvěrou kauzy v `Kauza.trustOf`.

**Jména** (`js/data/names.js` + `js/systems/names.js`): fondy křestních (`NAME_POOLS`: staročeská ~50 %, německá / jižní / církevní / zvláštní), příjmení (`SURNAMES`: řemeslo, vlastnost, místo, otec), přezdívky, ticy, posedlosti, signály. `Names.makeName(rng, { pool?, gender?, used? })` → `{ first, last, nick, full, pool, gender }`; `Names.makeRegular(rng, ctx)` → `{ name, tic, obsession, truthfulness (0–1), signal, stance: { side, lean } }` (`side`: rada|zastava|farnost|cech, `lean`: pos|neg|none). Bez DOMu; náhoda jen přes `rng`.

**Kodex** (`js/data/kodex.js` + `js/systems/kodex.js`): hesla `{ id, term, forms[], short, more?, kind }`. `Kodex.annotate(html, seenSet, { prefs? })` obalí první výskyt (i skloňování) do `<abbr class="kodex" data-kodex="id">`, nikdy v tagu/atributu/už obaleném; `Kodex.markSeen(set, id)`; `Kodex.enabled(prefs)` (`prefs.kodex !== false`).

**Napojení v `app.js`**: `setLog` prožene každý `<p>` logu přes `kodexLog` (anotace jednou na řádek, výsledek v `state.kodexCache`, viděná hesla v `state.kodexSeen`; obojí jen v paměti, scéna je maže). Tooltip bere `short` z `KODEX_BY` a jde přes `showFloatTip`; hover jen myší, na dotyku tap přepíná. Osoby s `generated: true` v `PLACE[].people` (Štamgast) dostanou jméno z `Names.makeRegular` (seed = `state.seed` + místo + den, `regularOf`, cache `state.regulars`, unikátnost `state.usedNames`); `randomName` zůstává jen pro jméno hráče.

## Jak přidat

Po každé změně: `node --test prototype/js/test/*.test.js`, `node --check prototype/app.js` (a změněné `js/…`), `node prototype/js/gen-docs.js`, u UI smoke v prohlížeči (níže).

- **Místo**: záznam v `PLACE`; `PLACE_BEATS[id]`; `PLACE_ASK[id]`; `looks` v `place-look`; větev `if (p === "id")` v `runService`; `placeBtn("id")` v `renderTownActions` (náměstí); `PLACE_VIEWS` (`applyScenario`); `BG` + `resources/locations/placeholder/<bg>.svg`; volba v `KNOBS.view` (`scenarios.js`); scéna; řádek v [places.md](places.md).
- **NPC (osoba na místě)**: objekt do `people` místa (`when`, `greeting`, `talk`). Bez dalších změn se objeví v „Rozhlédnout se po lidech“.
- **Uzel dialogu**: položka v `PLACE_ASK[místo]` (nebo `children`); unikátní `id` v rámci místa. Chceš-li nabídnout quest, `id` musí sedět s `giver.after`.
- **Fáma do Zvonu**: NPC do `npcs` (je-li nový); fáma do `claims` (`truth` pro A, B, C; `verify`); uzel s `claim` v `PLACE_ASK` místa fámy; ověření `clerk` = služba `lookup_*` na radnici + `LOOKUP_CLAIM` v `app.js`; `cask` / `cart` / `forge` / `night` mají pevné akce v `kauzaCellAct` (nebo služba u Svatavy). Tabulky v [kauza.md](kauza.md) se přegenerují. **Druhá kauza** vyžaduje změny v `app.js` (viz dluhy).
- **Quest**: záznam v `quests.js`, uzel `giver.after` v `PLACE_ASK`, případně `QUEST_PRESETS` ve scénáři, test v `quests.test.js`.
- **Původ**: záznam v `origins.js` (po `gen-docs` je v [characters.md](characters.md)); scény `origin-*` v `scenarios.js`; test `origin.test.js`. UI: accordion na obrazovce Postava + `Origin.apply` při `start-game`.
- **Předmět**: záznam v `items.js` (po `gen-docs` je v [items.md](items.md)); chceš-li ho prodávat, služba v `PLACE.services` a větev v `runService` (`buyItem(id, cena)`).
- **Nepřítel**: záznam v `enemies.js`; člen poolu v `POOLS` (`world.js`), jinak se nikde nevyskytne; texty `ENEMY_INTRO`, `ENCOUNTER_TEXT`, `SIGN_TEXT` v `app.js`; id do seznamu v `enemyImg` + SVG v `resources/enemies/placeholder/`; volby v `KNOBS.enemy` a `KNOBS.encounter`; `sim.js` a bloky v `gen-docs.js` mají seznam nepřátel natvrdo; ověř `node prototype/js/sim.js`.
- **Scéna**: položka v `SCENARIOS` (skupina = existující `group` nebo nová); nové pole scény musí číst `applyScenario`; `gen-docs` přegeneruje [storybook.md](storybook.md); do `TOUR` jen zásadní.
- **Skript `save.js`**: po `stash` / před `ui/` v `index.html`; namespace `LOM.Save`.

### Ukládání (`app.js`)

- **Klíč** `lom.save` (`LOM.Save.STORAGE_KEY`), jedno uložení na prohlížeč. Čtení/zápis `localStorage` je vždy v `try/catch`; selhání = hra běží dál bez ukládání. Poškozené nebo novější uložení se tváří jako žádné (tlačítko Pokračovat se nenabídne).
- **Kdy se ukládá**: `render()` naplánuje `saveGame` (debounce 300 ms, `SAVE_DEBOUNCE_MS`), plus okamžitě při `pagehide` a skrytí karty. Jen když `screen === "town"` (město, místo, mapa).
- **Kdy ne**: `landing`, `origins`, `confirm`, `combat` (po reloadu platí poslední uložení z města, tedy před bojem; dokončený boj se uloží až po návratu do města), dev scéna (`state.activeScenario`) a po skoku z dev lišty (`state.noSave`). Dev nástroje tak nepřepíšou reálné uložení.
- **Pokračovat**: na úvodu `syncContinue` ukáže tlačítko (jméno, úroveň, povolání), je-li `readSave()` platné. `continueGame` složí `state` z `makeState()` + uložených polí (`resetState`), zahodí neznámá id předmětů a neexistující místo, nastaví `combat = null`, `placeView = "hub"`, vlákna logu prázdná a vstoupí do města (`placeProse`). UI (`kodexSeen`, panely, flash) začíná od nuly; `spots` se při `null` postaví líně ze `seed`.
- **Nová hra** neničí uložení: první klik na „Vstoupit do hry“ při existujícím uložení jen upozorní (potvrzení), druhý klik začne čistou postavu (`resetState`) a první auto-save uložení přepíše.
- **Smazat uloženou hru**: Nastavení → „Uložená hra“ (dvoustupňové potvrzení); smaže klíč, vrátí na úvod s čistým stavem.

## Changelog hráče

Tři oddělené věci: **interní** (git log), **veřejné** (`CHANGELOG-PLAYER.md`, jen vydané verze), **neveřejné** (poznámky k plánovanému obsahu; nikdy do veřejného souboru).

```
## 0.2.0 — 2026-11-02
- Nové: Pevná místa setkání, stopy ve dne.
- Změna: Těžký útok teď stojí energii.
- Oprava: Koupený předmět se ukládá do batohu.
```
Typy: Nové · Změna · Oprava · Svět. Bez spoilerů: píše se co hráč může dělat, ne proč. Verze = `APP_VERSION`; veřejný záznam vzniká při promote `beta → main`.

## Ověření v prohlížeči

Headless Brave, žádný server. Postup:

1. Zkopíruj `prototype/index.html` do `prototype/_tmp.html` a před `</body>` přidej `<script>`, který postaví scénu, klikne na `[data-act]`, počká a zapíše výsledek do `<pre id="out">`:
```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (sel) => document.querySelector(sel).click();
applyScenario("zvon-tavern");                       // globální funkce z app.js
click('[data-act="place-talk"]');
click('[data-act="place-ask"][data-ask="rumors"]');
await sleep(DIALOG_DELAY_MS + 100);                 // foe repliky chodí se zpožděním 520 ms
document.getElementById("out").textContent = JSON.stringify(state.placeThread);
```
(skript zabal do `(async () => { … })()`; `state`, `LOM` a funkce z `app.js` jsou globální.)
2. Spusť (cesta má mezeru, musí být v uvozovkách; `--virtual-time-budget` zrychlí `setTimeout`):
```
"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --virtual-time-budget=30000 --dump-dom file:///…/prototype/_tmp.html
```
3. Z výstupu vyber `<pre id="out">`. Pro obrázek přidej `--window-size=480,900 --screenshot=cesta.png` (místo `--dump-dom`).
4. **`_tmp.html` smaž, necommituj.**

Pozor: headless okno má **minimum asi 500 px** na šířku, takže úzké viewporty (360, 390) zkoušej přes `<iframe width="360" height="640">` v dočasné stránce. Vlákna a tlačítka čti ze `state` a z DOMu, screenshot je jen kontrola vzhledu. Hráčské akce, které volají `setTimeout`, vyžadují `await sleep(...)`, jinak čteš stav před odpovědí.

