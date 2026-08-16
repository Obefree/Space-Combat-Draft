# Space Combat Draft

Hot-seat prototype for a space 4X combat system based on the Dice Draft draft-and-dice idea.

## Current Combat Model

- Each player drafts cards from open packs.
- Each player chooses 5 cards for the battle hand.
- Battle starts with 3 ships per player.
- The remaining 2 cards stay in hand and are added later as reinforcements.
- Dice are not taken from a common pool.
- When a ship enters battle, it immediately rolls its printed dice and keeps them on that card.
- Abilities spend dice attached to the active ship.

## Run Locally

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run build
npm run lint
```

The prototype still uses the original temporary card set and art while the space-specific card system is being developed.
