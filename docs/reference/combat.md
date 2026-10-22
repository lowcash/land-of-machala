# Boj — jak funguje

Stav: **skutečné pravidla** (`prototype/js/systems/combat.js`, testy `js/test/`). Tabulky mezi `<!-- gen -->` značkami se generují: `node prototype/js/gen-docs.js` — neupravovat ručně.
Návrhové záměry a důvody: design/gameplay.md.

## Rozsah (komplexita)

- 1v1, bez pohybu, bez časového limitu na tah, jedna akce za tah.
- 9 akcí + ušetřit, 3 záměry nepřítele (těžký / rychlý / obrana), 4 nepřátelé.
- Co ovlivňuje výsledek: HP, zdroj (energie/mana), ATK, DEF, DEX, INT, poslední 2 akce hráče, zkušenost s druhem, odvar předtuchy, vzorce nepřítele.
- **Neexistuje:** statusy (krvácení, zpomalení), kombinace akcí, více nepřátel, slabiny/odolnosti podle typu zbraně, efekty předmětů (`effectId`), opotřebení výbavy, nepřítelův útěk, vyjednávání/úplatek.

## Tah

1. Nepřítel má **skutečný záměr** (těžký / rychlý / obrana) a hráč vidí jen **indicii**.
2. Hráč zvolí akci. Nedostatek zdroje = akce se odmítne, tah se nespotřebuje.
3. Zaplatí se / vrátí zdroj, vyhodnotí se hráčova akce. Zabil-li nepřítele, konec.
4. Nepřítel provede skutečný záměr (příchozí poškození podle matice níže). Správná reakce vrátí **protiúder**.
5. Konec při HP 0 hráče. Jinak nový záměr + nová indicie.

## Akce a zdroj

<!-- gen:actions -->
| akce | zdroj | efekt |
|---|---|---|
| Rychlý (`quick`) | 0 | zásah 75 % + DEX·1 %, dmg ATK×0.48+1; vs těžký +10 % zásah a −40 % příchozí; vs obrana −3 dmg |
| Těžký (`heavy`) | −4 | zásah 56 % + DEX·1 %, dmg ATK×0.96+2; vs rychlý +15 % zásah; vs obrana +4 dmg |
| Speciál (`special`) | −6 | nemine, ignoruje obranu a DEF; dmg síla×0.8 (pacholek ATK, dřevorubec DEX×1,45, bylinkář INT×1,3, písař INT×1,1) |
| Obrana (`guard`) | +2 | příchozí poškození podle matice níže; vs těžký protiúder |
| Úhyb (`evade`) | +1 | příchozí podle matice; vs rychlý protiúder; příští útěk +30 % |
| Pozorování (`observe`) | +1 | příchozí ×0,85; příští indicie +50 % šance přečtení |
| Odvar (`potion`) | 0 | +14 HP, spotřebuje předmět z batohu, stojí tah |
| Odvar předtuchy (`foresight`) | 0 | 5 tahů +40 % šance přečtení, spotřebuje předmět, stojí tah |
| Útěk (`flee`) | 0 | šance 35 % + DEX·2 % + bonus z úhybu (5–90 %); selhání = nepřítel útočí bez tvé obrany |
| Ušetřit (`spare`) | 0 | jen když nepřítel nabídl vzdání; konec boje, ½ zlata, 70 % XP, bez kořisti |
<!-- /gen:actions -->

## Příchozí poškození (násobek)

Základ = poškození nepřítele pro daný záměr × `enemyDmg` − ⌊DEF×0,35⌋ (min. 1), pak ×níže.

<!-- gen:incoming -->
| tvoje akce ↓ / záměr nepřítele → | těžký úder | rychlý výpad | obrana |
|---|---|---|---|
| `guard` | ×0.35 | ×0.55 | ×0.5 |
| `evade` | ×0.7 | ×0.4 | ×1 |
| `quick` | ×0.6 | ×1 | ×1 |
| `observe` | ×0.85 | ×0.85 | ×0.85 |
| ostatní (útok, potion…) | ×1 | ×1 | ×1 |
<!-- /gen:incoming -->

Protiúder: obrana vs těžký a úhyb vs rychlý → hráč dá ⌊ATK×0,46⌋ − ⌊DEF nepřítele/2⌋ (min. 1).

## Čtení záměru

- **Skutečný záměr** — co nepřítel udělá. **Indicie** — co hráč vidí. **Šance přečtení** `p` — pravděpodobnost, že indicie = skutečnost.
- `p = clamp(0,30 + 0,04·INT + zkušenost + pozorování + odvar, 0,15…0,90) × (1 − klam nepřítele)`.
- Zkušenost = 0,015 × počet poražených daného druhu (max 0,15). Pozorování = +0,5 na příští tah. Odvar předtuchy = +0,4 na 5 tahů.
- Pokud indicie neplatí, ukáže se jiný (špatný) záměr. Popisek ukazuje `p`: **jistě** ≥ 75 %, **tuším** ≥ 50 %, **nejasné** < 50 %.
- Chybný odhad není náhodný trest: popisek říká, jak moc věřit.

<!-- gen:read -->
| podmínka (bandita, pacholek) | čtenář výhry | rozdíl proti INT 4 |
|---|---|---|
| INT 4 | 66 % | +0 p. b. |
| INT 10 + zkušenost 0,15 | 91 % | +25 p. b. |
| INT 4 + odvar předtuchy | 74 % | +9 p. b. |
<!-- /gen:read -->

