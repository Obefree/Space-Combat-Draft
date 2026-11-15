# Fleet Combat — Battle Balance Report
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
