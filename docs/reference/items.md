# Předměty

**Katalog je jediný zdroj pravdy v kódu:** `prototype/js/data/items.js` (rozdělený na zbraně, zbroje, šperky, spotřebiče, ostatní). Tato stránka se z něj generuje.
Limity: 11 výbavových slotů, batoh 16 slotů a max 28 váhy, bonusy jen `ATK` / `DEF`.


## Katalog

<!-- gen:items -->
### Zbraně (6)

| id | název | slot | ATK | DEF | váha | vzácnost | poznámka |
|---|---|---|---|---|---|---|---|
| `stick` | Klacek od cesty | weapon | 1 | — | 1 | poor | technicky vzato zbraň |
| `ladle` | Válečná naběračka | weapon | 4 | — | 3 | uncommon | crit chutná jako polévka |
| `axe` | Sekera dřevorubce | weapon | 6 | — | 4 | common | těžší úder |
| `wood_sword` | Dřevěný meč | weapon | 5 | — | 2 | common | cvičný |
| `iron_sword` | Železný meč | weapon | 8 | — | 4 | uncommon | poctivé železo |
| `long_sword` | Dlouhý meč | weapon | 10 | — | 5 | rare | dosah rozhoduje |

### Zbroje a štíty (15)

| id | název | slot | ATK | DEF | váha | vzácnost | poznámka |
|---|---|---|---|---|---|---|---|
| `shield` | Dubový štít | shield | — | 3 | 4 | common | blockBonus |
| `buckler` | Kovový puklíř | shield | — | 2 | 2 | common | lehčí blok |
| `cap` | Kožená čapka | head | — | 1 | 1 | poor | hlava |
| `helm` | Železná přilba | head | — | 2 | 3 | uncommon | tvrdší lebka |
| `cloak` | Cestovní plášť | shoulders | — | 1 | 1 | common | ramena |
| `pauldrons` | Ramenní kroužky | shoulders | — | 2 | 3 | uncommon | těžší |
| `tunic` | Lněná tunika | body | — | 1 | 2 | poor | základ |
| `mail` | Kroužková košile | body | — | 3 | 5 | rare | těžší brnění |
| `gloves` | Kožené rukavice | hands | — | 1 | 1 | common | úchop |
| `gauntlets` | Ocelové rukavice | hands | 1 | 1 | 2 | uncommon | pěst |
| `pants` | Cestovní nohavice | legs | — | 1 | 2 | common | pohyb |
| `greaves` | Kroužkové nohavice | legs | — | 2 | 3 | uncommon | těžší |
| `boots` | Putovní obuv | feet | — | 1 | 1 | common | lehčí krok |
| `sabatons` | Okované boty | feet | — | 2 | 2 | uncommon | stabilita |
| `bracers` | Kožené nátepníky | wrists | — | 1 | 1 | common | zápěstí |

### Šperky (2)

| id | název | slot | ATK | DEF | váha | vzácnost | poznámka |
|---|---|---|---|---|---|---|---|
| `amulet` | Amulet z lesa | neck | — | 1 | 0.5 | rare | štěstí |
| `trinket` | Skleněný korálek | trinket | 1 | — | 0.5 | uncommon | trinket |

### Spotřebiče (3)

| id | název | slot | ATK | DEF | váha | vzácnost | poznámka |
|---|---|---|---|---|---|---|---|
| `potion` | Kalný odvar | consumable | — | — | 1 | common | healMinor |
| `foresight` | Odvar předtuchy | consumable | — | — | 1 | uncommon | čtení záměru nepřítele |
| `ration` | Suchý chléb | consumable | — | — | 1 | poor | cesta |

### Ostatní (5)

| id | název | slot | ATK | DEF | váha | vzácnost | poznámka |
|---|---|---|---|---|---|---|---|
| `daisy` | Sedmikráska | misc | — | — | 0.2 | poor | misc |
| `wolf-tooth` | Zub vlka | misc | — | — | 0.3 | uncommon | trofej |
| `shovel` | Lopata | misc | — | — | 3 | common | zakopat věci |
| `letter` | Zapečetěný dopis | misc | — | — | 0.1 | rare | příběhový předmět |
| `bell` | Zvon z kaple | misc | — | — | 14 | rare | těžký, unikátní; nezmizí z těla |
<!-- /gen:items -->

