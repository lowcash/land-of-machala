# Místa a služby v Machale

Stav: UI a texty skutečné; hlavní služby fungují, buffy/prodej/oprava jsou makety. Zdroj: `PLACE` v `prototype/app.js`. Mapa a terény: [map.md](map.md).

| místo | služba | cena | funguje? |
|---|---|---|---|
| Léčitelka (Lidmila) | Ošetření | 50 🪙 | **funguje** (plné HP; při plném HP neúčtuje; po smrti první zdarma) |
| | Protijed, Požehnání síly / výdrže | 40 / 100 🪙 | maketa (nic se neplatí, nic se neděje) |
| Zbrojíř (Karel) | Dřevěný / železný / dlouhý meč (+5 / +8 / +10 ATK) | 50 / 150 / 220 🪙 | **funguje** (meč do batohu) |
| | Oprava | 30 🪙 | maketa (opotřebení není) |
| | Prodat věc | — | maketa |
| Zástava (Gertruda) | Uložit / vybrat 50 nebo vše | zdarma (při důvěře < 0 poplatek 5 🪙) | **funguje** |
| | Odevzdat zvon Zástavě | — | **funguje** (kauza; 40 🪙) |
| Hostinec U Přívozu (Svatava) | Spát | 20 🪙 (10 / 25 po questu Kůrka pro Svatavu) | **funguje** (plné HP, přeskočí na ráno, doplní výdrž) |
| | Drb | 5 🪙 | funguje (náhodná věta z `RUMORS`, bez dopadu; kauzové fámy jsou v rozhovoru) |
| | Úschovna | 2 🪙 / započatý den | **funguje** (6 slotů) |
| | Pivo, Kostky | — | maketa |
| Tržiště (Hanuš) | Chléb | 5 🪙 | **funguje** (+8 HP hned) |
| | Suchý chléb | 5 🪙 | **funguje** (do batohu; úkol Kůrka pro Svatavu) |
| | Odvar (Kalný odvar) | 20 🪙 | **funguje** (do batohu) |
| | Lopata | 15 🪙 | **funguje** (zakopat věci mimo město) |
| | Prodat sedmikrásku | +2 🪙 | funguje (jen když ji máš) |
| Radnice | Nahlédnutí do knih (kauza) | 5 🪙 | **funguje** (po startu kauzy) |
| | Splatit dluh kaple | 150 🪙 | **funguje** (verdikt kauzy) |

Dialogy (`PLACE_ASK`, `PLACE_BEATS`) jsou jen text bez dopadu na hru (kromě `claim` → fáma kauzy). Na mapě mimo město: vesnice Lada `(3,0)` (quest Dopis do Lady), kaple `(4,4)` a tábor `(5,6)` (kauza Zvon).

**Ekonomika dnes:** start 80 🪙 u sebe, 20 🪙 v bance; příjem jen z kořisti (vlk 8–16, divočák 6–14, bandita 14–30, zbojník 30–55 🪙). Ceny a příjmy nejsou vyvážené (ladit s encountery).
