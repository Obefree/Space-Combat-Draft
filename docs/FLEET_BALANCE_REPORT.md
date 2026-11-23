# Баланс демо — текущая настройка, 17.11.2026

Запрос пользователя: меньше стартовых кубов, равные стартовые условия, больше тактик, активная защита и тактические способности кораблей.

Проверка: `node scripts/fleet-balance.mjs 1000`, seeds `balance-0`…`balance-999`, scenario=random, B обороняется, обе стороны используют один и тот же текущий ИИ и реальные переходы движка.

| Метрика | До | После |
| --- | ---: | ---: |
| Неравная начальная сила, партий из 1000 | 873 | 0 |
| Стартовых кубов на флот | 9 | 6 |
| Сильные способности доступны до тактик | 58.4% | 11.73% |
| Дешёвые способности доступны до тактик | не измерялось | 90.45% |
| Рука | 5 | 7 |

После изменения: A 464 победы, B 536 побед; все 1000 боёв прошли три раунда. Каждый флот начинает с 11 силы и 18 HP.

Это воспроизводимая проверка грубого перекоса с одним простым ИИ, а не доказательство равенства всех стратегий. Настоящий UX и баланс с человеком требуют игрового теста. Старые отчёты ниже описывают исторические правила и не заменяют текущую настройку.

---
## Исторические отчёты

# Fleet Combat — Battle Balance Report

## Одна тактика в раунд

По 1 500 партий для каждого источника флота, шесть сочетаний приоритета целей.

| Источник | Победы Лиги | Победы Гегемонии | Ничьи | Средние потери | Полных уничтожений флота | Подкреплений |
|---|---:|---:|---:|---:|---:|---:|
| Прибывшие флоты | 566 | 709 | 225 | 3,891 | 451 | 1 452 |
| Корабли из колоды | 705 | 647 | 148 | 3,763 | 658 | 1 435 |

В среднем за бой погибает чуть меньше четырёх кораблей с учётом подкреплений. В сценарии с прибывшими флотами Гегемония побеждала чаще.

Команда воспроизведения — npm run balance:fleet.

## Архив варианта с форсажем


## Основа боя с порогами кубов

По 1500 партий на источник флота, шесть сочетаний приоритета целей. Оба игрока использовали одни и те же правила выбора манёвров и действий.

| Источник флота | Победы Лиги | Победы Гегемонии | Ничьи | Потерь за бой | Полных уничтожений флота |
|---|---:|---:|---:|---:|---:|
| Прибывшие флоты | 689 | 584 | 227 | 3.073 | 680 |
| Три корабля из колоды | 683 | 705 | 112 | 3.006 | 804 |

Для прибывшего флота дредноут получил инициативу 5 и пороги ⚔8 и ✦3. В режиме колоды стартовый запас ★ может различаться.

Команда воспроизведения — npm run balance:fleet.


## 2026-11-16 — сбор флота и длительные манёвры

1500 партий на движке демо, по 250 на тактику. Оба флота меняли состав в симуляциях. Очки выживших по классам — 5/4/2, максимум 11 ★ на флот.

| Показатель | Результат |
|---|---:|
| Победы Лиги Ориона | 453 |
| Победы Гегемонии | 427 |
| Ничьи | 620 |
| Средние потери за бой | 1,512 |
| Полное уничтожение одного флота | 7 |

Ничья по ★ часта, особенно при одинаковом приоритете целей. Результаты зависят от выбранных тактик и не измеряют силу компьютера в одиночном режиме.

Команда воспроизведения — npm run balance:fleet.

## Архив — версия от 2026-11-15 с картами приказов

**Date:** 2026-11-15 · **Source:** `Obefree/Space-Combat-Draft`, branch `feature/fleet-initiative-playtest`.
**Status:** deterministic engine simulation of the prototype, not browser e2e nor proof of production deployment.

## Scoring rule
**Only ships still alive at the end contribute victory points ★.** HP determines whether the ship survives. HP has **no role** in the victory score or ties. A ship with 1 HP alive contributes its full ★ score. Destroyed ships contribute zero.

| League of Orion | Initiative | HP | VP ★ |
|---|---:|---:|---:|
| Scout | 8 | 4 | **6** |
| Destroyer | 5 | 6 | **4** |
| Cruiser | 3 | 8 | **1** |
| **Maximum** | | **18** | **11** |

| Hegemony | Initiative | HP | VP ★ |
|---|---:|---:|---:|
| Interceptor | 7 | 4 | **5** |
| Frigate | 4 | 6 | **4** |
| Dreadnought | 2 | 8 | **2** |
| **Maximum** | | **18** | **11** |

