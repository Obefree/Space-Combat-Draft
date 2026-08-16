# Space Combat Draft

Hot-seat prototype for a space 4X combat system based on the Dice Draft dice-combat idea.

## Current Combat Model

- Each player has a symmetric balanced 10-card deck.
- Before battle, each player randomly draws 5 cards from their own deck.
- Battle starts with 3 ships per player.
- The remaining 2 cards stay in hand and are added later as reinforcements.
- Dice are not taken from one shared table pool.
- Each player has their own common dice pool.
- When a ship enters battle, it immediately rolls its printed dice into its owner's pool.
- Abilities spend dice from the active ship owner's pool.

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
