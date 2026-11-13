# Space Combat — isolated tactical card playtest

Date: 2026-11-13. Status: **experimental; not published or integrated into the battle engine**.

## Findings
Current ships: 10 prototypes in a symmetric deck, 6 drawn, 3 deployed, 1 reinforcement after each of two rounds: only 5 enter. The dice economy is two separate player-wide pools; there are no targetable formations or fleet-zone reactions yet.

## Six new candidates
- **Сторожевой дрон** (initiative 9, HP 2, Glory 1; dice attack, attack, magic): Быстрый импульс — ⚔2: 1 урон врагу, создать 🛡1.; Сигнальная ловушка — ⚔+✦4: украсть заряд 1–2.
- **Ионный корвет** (initiative 7, HP 4, Glory 2; dice magic, magic, attack): Ионное глушение — ✦2: ослабить заряд врага на 1.; Перехват частоты — ✦+⚔4: украсть заряд 1–2.
- **Корабль снабжения** (initiative 3, HP 6, Glory 4; dice defense, defense, magic): Боеприпасы — 🛡2: создать ⚔1.; Ремонтные катера — 🛡+✦4: лечить два корабля по 1.
- **Гравитационный заградитель** (initiative 4, HP 5, Glory 3; dice magic, magic, defense): Разбор заряда — ✦2: сбросить вражеский заряд 1.; Минное поле — ✦+🛡4: 1 урон всем врагам, 1 себе.
- **Штурмовая баржа** (initiative 2, HP 7, Glory 4; dice attack, attack, defense, defense): Бортовой залп — ⚔3: 2 урона врагу.; Таранный разгон — ⚔+🛡5: 3 урона врагу, 1 себе.
- **Ретранслятор флота** (initiative 5, HP 4, Glory 3; dice defense, magic, magic): Перезапуск связи — ✦2: создать ✦2.; Перенастройка щитов — 🛡+✦4: лечение союзника 1 и усиление куба 1.

## Exact availability checks
Each n-die sample is one of 9^n equally likely unordered-with-repetition outcomes represented by all ordered combinations of 3 types × 3 faces. This tests costs independent of aiming, damage, healing, opponent behavior and draft choice. It is **not a complete-battle win-rate test**.

| Card | Ability | 1 die | 2 dice | 3 dice |
|---|---|---:|---:|---:|
| Сторожевой дрон | Быстрый импульс | 22.2% | 55.6% | 70.4% |
| Сторожевой дрон | Сигнальная ловушка | 0% | 14.8% | 42.8% |
| Ионный корвет | Ионное глушение | 22.2% | 55.6% | 70.4% |
| Ионный корвет | Перехват частоты | 0% | 14.8% | 42.8% |
| Корабль снабжения | Боеприпасы | 22.2% | 55.6% | 70.4% |
| Корабль снабжения | Ремонтные катера | 0% | 14.8% | 42.8% |
| Гравитационный заградитель | Разбор заряда | 22.2% | 55.6% | 70.4% |
| Гравитационный заградитель | Минное поле | 0% | 14.8% | 42.8% |
| Штурмовая баржа | Бортовой залп | 11.1% | 49.4% | 70.4% |
| Штурмовая баржа | Таранный разгон | 0% | 7.4% | 37.9% |
| Ретранслятор флота | Перезапуск связи | 22.2% | 55.6% | 70.4% |
| Ретранслятор флота | Перенастройка щитов | 0% | 14.8% | 42.8% |

Temporary art paths reuse existing illustrations only. Effects are drawn from IDs implemented in the corresponding UI. Position, deck-synergy, result scoring, target availability and live deployment have not yet been battle-tested.
