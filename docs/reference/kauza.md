# Kauza Zvon (pilot)

Stav: **skutečné** (`prototype/js/systems/kauza.js`, data `js/data/kauzy.js`, testy `js/test/kauza.test.js`). Postavy a příběh jsou zkušební; slouží k ověření mechaniky. Záměr: design/story.md, story/zvon.md. Tabulky se generují (`node prototype/js/gen-docs.js`).

## Jak to funguje

- **Fáma** se zaslechne v rozhovoru (`claim` na uzlu dialogu) nebo na políčku (kaple, vůz, hutě). První fáma **spustí lhůtu** (5 herních dní do přelití).
- **Jistota** = spolehlivost zdroje + 0,03 × (INT − 6) + 0,12 při shodě povolání s typem fámy + 0,05 při shodě rasy − 0,1 za každou protiřečící fámu od jiného zdroje (10–90 %). Slova jako v boji: **jistě** ≥ 75 %, **tuším** ≥ 50 %, **nejasné**. Po ověření: ověřeno / vyvráceno.
- **Názor vzniká v rozhovoru:** po každé fámě (uzel s `claim`, Anička na políčku) se nabídnou 3 odpovědi s podtextem záměru: „Věřím ti“ / „Tomu moc nevěřím“ / „Poznamenám si to“ (bez názoru). NPC zareaguje jednou větou (`react` v datech, pravdu nemění). Odpověď se nevynucuje (jde odejít), nezdvojí zaslechnutí ani lhůtu. Názor se zapisuje **jen odpovědí v rozhovoru**, v Zápisníku je jen informace.
- **Vrátit se k věci:** po rozuzlení fámy (ověřeno / vyvráceno) se u toho, kdo ji řekl (místo `claim.place`; Anička na políčku kaple), jednou objeví uzel „Vrátit se k věci“. Hráčova věta i odpověď NPC (`follow`, `after` v datech) závisí na názoru z okamžiku rozuzlení a dopadu: věřil/pochyboval × pravda/napůl/nepravda, bez názoru neutrální. Bez mechanického trestu a bez změny důvěry; rozhoduje `Kauza.follow` / `followUp`.
- **Zkušenost Čtení:** když máš u fámy zapsaný názor (Věřím / Pochybuju) a při rozuzlení se potvrdí (věřím = pravda/napůl, pochybuju = nepravda/napůl), přibude +0,02 k jistotě dalších fám (max +0,10). UI to nevysvětluje číselně, jen větou v Zápisníku.
- **Povolání a rasy čtou jinak:** pacholek `people`, dřevorubec `tracks`, bylinkář `omen`, písař `paper`; rasa: Zdejší `paper`, Solníci `people`, Hvozdané/Pasečané `tracks`, Brodáci `omen` (`classTag` / `raceTag` v datech).
- **Pravda** fámy závisí na variantě (A omyl · B ostuda · C pečeť), která se bere ze `seed` postavy. Události jsou stejné (prodej zvonaři, posel u Svatavy, sud); liší se, kdo co ví. `none` se nikdy nerozhodne (zůstane „nejasné“, ověřit jde opakovaně).
- **Signál:** nepravda nebo napůl pravda se podle `tell` NPC projeví drobnou větou. Deterministicky ze seedu (stejná kauza = stejné signály). Gertruda nelže, jen vynechává.
- **Ověření:** `cask` (sud ve sklepě u Svatavy), `cart` (vůz 4,5 — falešná stopa), `forge` (Hutě u Jezírka 5,6), `clerk` (Radnice, 5 🪙 za knihu), `night` (kaple 4,4 v noci). Musí se předtím zaslechnout.
- **Zvon** (`bell`, 14 kg, kauzová věc) leží v hutích do lhůty; z těla nezmizí, nevydá se podruhé. Vozový zvonek je jiný předmět (`cart_bell`). Výchozí batoh má ~5 kg, zvon se vejde; jde ho uložit do úschovny, odložit nebo zakopat ([world.md](world.md)) a nerozkrade se.
- **Verdikt** je jen jeden a vždy hráčův; po lhůtě rozhodne svět (`auction` = přelití). Dopad přes **důvěru** (−2…+2 per NPC): ceny služeb ×(1 − 0,15 × důvěra) u Lidmily, Svatavy a Zástavy; Zástava při důvěře < 0 bere poplatek 5 🪙 za operaci.
- **Zápisník** je v panelu Úkoly, po kartách kauz (karta: název, odpočet, fámy, po verdiktu „co se stalo“). Nerozuzlené fámy nahoře, rozuzlené sbalené v „Rozuzlené“ a utlumené. U fámy: zdroj, jistota, kde ověřit / výsledek a informativně „věřil jsi“ / „pochyboval jsi“. Pravdu ukáže jen dev přepínač „Pravda kauz“.
- Události se ukládají do `kauza.events` (`claim_heard`, `claim_verified`, `claim_refuted`, `belief_changed`, `claim_followed`, `verdict_chosen`) jako příprava na telemetrii (design/validation.md).

