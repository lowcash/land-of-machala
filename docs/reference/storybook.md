# Storybook: přehled scén

Stav: **skutečné** (`prototype/js/dev/scenarios.js`). Tabulky se generují (`node prototype/js/gen-docs.js`), ručně se needitují.

**Scéna** = hotová situace (poloha, čas, batoh, nepřítel, seed), kterou dev lišta postaví jedním kliknutím. **Knoby** (obrazovka, poloha, HP, doba…) přepíšou jedno pole scény a postaví ji znovu; **↺ Reset** ji vrátí. Čísla skupin odpovídají výběru scén v dev liště.

## Trasa prohlídky

Pro první seznámení projdi 8 scén v tomto pořadí: celá smyčka start → boj → kauza → úschovna.

<!-- gen:tour -->
| # | scéna | proč |
|---|---|---|
| 1 | `town-start` Čerstvá postava v Machale | start: město, služby, mapa |
| 2 | `healer-hurt` Léčitel: zraněný hrdina | léčení, zlato |
| 3 | `fight-wolf` Vlk, plné HP (baseline) | boj: záměr, akce, zdroj |
| 4 | `zvon-tavern` Hospoda: první fáma | kauza: první fáma |
| 5 | `zvon-forge` Hutě u Jezírka | kauza: hutě a zvon |
| 6 | `zvon-verdict` Zvon v batohu: verdikt | kauza: verdikt a důvěra |
| 7 | `bag-shovel` Odložit a zakopat (s lopatou) | odložit a zakopat věc |
| 8 | `bag-full-stash` Plný batoh + úschovna | plný batoh a úschovna |
<!-- /gen:tour -->

## Všechny scény

