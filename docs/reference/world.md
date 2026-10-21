# Svět: čas, setkání, smrt, postup

Stav: **skutečné** (`prototype/js/systems/world.js`, testy `js/test/world.test.js`). Mřížka a terény: [map.md](map.md). Tabulky se generují (`node prototype/js/gen-docs.js`).

## Herní čas

<!-- gen:time -->
| fáze | tiky | noc? |
|---|---|---|
| 🌅 ráno | 0–3 | ne |
| ☀ poledne | 4–7 | ne |
| 🌤 odpoledne | 8–11 | ne |
| 🌇 večer | 12–15 | ano |
| 🌙 noc | 16–19 | ano |

Den má 20 tiků. Krok po mapě = 1 tik, boj = 2, spánek v hospodě přeskočí na ráno. Start hry: odpoledne, den 1.
<!-- /gen:time -->

Dnes čas ovlivňuje **které místa jsou aktivní** (noční), **jestli vidíš stopy** (jen ve dne) a **obnovu vyčištěných míst** (další den). Cena noclehu se mění podle voleb v questech.

## Místa setkání (nic se nespawnuje za chůze)

Svět má **pevná místa** (doupě, tábor), která určuje semínko hry (`state.seed`). Žádný hod při kroku: stejná cesta = stejný výsledek, a tak jde chůze plánovat.

- **Stopy:** ve dne vidíš ⚠ na sousedním políčku s aktivním místem (v tlačítku směru i na mapě): „stopy vlka“, „kouř z ohniště“. Můžeš ho obejít, nebo jít schválně. V noci stopy nevidíš a narazíš až na místě.
- **Vstup na místo = setkání.** Volby: **bojovat** · **obejít** (šance `45 % + DEX·3 %`, max 90 %; stojí 1 výdrž; při nezdaru tě nepřítel přepadne a udeří první) · **ustoupit** (zpět, bez trestu, 1 tik).
- **Vyčištění:** vítězství nebo ušetření místo vyčistí do konce dne; další den se obnoví (spánek tedy obnoví svět). Útěk a obejití místo nechají.
- **Noční místa** jsou aktivní jen večer a v noci (např. bandité v kopcích).
- Okolí města a vesnice (±1 políčko) je bezpečné.

<!-- gen:spots -->
| terén | šance, že políčko má místo | kdy | pool |
|---|---|---|---|
| town / village a okolí (±1) | 0 % | — | — |
| cesta (`road`) | 10 % | stále | `bandits` |
| pláně (`plains`) | 12 % | stále | `wildlife` |
| les (`forest`) | 55 % | stále | `wildlife` |
| les (`forest`) | 20 % | jen večer a v noci | `uncanny` |
| kopce (`hills`) | 30 % | stále | `wildlife` |
| kopce (`hills`) | 25 % | jen večer a v noci | `bandits` |
| kaple (`chapel`) | 60 % | jen večer a v noci | `uncanny` |
<!-- /gen:spots -->

Výběr nepřítele na místě: pool → člen váženě (při stavbě světa, ne při vstupu).

<!-- gen:pools -->
| pool | členové (váha) |
|---|---|
| `wildlife` | `wolf` 0.6, `boar` 0.4 |
| `bandits` | `bandit` 0.9, `brigand` 0.1 |
| `uncanny` | zatím žádný |
<!-- /gen:pools -->

Dev: přepínač „Všechna místa na mapě“ je ukáže všechna. Scénář může místa přepsat (`spots`).

## Smrt a corpse

- Prohra v boji: **vše** (batoh, vybavení na sobě, měšec) zůstane v corpse na místě smrti. **Banka zůstává.**
- Hráč se probudí u léčitele s **40 % max. HP** (`respawnHp`) a se základní výbavou (`stick`, `tunic`), bez zlata; uplyne 4 tiky. Příznak `freeHealAfterDeath`: první Ošetření u Lidmily je zdarma („zaplatíš, až budeš mít“), pak se platí.
- Corpse je vidět na mapě 💀. **Na jeho políčku tě hra zastaví:** buď „Prohledat své tělo“, nebo „Nechat věci ležet a jít dál“ (vědomé rozhodnutí; tělo i tak zůstane na mapě). Prohledání: zlato se vezme vždy, vybavení se nasadí do prázdného slotu, jinak do batohu; co se nevejde, zůstane. Questové předměty (`quest: true`) mají přednost.
- **Questový předmět v corpse se nevydává znovu** (žádné duplikáty). Quest zůstane aktivní, Úkoly i Mapa ukážou „leží v tvém těle na (x,y)“.
- Corpse zůstává, dokud se nevyzvedne; druhá smrt přidá další.

## Plný batoh: úschovna, odložení, zakopání

Pravidla `js/systems/stash.js` (testy `js/test/stash.test.js`), čísla v konstantě `TUNE` (**ladit**). Batoh na startu: 2× odvar, chléb, sedmikráska, odvar předtuchy, rukavice (~5 kg z 28).

| možnost | kde | pravidlo |
|---|---|---|
| úschovna | hospoda, služba „Úschovna“ | 6 věcí, 2 🪙 za započatý den, platí se při vyzvednutí (bez zlata nebo místa v batohu se nevydá); bez rizika |
| odložit | mimo město, mapa | hromádka 📦 na políčku, viditelná na mapě; za den o věc přijde s šancí 15 % × terén (noční tik váží 2×) |
| zakopat | mimo město, potřebuje `shovel` (Lopata, 15 🪙 na tržišti) | −2 tiky; na mapě jen poznámka „zakopáno na (x,y)“; 2 % za den; vykopat −1 tik |

- **Riziko hromádky na zemi podle terénu** (`TUNE.terrainMult`, násobí 15 % za den; zakopané beze změny): město ×2, cesta ×1,5, ves ×1,5, pláň ×1, les ×0,5, kaple ×0,5, kopce ×0,3. Terén předává volající (`settle(..., terrainOf)`), `stash.js` zůstává čistý.
- Rozkradení se vyhodnotí **líně při příchodu na políčko**, deterministicky (seed + hromádka + okamžik jejího založení): **jeden pevný hod na celou hromádku**, zloděj tedy bere všechno (kromě questových věcí), nebo nic. Výsledek nezávisí na tom, kdy se podíváš.
- `quest: true` věci (zvon, dopis) se nerozkradou nikdy. Úschovna i hromádky se počítají jako „věc existuje“ (zvon se nevydá podruhé).
- Zahodit z inventáře zůstává nevratné.

## Postup

<!-- gen:levels -->
| povolání | za úroveň |
|---|---|
| `mercenary` | +1 STR, +1 VIT |
| `tracker` | +1 DEX, +1 VIT |
| `chanter` | +1 INT, +1 VIT |
| `legist` | +1 INT, +1 VIT |

XP na další úroveň = `50 × úroveň` (Lv1→2: 50, Lv2→3: 100 …). Nová úroveň doplní HP.
<!-- /gen:levels -->

Nepřátelé se s úrovní hráče neškálují.