## Fámy

<!-- gen:kzclaims -->
| id | kdo | tvrdí | typ | ověření | A | B | C |
|---|---|---|---|---|---|---|---|
| `c1` | Svatava z Přívozu | Peníze na nový sud byly dar od farnosti za hostinu. | tracks | cask: prasklý sud ve sklepě | napůl | napůl | nepravda |
| `c2` | Petr | Farář zvon prodal. | people | clerk: farní kniha na radnici | pravda | pravda | napůl |
| `c3` | Anička | Zvon odvezli úředníci vozem nedovolenou cestou. | people | cart: vůz na cestě k hutím | napůl | napůl | napůl |
| `c4` | Gertruda | Na zvon není zástava; hotovost z prodeje měla dorazit do Zástavy. | paper | clerk: kupní listina a kniha vkladů na radnici | pravda | pravda | napůl |
| `c5` | Lidmila | V noci je u kaple cosi divného a vlci utíkají z lesa. | omen | night: kaple v noci | nerozhodne se | nerozhodne se | nerozhodne se |
| `c6` | Ondra od vozu | Ondra nesl měšec do banky, zastavil se na jedno a peníze nechal u Svatavy. | people | forge: Hutě u Jezírka | napůl | pravda | pravda |
<!-- /gen:kzclaims -->

## NPC

<!-- gen:kznpcs -->
| NPC | spolehlivost | signál (šance) | signál při napůl / lži |
|---|---|---|---|
| Svatava z Přívozu | 45 % | 70 % | Svatava počítá drobné na pultě. / Svatava počítá drobné a mluví rychleji. |
| Petr | 55 % | 50 % | Petr zopakuje poslední větu ještě jednou. / Petr zopakuje poslední větu a pak ještě jednou. |
| Anička | 50 % | 60 % | Anička si tiskne ruce. / Anička se podívá stranou a spolkne slzy. |
| Gertruda | 70 % | — | nikdy; jen vynechává |
| Gustav | 70 % | — | nikdy; jen vynechává |
| Lidmila | 60 % | 30 % | Lidmila ztiší hlas. / Lidmila ztiší hlas a mrkne ke dveřím. |
| Ondra od vozu | 40 % | 55 % | Ondra si otře ústa rukávem. / Ondra se podívá na zem a mlčí o vteřinu déle. |
| Matěj od pece | 65 % | 25 % | Matěj otře ruce o zástěru. / Matěj se podívá na pečeť a zase pryč. |
<!-- /gen:kznpcs -->

## Verdikty

<!-- gen:kzverdicts -->
| verdikt | kde | podmínka | dopad na důvěru | zlato | pozn. |
|---|---|---|---|---|---|
| `return` Vrátit zvon do kaple | chapel | zvon v batohu | anicka +2, lidmila +1, matej -1 | — | zvon se odevzdá |
| `forge` Nechat zvon Matějovi na přelití | forge | zvon v batohu | matej +2, anicka -2 | 40 | zvon se odevzdá |
| `pay` Doplatit farnosti za střechu | townhall | 150 🪙 | anicka +1, matej +1, lidmila +1, svatava +1 | -150 |  |
| `keep` Nechat si zvon | notebook | zvon v batohu | anicka -1, matej -1, lidmila -1, svatava -1 | — |  |
| `auction` Zvon byl přelit bez tebe | po lhůtě | — | anicka -1 | — |  |
<!-- /gen:kzverdicts -->

## Nedořešeno

- Ladění vah jistoty, ceny 150 🪙 a délky lhůty; události na cestě k hutím (počasí, obchodník).
- Quest „sud“ (sleva / zápis na sekeru) je samostatný, zatím není.
- Stav kauzy se ukládá s hrou do `localStorage` (jen v prohlížeči, žádný server).

- „Vrátit se k věci“ se nenabízí u `c5` (nikdy se nerozuzlí); Anička (`c3`) a Ondra (`c6`) mají tlačítko na políčku.