<!-- gen:scenes -->
| skupina | id | název | co zkusit |
|---|---|---|---|
| 1 Start | `start-landing` | Úvod (přihlášení, host) | Úvodní obrazovka: registrace, přihlášení, host, případně Pokračovat. |
| 1 Start | `start-origins` | Prolog (volby před Postavou) | Čtyři kroky prologu (živnost, kraj, zvon, původ), pak Postava (shrnutí a jméno). |
| 1 Start | `start-confirm` | Postava (rasa, povolání, původ) | Výběr rasy, povolání a původu a vstup do hry. |
| 1 Start | `origin-apprentice` | Původ: učeň v kovárně | Karel dává slevu (standing +2). Zkontroluj ceny mečů. |
| 1 Start | `origin-exile` | Původ: vyhnanec před městem | Okraj lesa, málo zlata; u brány napomenutí. |
| 2 Svět | `kodex-words` | Kodex: hesla v textu | Podtržená slova (rynek, hvozd, zeman…) ukážou při najetí nebo ťuknutí krátké vysvětlení; každé heslo se označí jednou, dál už ne. Vypíná se v Nastavení (Nápovědy ke slovům). |
| 3 Město | `town-start` | Čerstvá postava v Machale | Základ: služby, banka, mapa. |
| 3 Město | `market-full-bag` | Tržiště s plným batohem | Zkus koupit odvar: nevejde se a zlato se nestrhne. Chléb (+8 HP) funguje bez místa. |
| 3 Město | `healer-hurt` | Léčitel: zraněný hrdina | Ošetření 50 🪙 doplní HP; při plném HP si neúčtuje. |
| 3 Město | `tavern-evening` | Hospoda večer: Štamgast | Večer a v noci je u okna Štamgast. Hub má tlačítko „Rozhlédnout se po lidech“; Štamgast má vlastní otázky. Přes den je tu jen Svatava a hub je beze změny. Věty (popis, pozdrav, odpovědi) se při návratech střídají. |
| 4 Boj | `fight-wolf` | Vlk, plné HP (baseline) | Vlk je rychlý (většinou výpad). Zkus: výpad → úhyb, těžký → obrana. |
| 4 Boj | `fight-wolf-low-hp` | Vlk, nízké HP | Pij odvar, braň se (obnoví zdroj) nebo uteč. Prohra = smrt s corpse. |
| 4 Boj | `fight-boar` | Divočák, těžké údery | Často těžký úder: obrana a protiúder se vyplatí. |
| 4 Boj | `fight-bandit` | Bandita, přizpůsobí se | Zahraj třikrát stejnou akci a sleduj změnu. |
| 4 Boj | `fight-bandit-hurt` | Bandita, skoro poražený | Nabídne vzdání. Ušetřit = méně zlata, bez kořisti. |
| 4 Boj | `fight-brigand` | Zbojník, elita, klame | Indicie často lže. Pozoruj, zkus odvar předtuchy. |
| 5 Čtení záměru | `fight-foresight` | Bandita + odvar předtuchy | Vypij odvar (stojí tah) a sleduj jistotu indicie. |
| 5 Čtení záměru | `fight-chanter-reader` | Bylinkář (vysoké INT) vs. bandita | Vyšší INT = jistější indicie. |
| 6 Kořist | `loot-bag-full` | Plný batoh + vítězství | Dokonči vlka; kořist se nevejde. |
| 7 Postup | `levelup-near` | Skoro nová úroveň | Dobij vlka: +XP přeteče do Lv 2 a staty vzrostou. |
| 8 Cesta | `road-travel` | Stopy před tebou (den) | Ve dne vidíš ⚠ na sousedním políčku. Můžeš ho obejít, nebo jít schválně. Vyčištěné místo se další den obnoví. |
| 8 Cesta | `forest-night` | Les v noci (bez stop) | V noci stopy nevidíš: do vlka vejdeš naslepo. Zkus stejnou scénu přes knob Doba = poledne. |
| 8 Cesta | `encounter-bandit` | Setkání: bandita na cestě | Bojovat / obejít (DEX) / ustoupit. |
| 9 Smrt | `corpse-recover` | Tvůj corpse leží v lese | Jsi ve výchozí výbavě. Tělo tě zastaví: prohledat, nebo vědomě nechat. Co se nevejde, zůstane. Mapa ukazuje 💀. |
| 10 Questy | `quest-offer` | Lidmila nabízí úkol | Rozhovor → „Nabídnout pomoc“ → Přijmout úkol. Pak otevři Úkoly (📜) a Mapu: oblast lesa je označená. |
| 10 Questy | `quest-wolves-hunt` | Vlci: 1 z 2 hotový | Vlk severně od tebe. Zabití mimo les se nepočítá. Po splnění zpět k Lidmile. |
| 10 Questy | `quest-wolves-ready` | Vlci: odevzdat | V hlavní nabídce je „Odevzdat úkol“. |
| 10 Questy | `quest-bread` | Chléb pro Svatavu: volba | Dvě volby, dva následky: cena noclehu u Svatavy se pak liší (10 / 25 místo 20). |
| 10 Questy | `quest-letter-road` | Dopis do Lady: cesta | Jdi na jih do Lady (3,0). Odevzdání je tam, ne v bance. |
| 10 Questy | `quest-letter-lost` | Dopis leží v mém těle | Úkol zůstal aktivní, dopis chybí. Úkoly i Mapa ukazují, kde leží. Znovu se nevydává. |
| 11 Kauza Zvon | `zvon-tavern` | Hospoda: první fáma | Rozhovor → „drby“ → fáma od Svatavy (sud / farní dar). Služba „Prohlédnout sud“ ověří c1. Signál se objeví jen někdy. |
| 11 Kauza Zvon | `zvon-clerk` | Radnice: ověřit z listin | Farní kniha a kupní listina za 5 🪙. U C je Gertruda napůl: pečeť bez nápisu. |
| 11 Kauza Zvon | `zvon-gate` | Brána: dva Petrové | Večer a v noci stojí na bráně „druhý“ Petr: skoro stejný, jen s dýmkou. Řekne totéž (farář prodal). |
| 11 Kauza Zvon | `zvon-cart` | Vůz na cestě (falešná stopa) | Prohlédnout vůz ověří Aniččinu fámu: vozový zvonek, ne zvon z kaple. Zvonek (cart_bell) jde sejmout. |
| 11 Kauza Zvon | `zvon-forge` | Hutě u Jezírka | Ondra od vozu (fáma c6). Prohlédnout hutě ověří a ukáže zvon. Vzít zvon (14 kg). Lhůta 5 dní do přelití. |
| 11 Kauza Zvon | `zvon-chapel-night` | Kaple v noci (bylinkář) | Naslouchat znamením: fáma Lidmily se nikdy nerozhodne (nejasné). Bez ní hráč jen cítí chlad. |
| 11 Kauza Zvon | `zvon-verdict` | Zvon v batohu: verdikt | Vrátit Aničce (zde), nechat Matějovi (hutě 5,6), doplatit střechu (Radnice) nebo nechat si (Zápisník). |
| 11 Kauza Zvon | `zvon-deadline` | Lhůta vypršela | Zvon přelit bez tebe: svět rozhodl, nic se nezablokovalo. Zápisník ukáže „co se stalo“. |
| 12 Batoh | `bag-full-stash` | Plný batoh + úschovna | Batoh je plný (16 věcí). Ulož věc do úschovny (6 míst), sekeru vyzvedni: 2 🪙 za započatý den, platí se při vyzvednutí. Bez místa v batohu se věc nevydá. |
| 12 Batoh | `bag-shovel` | Odložit a zakopat (s lopatou) | Mimo město: „Odložit věc“ (hromádka 📦 na mapě, může ji někdo vzít) a „Zakopat věc“ (−2 tiky, na mapě jen poznámka). Obojí zkus a otevři Mapu. |
| 12 Batoh | `bag-piles-days` | Odložená a zakopaná věc po 4 dnech | Hromádka čeká na jihu (3,1): vydej se tam. Rozkradení se vyhodnotí až po příchodu: sekera zmizela, zbytek a zakopaný odvar zůstaly. Seed i čas jsou pevné, výsledek je vždy stejný. |
| 12 Batoh | `bag-piles-stolen` | Věc ukradena (zvon zůstal) | Jdi na jih (3,1). Po 8 dnech na silnici je pryč sekera i košile. Zvon (kauzová věc) zůstal: ten se nerozkrade nikdy. |
<!-- /gen:scenes -->
