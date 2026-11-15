# Fleet Initiative Playtest — v0.3
**Repo:** Obefree/Space-Combat-Draft
**Route:** /fleet-test (separate from the existing / page)
**Status:** functional prototype in branch feature/fleet-initiative-playtest; not a confirmed live deployment to spacecombat.obefree.com.

## Purpose
Preserve the old Dice Draft combat intact and test a different fleet-level loop:
**Actual ships from 4X** → choose combat cards → **cards grant dice and become commands on initiative track** → ship acts in initiative → dice spent and removed → automatic shield absorption and optional defense reaction → next card/round.
No separate maneuver deck, no random arrival of ships, no alternative currencies.

## Cards: 10 per side (five pairs); opening hand: 5 shuffled cards
| Cards (two copies each) | Dice each | Reason to choose |
|---|---|---|
| Боевой натиск | ⚔ ⚔ | Dedicated attack |
| Глухая оборона | 🛡 🛡 | Defense and emergency reaction |
| Наведение | ⚔ ✦ | Attack plus upgrade dice |
| Тактический манёвр | 🛡 ✦ | Defensive and conversion tempo |
| Общий резерв | ⚔ 🛡 | Flexible middle ground |

**Faction difference in this first test:** one copy of Общий резерв is changed for A to ✦🛡 and for B to ⚔⚔. This is a deliberately minimal asymmetry, not the final factions or upgrade tree.

### Card deployment and initiative track
- Start of round 1: choose **3 out of 5** dealt cards. Immediately roll their six dice.
- Each live strategic ship adds one base die to the opening pool (3).
- Scout A / interceptor B adds **one extra die from a module** (1).
- Total at battle start: **10 dice per side**.
- Round 2: choose one of the two remaining cards and roll its 2 dice.
- Round 3: introduce the final card and roll its 2 dice.
- **A played card stays on the initiative track** as one command for every subsequent round; its dice are rolled **only once, when introduced**.
- At the start of every round, the player can assign each introduced card to a living ship. Existing allocations are suggested/preserved; new cards are added to the initiative row. If the ship was destroyed, reassign its card.
- **One placed card = exactly one activation** of its assigned ship per round. Limit: 2 command cards per ship per round. Additional cards can stay in reserve (still contributed dice, but grant no activation).
- Initiative order: first commands in descending initiative, then second commands in descending initiative. Same-initiative ties use player A first in this test.
- If a ship dies before its slot, that activation is lost. No card is drawn to replace it during a round.

### Dice and actions
Every die has a type ⚔, 🛡, ✦ and a face 1/2/3; faces are rolled on entry.
**One pool per player. No pre-attaching dice to ships.**
On its command slot, a ship may:
- Attack: one ⚔ → 1 damage (⚔3 → 2 damage).
- Activate shield: one 🛡 → **+die value** temporary ship-group shields, capped at 7; automatic absorption of incoming attacks. Remaining shields expire at end of round.
- Tune: one ✦ → increase another stored die by 1 (max 3).
- Its own ship special attack, shield or sensor action (requires printed dice combination; see below). **Special only once per ship per round**, even if it has two commands.
- **Pass**: consume the command activation but save every die for later in the battle.
- Reaction during an incoming attack: optionally spend one 🛡 die to absorb its value of damage **without using any command slot**. If a prepared shield already absorbs everything, no reaction window is necessary.

Spent dice disappear from the pool. Unspent dice remain with their rolled values between rounds. Dice are never replenished except by introducing a new card or an explicit ship ability.

### Fleets in the initial scenario (ship art reused from existing Space Combat Draft)
| Faction A | Initiative | HP | Unique special |
|---|---:|---:|---|
| Разведчик | 8 | 4 | ✦2+: increase one other die by 2 |
| Эсминец | 5 | 6 | ⚔ + ✦, Σ≥4 → 3 damage |
| Крейсер | 3 | 8 | ⚔ + ⚔, Σ≥4 → 4 damage |

| Faction B | Initiative | HP | Unique special |
|---|---:|---:|---|
| Перехватчик | 7 | 4 | ⚔2+ → die face+1 damage |
| Фрегат | 4 | 6 | 🛡2+ → die face+2 shields |
| Дредноут | 2 | 8 | ⚔ + ⚔ + ✦, Σ≥6 → 6 damage |

All six ships can attack with ordinary ⚔ dice; none is merely a bonus provider.

### Battle end and limitations
- Three rounds or destruction of one side. The winner has the larger remaining total fleet HP (tie possible).
- All actual ships in the battle are chosen by the 4X layer. In this prototype the input is a fixed three-ship lineup per side.
- Single-player vs simple scripted AI, or hotseat.
- Currently no realtime multiplayer, moveable ship positions, long-range distinction or full technology tree.
- UI is an experimental scene inside the existing game repo, not a replacement for the original / route.
- **Deployment note:** Public spacecombat.obefree.com is hosted in ChatGPT Sites; GitHub branch commits do not prove a live deployment. To publish into that existing project, use its canonical Sites editor/hosting access, preserving the original route.
- Run local engine tests: \`node --test tests/fleet-initiative.test.mjs\`.
- App build command (when the project environment and deps are available): \`npm run build\`.