## Chování nepřátel

Záměr = vážená volba (váhy v tabulce nepřátel) + úpravy: nepřítel pod 35 % HP se víc brání (+0,25 obrana), hráč pod 40 % HP vyprovokuje těžký úder (+0,2).
**Adaptace:** když hráč zahraje stejnou akci 2× po sobě, přičte se `adaptace` k protiakci: těžký→obrana, rychlý→těžký, obrana→rychlý, úhyb→těžký, speciál→obrana. Zvířata neadaptují; bandita 0,4; zbojník 0,55 a navíc **klame** (snižuje šanci přečtení).

**Morálka (jen nepřátelé se `surrenderAt`, tj. bandita):** když má nepřítel HP ≤ `surrenderAt`, rozhoduje stav hráče. Hráč ≥ `surrenderMinPlayerHp` (40 % max. HP) → nepřítel **nabídne vzdání** (akce Ušetřit). Hráč níž → nepřítel **zuří**: k váze těžkého úderu se přičte `desperateHeavy` (0,2) a jednou za boj přijde hláška („tlačí na pilu“). Nabídka se objeví, jakmile hráč HP zvedne (odvar); jednou nabídnutá zůstává. Zvířata beze změny.

**Co hráč vidí o nepříteli:** ne HP číslem, jen stav slovy: zdravý (>75 %) · potlučený (>50 %) · krvácí (>25 %) · sotva stojí (≤25 %) a bar ve 4 dílcích. Přesná čísla jen s dev přepínačem „Skutečný záměr v boji“.

## Nepřátelé

<!-- gen:enemies -->
| id | jméno | Lv | typ | HP | DEF | dmg těžký/rychlý/obrana | váhy záměrů T/R/O | adaptace | klam | vzdání | zlato | XP | kořist |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `wolf` | Vlk šedivák | 1 | wildlife | 45 | 2 | 18/11/5 | 0.25/0.55/0.2 | — | — | — | 8–16 | 18 | `wolf-tooth` 70 % |
| `boar` | Divočák | 1 | wildlife | 52 | 3 | 21/8/6 | 0.5/0.15/0.35 | — | — | — | 6–14 | 20 | — |
| `bandit` | Bandita Honza | 2 | humanoid | 49 | 3 | 17/12/5 | 0.35/0.35/0.3 | 0.4 | — | ≤ 25 % HP | 14–30 | 26 | — |
| `brigand` | Zbojník z monstrance | 3 | humanoid | 74 | 4 | 23/15/6 | 0.35/0.35/0.3 | 0.55 | 30 % | — | 30–55 | 50 | — |
<!-- /gen:enemies -->

Kde a kdy se nepřátelé objevují: [world.md](world.md) (setkání na cestě). Přepadení: při nezdařeném obcházení udeří nepřítel první.

## Konec boje

- **Výhra:** zlato (rozsah), XP, kořist (šance po položkách). Zlato a XP hned, předměty přes loot okno.
- **Ušetřit** (jen když nepřítel nabídne vzdání: ≤ 25 % HP u bandity a hráč ≥ 40 % HP): ½ zlata, 70 % XP, bez kořisti; záznam `flags["spared:<id>"]`.
- **Útěk:** žádná odměna. **Prohra:** smrt — vše do corpse, probuzení u léčitele ([world.md](world.md)).
- HP se po boji **zachová** (mezi boji se doplňuje u léčitele, spánkem, chlebem, odvarem); zdroj se v každém boji obnoví na plno. Boj stojí 2 tiky herního času.

## Ladicí konstanty

<!-- gen:tune -->
```js
{
  "quickDmg": 0.48,
  "quickPlus": 1,
  "quickHit": 0.75,
  "heavyDmg": 0.96,
  "heavyPlus": 2,
  "heavyHit": 0.56,
  "specialDmg": 0.8,
  "enemyDmg": 1,
  "enemyHp": 1,
  "riposte": 0.46,
  "surrenderMinPlayerHp": 0.4,
  "desperateHeavy": 0.2,
  "costs": {
    "heavy": 4,
    "special": 6
  },
  "gains": {
    "guard": 2,
    "evade": 1,
    "observe": 1
  }
}
```
<!-- /gen:tune -->

## Ověření: výhry podle strategie

<!-- gen:sim -->
| nepřítel (pacholek Lv1) | vždy quick | vždy heavy | vždy special | vždy guard | vždy evade | náhodný | čtenář | informovaný |
|---|---|---|---|---|---|---|---|---|
| `wolf` | 26 % | 70 % | 64 % | 0 % | 16 % | 39 % | 70 % | 100 % |
| `boar` | 0 % | 43 % | 15 % | 0 % | 0 % | 7 % | 43 % | 95 % |
| `bandit` | 8 % | 66 % | 58 % | 0 % | 0 % | 24 % | 66 % | 100 % |
| `brigand` | 0 % | 4 % | 0 % | 0 % | 0 % | 0 % | 4 % | 27 % |

_1000 bojů na bota, seedy 1…1000. „čtenář“ věří indicii jen při jistotě „tuším/jistě“, jinak hraje těžký + obrana. „informovaný“ zná skutečný záměr._
<!-- /gen:sim -->

Cíl: žádná jednoduchá strategie nevítězí všude (nejlepší fixní ≤ ~70 %), znalost záměru se vyplatí. Dřevorubec a bylinkář jsou v čistém boji slabší než pacholek; písař je blízko bylinkáře (speciál INT×1,1).
