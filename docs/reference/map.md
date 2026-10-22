# Mapa a terény

Stav: **skutečné** (`prototype/js/data/map.js`, testy `js/test/map.test.js`). Záměr (gate, `layer`, rozšíření): design/map.md. Setkání podle terénu: [world.md](world.md). Tabulka se generuje (`node prototype/js/gen-docs.js`).

<!-- gen:map -->
Velikost 7×7. Osa Y ↑ sever. Spawn = město.

**Legenda:** `town` Město · `village` Vesnice · `road` Cesta · `plains` Louky · `forest` Les · `hills` Kopce · `chapel` Kaple

**Zóny:** `safe` bezpečná · `neutral` neutrální · `danger` nebezpečná; v bezpečné zóně (město, vesnice, kaple) nejsou bojová místa (hlídá test); neutrální (cesty, dílny) má jen vzácné lapky; nebezpečná (louky, les, kopce) divočinu a v noci víc. Zóna zatím nemění pravidla, jen pojmenovává stav.

| y\x | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| 6 | `hills` | `hills` | `forest` | `forest` | `plains` | `hills` | `hills` |
| 5 | `plains` | `plains` | `forest` | `forest` | `road` | `plains` | `plains` |
| 4 | `plains` | `road` | `road` | `road` | `chapel` | `plains` | `plains` |
| 3 | `plains` | `road` | `road` | `town` | `road` | `road` | `plains` |
| 2 | `plains` | `road` | `road` | `road` | `road` | `road` | `plains` |
| 1 | `plains` | `road` | `road` | `road` | `road` | `plains` | `plains` |
| 0 | `hills` | `plains` | `plains` | `village` | `plains` | `plains` | `hills` |

### Body zájmu (POI)

| id | název | (x,y) | terén | zóna |
|---|---|---|---|---|
| `town` | Machala | (3,3) | `town` | bezpečná |
| `village` | Lada | (3,0) | `village` | bezpečná |
| `chapel` | Kaple u cesty | (4,4) | `chapel` | bezpečná |
| `forge` | Hutě u Jezírka | (5,6) | `hills` | neutrální |
| `cart` | Vůz na cestě | (4,5) | `road` | neutrální |
<!-- /gen:map -->