**Principle:** high durability and damage do not translate into high VP. The heavy cruiser/dreadnought contribute only 1–2 VP.

## Deck adjustments
All cards still have exactly 2 generated dice, 1 initiative command slot, and no independent card-action layer.

| Card family (2 copies) | League | Hegemony |
|---|---|---|
| Assault | ⚔⚔ | ⚔⚔ |
| Defense | 🛡🛡 | 🛡🛡 |
| Tracking | ⚔✦ | ⚔✦ |
| Maneuver | 🛡✦ | 🛡✦ |
| General Reserve | one ⚔🛡 + one ⚔✦ | both ⚔🛡 |

Totals across 10 cards: League 8 ⚔, 7 🛡, 5 ✦; Hegemony 8 ⚔, 8 🛡, 4 ✦.

## Combat ability adjustments
- Destroyer: special attack ⚔ + ✦ (sum 4+) → 4 damage (was 3).
- Cruiser: special attack ⚔ + ⚔ (sum 4+) → 5 damage (was 4).
- Interceptor: special attack ⚔2+ → damage equal to die value (was die value + 1).
- Frigate: special shield 🛡2+ → die value + 1 shield (was + 2).
- Scout and dreadnought unchanged. Each ship's strong special remains once per round.

## Reproducible test
Command: `npm run balance:fleet` or `node scripts/fleet-balance.mjs 250`.

The script simulates the actual `app/fleet-test/engine.mjs`, not a different battle model. Each side gets its own generated hand, uses the same draft evaluation and ability-spending algorithm, and receives one of six targeting strategies. `250 games per strategy` gives **1500 games** total. Every game uses a deterministic seed: `fleet-balance-v1-<strategy>-<number>`.

| Strategy (League / Hegemony) | League victories | Hegemony victories | Draws | League ships lost | Hegemony ships lost |
|---|---:|---:|---:|---:|---:|
| Finish wounded / Finish wounded | 43 | 207 | 0 | 357 | 318 |
| Hunt high-VP / Hunt high-VP | 50 | 198 | 2 | 343 | 316 |
| Hunt threat / Hunt threat | 132 | 85 | 33 | 233 | 213 |
| Hunt heavy / Hunt heavy | 156 | 68 | 26 | 197 | 178 |
| Hunt VP / Hunt threat | 197 | 47 | 6 | 260 | 297 |
| Hunt threat / Hunt VP | 53 | 194 | 3 | 322 | 230 |
| **Total** | **631** | **799** | **70** | **1712** | **1552** |

**Totals:** 42.1% League victories, 53.3% Hegemony victories and 4.7% draws; among decisive battles, League 44.1% and Hegemony 55.9%.

**Ships destroyed:** 3264 out of 9000 starting ships across all games, or **2.176 ships per game**. Of 1500 matches, **13 ended with the entire League destroyed**, **1 with the entire Hegemony destroyed**, 62 with no deaths, and 12 ended before the end of the third round.

| Ship | Destroyed across 1500 battles |
|---|---:|
| Scout (League) | 846 |
| Destroyer (League) | 292 |
| Cruiser (League) | 574 |
| Interceptor (Hegemony) | 822 |
| Frigate (Hegemony) | 221 |
| Dreadnought (Hegemony) | 509 |

**Important limitation:** these rates depend heavily on tactical objective. Against an opponent targeting the most vulnerable valuable ship, small ships are often lost. Under heavy-hunter policies, even high-HP ships die. The aggregate 44/56 decisive split is plausible for a first playable test **but not a claim of finished balance**; same-policy results range much more widely.

**Mutual annihilation:** zero examples naturally occurred. The engine classifies a both-fleets-dead state and a boundary test covers it, but current attacks are single-target and one-at-a-time; simultaneous losses require a future separately agreed damage/counterattack rule. Do not claim mutual wipe exists as normal gameplay.

## How to interpret the results
1. The heavy units' 1–2 VP are not an automatic victory route: surviving with heavy-only often loses to an opponent who protects light ships.
2. Win rates still show a moderate Hegemony advantage across this policy mix and extreme differences by targeting policy. Future changes should focus on target choice and defensive responses before inflating cards.
3. The test simulates deterministic basic policies, not optimal play, human skill, online network play or production UI.
4. When tuning, compare identical seeds, policy list and game counts before and after a minimal change. Do not overwrite the legacy `/` game.
