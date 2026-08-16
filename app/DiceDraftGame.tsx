"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type PlayerId = "A" | "B";
type Phase = "loading" | "deploy_select" | "battle" | "finished";
type RulesMode = "full" | "light";
type DieType = "attack" | "defense" | "magic";

type Cost = {
  threshold?: number;
  requirements?: Partial<Record<DieType | "any", number>>;
  exact_dice?: number;
  same_values?: boolean;
  different_values?: boolean;
};

type Effect = {
  type: string;
  amount?: number;
  target?: string;
  condition?: string;
  bonus_amount?: number;
  override_amount?: number;
  min?: number;
  max?: number;
  value_max?: number;
  count?: number;
};

type Ability = {
  id: string;
  name_ru: string;
  text_ru: string;
  cost: Cost;
  effects: Effect[];
};

type CardData = {
  id: string;
  name_ru: string;
  initiative: number;
  health: number;
  glory: number;
  dice: DieType[];
  abilities: Ability[];
  art?: string;
};

type Die = {
  id: string;
  type: DieType;
  value: number;
};

type Creature = {
  id: string;
  owner: PlayerId;
  card: CardData;
  hp: number;
  attached: Die[];
  alive: boolean;
};

type Player = {
  id: PlayerId;
  name: string;
  roster: CardData[];
  hand: CardData[];
  creatures: Creature[];
};

type BattleState = {
  round: number;
  reinforcementWave: number;
  queue: string[];
  activeCreatureId: string | null;
  needsDie: boolean;
  pools: Record<PlayerId, Die[]>;
  selectedTargetId: string | null;
  log: string[];
};

type GameState = {
  phase: Phase;
  seedText: string;
  rng: number;
  allCards: CardData[];
  players: Record<PlayerId, Player>;
  deployment: DeploymentState | null;
  battle: BattleState | null;
  nextCreatureNumber: number;
  nextDieNumber: number;
};

type DeploymentState = {
  playerId: PlayerId;
  count: number;
  wave: number;
  nextRound: number;
  selectedIds: string[];
};

const DIE_FACE_VALUES = [1, 1, 2, 2, 3, 3];
const PLAYER_DECK_SIZE = 10;
const OPENING_CARDS_PER_PLAYER = 3;
const REINFORCEMENT_ROUNDS = 2;
const REINFORCEMENTS_PER_ROUND = 1;
const BATTLE_HAND_SIZE = 6;
const DEFAULT_SEED_TEXT = "playtest-01";
const SPACE_CARD_COVER_ART = "/card-art/space/space-card-cover-v1.png";

const SPACE_CARD_ART_BY_ID: Partial<Record<string, string>> = {
  alchemist: "/card-art/space/generated/alchemist.png",
  bastion: "/card-art/space/generated/bastion.png",
  bodyguard: "/card-art/space/generated/bodyguard.png",
  huntress: "/card-art/space/generated/huntress.png",
  mercenary_captain: "/card-art/space/generated/mercenary_captain.png",
  old_veteran: "/card-art/space/generated/old_veteran.png",
  paladin: "/card-art/space/generated/paladin.png",
  raider: "/card-art/space/generated/raider.png",
  swift_blade: "/card-art/space/generated/swift_blade.png",
  transmuter: "/card-art/space/generated/transmuter.png",
};

const SYMMETRIC_DECK_CARD_IDS = [
  "swift_blade",
  "raider",
  "huntress",
  "mercenary_captain",
  "bastion",
  "bodyguard",
  "paladin",
  "alchemist",
  "transmuter",
  "old_veteran",
];

const DIE_META: Record<DieType, { icon: string; label: string }> = {
  attack: { icon: "⚔", label: "Атака" },
  defense: { icon: "🛡", label: "Защита" },
  magic: { icon: "✦", label: "Магия" },
};

const PLAYERS: Record<PlayerId, { name: string; short: string }> = {
  A: { name: "Игрок A", short: "A" },
  B: { name: "Игрок B", short: "B" },
};

const EMPTY_PLAYERS: Record<PlayerId, Player> = {
  A: {
    id: "A",
    name: PLAYERS.A.name,
    roster: [],
    hand: [],
    creatures: [],
  },
  B: {
    id: "B",
    name: PLAYERS.B.name,
    roster: [],
    hand: [],
    creatures: [],
  },
};

function hashSeed(seedText: string) {
  let hash = 2166136261;
  for (const char of seedText) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function nextRandom(seed: number): [number, number] {
  let value = seed >>> 0;
  value += 0x6d2b79f5;
  let t = value;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, value >>> 0];
}

function shuffleWithSeed<T>(items: T[], seed: number): [T[], number] {
  const copy = [...items];
  let rng = seed;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const [roll, next] = nextRandom(rng);
    rng = next;
    const swapIndex = Math.floor(roll * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return [copy, rng];
}

function initialState(): GameState {
  return {
    phase: "loading",
    seedText: DEFAULT_SEED_TEXT,
    rng: hashSeed(DEFAULT_SEED_TEXT),
    allCards: [],
    players: structuredClone(EMPTY_PLAYERS),
    deployment: null,
    battle: null,
    nextCreatureNumber: 1,
    nextDieNumber: 1,
  };
}

function readStoredRulesMode(): RulesMode {
  if (typeof window === "undefined") return "full";
  return window.localStorage.getItem("space-combat-rules-mode") === "light"
    ? "light"
    : "full";
}

function readStoredGameScale() {
  if (typeof window === "undefined") return 85;
  const savedScale = window.localStorage.getItem("space-combat-scale");
  const parsedScale = savedScale ? Number(savedScale) : 85;
  return Number.isFinite(parsedScale) ? Math.min(110, Math.max(70, parsedScale)) : 85;
}

function buildSymmetricDeck(cards: CardData[]) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const selectedDeck = SYMMETRIC_DECK_CARD_IDS.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });

  return selectedDeck.length === PLAYER_DECK_SIZE
    ? selectedDeck
    : cards.slice(0, PLAYER_DECK_SIZE);
}

function makeRandomBattle(cards: CardData[], seedText: string): GameState {
  const baseDeck = buildSymmetricDeck(cards);
  const [deckA, rngAfterA] = shuffleWithSeed(baseDeck, hashSeed(seedText));
  const [deckB, rngAfterB] = shuffleWithSeed(baseDeck, rngAfterA);
  const players = structuredClone(EMPTY_PLAYERS);

  players.A = {
    ...players.A,
    roster: baseDeck,
    hand: deckA.slice(0, BATTLE_HAND_SIZE),
  };
  players.B = {
    ...players.B,
    roster: baseDeck,
    hand: deckB.slice(0, BATTLE_HAND_SIZE),
  };

  return {
    ...initialState(),
    phase: "deploy_select",
    seedText,
    rng: rngAfterB,
    allCards: cards,
    players,
    deployment: {
      playerId: "A",
      count: OPENING_CARDS_PER_PLAYER,
      wave: 0,
      nextRound: 1,
      selectedIds: [],
    },
    battle: {
      round: 1,
      reinforcementWave: 0,
      queue: [],
      activeCreatureId: null,
      needsDie: false,
      pools: emptyPools(),
      selectedTargetId: null,
      log: [
        "Каждый игрок получил 6 карт из симметричной колоды 10. Выберите стартовые 3 корабля.",
      ],
    },
  };
}

function sortInitiative(creatures: Creature[]) {
  return creatures
    .filter((creature) => creature.alive)
    .sort((left, right) => {
      if (right.card.initiative !== left.card.initiative) {
        return right.card.initiative - left.card.initiative;
      }
      if (left.card.glory !== right.card.glory) {
        return left.card.glory - right.card.glory;
      }
      if (left.owner !== right.owner) {
        return left.owner.localeCompare(right.owner);
      }
      return left.card.id.localeCompare(right.card.id);
    })
    .map((creature) => creature.id);
}

function allCreatures(players: Record<PlayerId, Player>) {
  return [...players.A.creatures, ...players.B.creatures];
}

function livingCreatures(players: Record<PlayerId, Player>) {
  return allCreatures(players).filter((creature) => creature.alive);
}

function score(player: Player) {
  return player.creatures
    .filter((creature) => creature.alive)
    .reduce((total, creature) => total + creature.card.glory, 0);
}

function rollDie(type: DieType, state: GameState): [Die, GameState] {
  const [roll, rng] = nextRandom(state.rng);
  const value = DIE_FACE_VALUES[Math.floor(roll * DIE_FACE_VALUES.length)];
  const die = {
    id: `d${state.nextDieNumber}`,
    type,
    value,
  };
  return [
    die,
    { ...state, rng, nextDieNumber: state.nextDieNumber + 1 },
  ];
}

function emptyPools(): Record<PlayerId, Die[]> {
  return { A: [], B: [] };
}

function clonePools(pools: Record<PlayerId, Die[]>): Record<PlayerId, Die[]> {
  return {
    A: [...pools.A],
    B: [...pools.B],
  };
}

function clonePlayers(players: Record<PlayerId, Player>): Record<PlayerId, Player> {
  return {
    A: {
      ...players.A,
      roster: [...players.A.roster],
      hand: [...players.A.hand],
      creatures: players.A.creatures.map((creature) => ({
        ...creature,
        attached: [...creature.attached],
      })),
    },
    B: {
      ...players.B,
      roster: [...players.B.roster],
      hand: [...players.B.hand],
      creatures: players.B.creatures.map((creature) => ({
        ...creature,
        attached: [...creature.attached],
      })),
    },
  };
}

function deployOneCreature(
  state: GameState,
  playerId: PlayerId,
  card: CardData,
  pools: Record<PlayerId, Die[]>,
): [Creature, GameState] {
  const creature: Creature = {
    id: `c${state.nextCreatureNumber}`,
    owner: playerId,
    card,
    hp: card.health,
    attached: [],
    alive: true,
  };
  let nextState = {
    ...state,
    nextCreatureNumber: state.nextCreatureNumber + 1,
  };

  for (const dieType of card.dice) {
    const [die, rolledState] = rollDie(dieType, nextState);
    nextState = rolledState;
    pools[playerId].push(die);
  }

  return [creature, nextState];
}

function confirmDeploymentSelection(state: GameState): GameState {
  if (!state.deployment || !state.battle) return state;
  const { playerId, count, selectedIds, wave, nextRound } = state.deployment;
  if (selectedIds.length !== count) return state;

  const players = clonePlayers(state.players);
  const player = players[playerId];
  const selectedCards = selectedIds
    .map((id) => player.hand.find((card) => card.id === id))
    .filter((card): card is CardData => Boolean(card));
  if (selectedCards.length !== count) return state;

  const selectedIdSet = new Set(selectedIds);
  const pools = clonePools(state.battle.pools);
  const log = [...state.battle.log];
  let nextState = state;

  for (const card of selectedCards) {
    const [creature, rolledState] = deployOneCreature(nextState, playerId, card, pools);
    nextState = rolledState;
    players[playerId].creatures.push(creature);
  }

  players[playerId] = {
    ...players[playerId],
    hand: player.hand.filter((card) => !selectedIdSet.has(card.id)),
  };
  log.unshift(
    `${PLAYERS[playerId].name} выводит ${selectedCards.length} корабля: ${selectedCards
      .map((card) => card.name_ru)
      .join(", ")}.`,
  );

  if (playerId === "A") {
    return {
      ...nextState,
      players,
      battle: {
        ...state.battle,
        pools,
        log: log.slice(0, 24),
      },
      deployment: {
        ...state.deployment,
        playerId: "B",
        selectedIds: [],
      },
    };
  }

  const queue = sortInitiative(allCreatures(players));
  const roundIntro =
    wave === 0
      ? "Бой начался: игроки сами выбрали стартовые 3 корабля, а кубы ушли в пулы владельцев."
      : `Раунд ${nextRound}: игроки сами выбрали подкрепления ${wave}/2.`;

  const battleState: BattleState = {
    ...state.battle,
    round: nextRound,
    reinforcementWave: wave,
    queue,
    activeCreatureId: queue[0] ?? null,
    needsDie: false,
    pools,
    selectedTargetId: null,
    log: [roundIntro, ...log].slice(0, 24),
  };

  if (queue.length === 0 || !bothSidesCanContinue(players)) {
    return finishGame({
      ...nextState,
      players,
      deployment: null,
      battle: battleState,
    });
  }

  return {
    ...nextState,
    phase: "battle",
    players,
    deployment: null,
    battle: battleState,
  };
}

function getCreature(players: Record<PlayerId, Player>, creatureId: string | null) {
  if (!creatureId) return null;
  return allCreatures(players).find((creature) => creature.id === creatureId) ?? null;
}

function updateCreature(
  players: Record<PlayerId, Player>,
  creatureId: string,
  updater: (creature: Creature) => Creature,
) {
  const nextPlayers = clonePlayers(players);
  for (const playerId of ["A", "B"] as PlayerId[]) {
    nextPlayers[playerId].creatures = nextPlayers[playerId].creatures.map((creature) =>
      creature.id === creatureId ? updater(creature) : creature,
    );
  }
  return nextPlayers;
}

function combinations<T>(items: T[]) {
  const result: T[][] = [];
  const total = 1 << items.length;
  for (let mask = 1; mask < total; mask += 1) {
    const combo: T[] = [];
    for (let bit = 0; bit < items.length; bit += 1) {
      if (mask & (1 << bit)) combo.push(items[bit]);
    }
    result.push(combo);
  }
  return result;
}

function findPayment(dice: Die[], cost: Cost) {
  const minByType = cost.requirements ?? {};
  const exactDice = cost.exact_dice;
  const threshold = cost.threshold ?? 0;

  return combinations(dice)
    .filter((combo) => (exactDice ? combo.length === exactDice : true))
    .filter((combo) => {
      const sum = combo.reduce((total, die) => total + die.value, 0);
      if (sum < threshold) return false;
      for (const [type, count] of Object.entries(minByType)) {
        if (!count) continue;
        const matching =
          type === "any"
            ? combo.length
            : combo.filter((die) => die.type === type).length;
        if (matching < count) return false;
      }
      if (cost.same_values && new Set(combo.map((die) => die.value)).size !== 1) {
        return false;
      }
      if (
        cost.different_values &&
        new Set(combo.map((die) => die.value)).size !== combo.length
      ) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const leftSum = left.reduce((total, die) => total + die.value, 0);
      const rightSum = right.reduce((total, die) => total + die.value, 0);
      if (leftSum !== rightSum) return leftSum - rightSum;
      return left.length - right.length;
    })[0];
}

function canTarget(
  effect: Effect,
  actor: Creature,
  target: Creature | null,
  pools?: Record<PlayerId, Die[]>,
) {
  if (!target || !target.alive) return false;
  if (effect.target === "enemy" && target.owner === actor.owner) return false;
  if (effect.target?.startsWith("ally") && target.owner !== actor.owner) return false;
  if (effect.target === "ally_other" && target.id === actor.id) return false;
  if (effect.target === "self" && target.id !== actor.id) return false;
  if (
    effect.condition === "target_has_no_dice" &&
    (pools?.[target.owner].length ?? target.attached.length) > 0
  ) {
    return false;
  }
  if (effect.condition === "target_damaged" && target.hp >= target.card.health) {
    return false;
  }
  return true;
}

function damageAmount(
  effect: Effect,
  actor: Creature,
  target: Creature,
  spent: Die[],
  pools?: Record<PlayerId, Die[]>,
) {
  if (effect.type === "damage_equal_spent_die_value") {
    return spent[0]?.value ?? 0;
  }

  let amount = effect.amount ?? 0;
  if (effect.condition === "target_damaged" && target.hp < target.card.health) {
    amount += effect.bonus_amount ?? 0;
  }
  if (effect.condition === "target_hp_lte_2" && target.hp <= 2) {
    amount = effect.override_amount ?? amount;
  }
  if (
    effect.condition === "target_has_die_value_1" &&
    (pools?.[target.owner] ?? target.attached).some((die) => die.value === 1)
  ) {
    amount += effect.bonus_amount ?? 0;
  }
  if (effect.condition === "self_full_hp" && actor.hp >= actor.card.health) {
    amount += effect.bonus_amount ?? 0;
  }
  return amount;
}

function chooseDefaultTarget(
  players: Record<PlayerId, Player>,
  actor: Creature,
  effect: Effect,
  preferredId: string | null,
  pools?: Record<PlayerId, Die[]>,
) {
  const preferred = getCreature(players, preferredId);
  if (canTarget(effect, actor, preferred, pools)) return preferred;

  const candidates = livingCreatures(players).filter((creature) =>
    canTarget(effect, actor, creature, pools),
  );
  if (effect.type === "heal" || effect.type === "heal_two_allies") {
    return candidates.sort(
      (left, right) =>
        right.card.health - right.hp - (left.card.health - left.hp),
    )[0];
  }
  return candidates.sort((left, right) => left.hp - right.hp)[0];
}

function abilityPrimaryObject(ability: Ability) {
  if (
    ability.effects.some((effect) =>
      [
        "return_target_die_to_pool",
        "decrease_target_die",
        "increase_target_ally_die",
      ].includes(effect.type),
    )
  ) {
    return "куб или карта";
  }
  if (ability.effects.some((effect) => effect.target === "enemy")) {
    return "карта врага";
  }
  if (ability.effects.some((effect) => effect.target?.startsWith("ally"))) {
    return "своя карта";
  }
  if (ability.effects.some((effect) => effect.target === "self")) {
    return "эта карта";
  }
  return "цель";
}

function spaceArtForCard(card: CardData) {
  const generatedArt = SPACE_CARD_ART_BY_ID[card.id];
  if (generatedArt) return generatedArt;

  const attack = card.dice.filter((die) => die === "attack").length;
  const defense = card.dice.filter((die) => die === "defense").length;
  const magic = card.dice.filter((die) => die === "magic").length;

  if (magic >= 3) return "/card-art/space/science-vessel.svg";
  if (defense >= 3 && card.glory >= 4) return "/card-art/space/carrier.svg";
  if (defense >= attack && defense >= magic) return "/card-art/space/shield-frigate.svg";
  if (attack >= 3 && card.health >= 5) return "/card-art/space/battleship.svg";
  if (attack >= 3 || card.initiative >= 7) return "/card-art/space/interceptor.svg";
  if (card.glory >= 4) return "/card-art/space/command-cruiser.svg";
  return "/card-art/space/carrier.svg";
}

function orderedBattleLine(players: Record<PlayerId, Player>) {
  return sortInitiative(allCreatures(players))
    .map((id) => getCreature(players, id))
    .filter((creature): creature is Creature => Boolean(creature));
}

function groupedDice(dice: Die[]) {
  return (["attack", "defense", "magic"] as DieType[]).map((type) => ({
    type,
    dice: dice
      .filter((die) => die.type === type)
      .sort((left, right) => {
        if (right.value !== left.value) return right.value - left.value;
        return left.id.localeCompare(right.id);
      }),
  }));
}

function cleanupDeaths(players: Record<PlayerId, Player>, log: string[]) {
  const nextPlayers = clonePlayers(players);
  for (const playerId of ["A", "B"] as PlayerId[]) {
    nextPlayers[playerId].creatures = nextPlayers[playerId].creatures.map((creature) => {
      if (creature.alive && creature.hp <= 0) {
        log.push(`${creature.card.name_ru} (${PLAYERS[playerId].short}) погибает.`);
        return { ...creature, alive: false, hp: 0, attached: [] };
      }
      return creature;
    });
  }
  return nextPlayers;
}

function bestDieForValueDecrease(dice: Die[], minValue: number) {
  return [...dice]
    .filter((die) => die.value > minValue)
    .sort((left, right) => {
      if (right.value !== left.value) return right.value - left.value;
      return left.id.localeCompare(right.id);
    })[0];
}

function bestDieForValueIncrease(dice: Die[], maxValue: number) {
  return [...dice]
    .filter((die) => die.value < maxValue)
    .sort((left, right) => {
      if (left.value !== right.value) return left.value - right.value;
      return left.id.localeCompare(right.id);
    })[0];
}

function bestDieForReturn(dice: Die[], valueMax: number) {
  return [...dice]
    .filter((die) => die.value <= valueMax)
    .sort((left, right) => {
      if (right.value !== left.value) return right.value - left.value;
      return left.id.localeCompare(right.id);
    })[0];
}

function updatePoolDie(
  pools: Record<PlayerId, Die[]>,
  playerId: PlayerId,
  dieId: string,
  updater: (die: Die) => Die,
) {
  pools[playerId] = pools[playerId].map((die) =>
    die.id === dieId ? updater(die) : die,
  );
}

function removePoolDice(
  pools: Record<PlayerId, Die[]>,
  playerId: PlayerId,
  dieIds: Set<string>,
) {
  pools[playerId] = pools[playerId].filter((die) => !dieIds.has(die.id));
}

function resolveAbility(
  state: GameState,
  ability: Ability,
  explicitTargetId?: string | null,
): GameState {
  if (!state.battle?.activeCreatureId) return state;
  const actor = getCreature(state.players, state.battle.activeCreatureId);
  if (!actor || !actor.alive) return state;

  const pools = clonePools(state.battle.pools);
  const actorPool = pools[actor.owner];
  const payment = findPayment(actorPool, ability.cost);
  if (!payment) return state;

  const spentIds = new Set(payment.map((die) => die.id));
  removePoolDice(pools, actor.owner, spentIds);
  let players = state.players;
  const actorAfterPayment = getCreature(players, actor.id) ?? actor;
  const log = [
    `${actor.card.name_ru} платит ${formatDiceList(payment)} за «${ability.name_ru}».`,
    ...state.battle.log,
  ];
  const preferredTargetId = explicitTargetId ?? state.battle.selectedTargetId;

  for (const effect of ability.effects) {
    if (effect.type === "adjust_own_die") {
      const min = effect.min ?? 1;
      const max = effect.max ?? 3;
      const amount = effect.amount ?? 1;
      const dieToAdjust =
        bestDieForValueIncrease(pools[actor.owner], max) ??
        bestDieForValueDecrease(pools[actor.owner], min);
      if (!dieToAdjust) {
        log.unshift("В пуле игрока нет куба, который можно изменить.");
        continue;
      }
      const nextValue =
        dieToAdjust.value < max
          ? Math.min(max, dieToAdjust.value + amount)
          : Math.max(min, dieToAdjust.value - amount);
      updatePoolDie(pools, actor.owner, dieToAdjust.id, (die) => ({
        ...die,
        value: nextValue,
      }));
      log.unshift(
        `${PLAYERS[actor.owner].name}: ${DIE_META[dieToAdjust.type].icon}${dieToAdjust.value} → ${DIE_META[dieToAdjust.type].icon}${nextValue}.`,
      );
      continue;
    }

    if (effect.type === "adjust_pool_die") {
      const min = effect.min ?? 1;
      const max = effect.max ?? 3;
      const amount = effect.amount ?? 1;
      const dieToAdjust =
        bestDieForValueIncrease(pools[actor.owner], max) ??
        bestDieForValueDecrease(pools[actor.owner], min);
      if (!dieToAdjust) {
        log.unshift("В пуле игрока нет куба, который можно изменить.");
        continue;
      }
      const nextValue =
        dieToAdjust.value < max
          ? Math.min(max, dieToAdjust.value + amount)
          : Math.max(min, dieToAdjust.value - amount);
      updatePoolDie(pools, actor.owner, dieToAdjust.id, (die) => ({
        ...die,
        value: nextValue,
      }));
      log.unshift(
        `${PLAYERS[actor.owner].name}: ${DIE_META[dieToAdjust.type].icon}${dieToAdjust.value} → ${DIE_META[dieToAdjust.type].icon}${nextValue}.`,
      );
      continue;
    }

    if (effect.type === "decrease_target_die") {
      const min = effect.min ?? 1;
      const amount = effect.amount ?? 1;
      const enemyId: PlayerId = actor.owner === "A" ? "B" : "A";
      const dieToDecrease = bestDieForValueDecrease(pools[enemyId], min);
      if (!dieToDecrease) {
        log.unshift("В пуле врага нет куба, который можно уменьшить.");
        continue;
      }
      const nextValue = Math.max(min, dieToDecrease.value - amount);
      updatePoolDie(pools, enemyId, dieToDecrease.id, (die) => ({
        ...die,
        value: nextValue,
      }));
      log.unshift(
        `${PLAYERS[enemyId].name}: ${DIE_META[dieToDecrease.type].icon}${dieToDecrease.value} → ${DIE_META[dieToDecrease.type].icon}${nextValue}.`,
      );
      continue;
    }

    if (effect.type === "increase_target_ally_die") {
      const max = effect.max ?? 3;
      const amount = effect.amount ?? 1;
      const dieToIncrease = bestDieForValueIncrease(pools[actor.owner], max);
      if (!dieToIncrease) {
        log.unshift("В пуле игрока нет куба, который можно увеличить.");
        continue;
      }
      const nextValue = Math.min(max, dieToIncrease.value + amount);
      updatePoolDie(pools, actor.owner, dieToIncrease.id, (die) => ({
        ...die,
        value: nextValue,
      }));
      log.unshift(
        `${PLAYERS[actor.owner].name}: ${DIE_META[dieToIncrease.type].icon}${dieToIncrease.value} → ${DIE_META[dieToIncrease.type].icon}${nextValue}.`,
      );
      continue;
    }

    if (effect.type === "return_target_die_to_pool") {
      const valueMax = effect.value_max ?? 3;
      const enemyId: PlayerId = actor.owner === "A" ? "B" : "A";
      const dieToReturn = bestDieForReturn(pools[enemyId], valueMax);
      if (!dieToReturn) {
        log.unshift(`В пуле врага нет куба значения ${valueMax} или ниже для сброса.`);
        continue;
      }
      removePoolDice(pools, enemyId, new Set([dieToReturn.id]));
      log.unshift(
        `${PLAYERS[enemyId].name} сбрасывает ${DIE_META[dieToReturn.type].icon}${dieToReturn.value} из своего пула.`,
      );
      continue;
    }

    if (effect.type === "move_own_die_to_ally") {
      log.unshift("Кубы уже находятся в общем пуле игрока — перенос между союзниками не нужен.");
      continue;
    }

    if (effect.type === "damage" || effect.type === "damage_equal_spent_die_value") {
      const target = chooseDefaultTarget(
        players,
        actorAfterPayment,
        effect,
        preferredTargetId ?? null,
        pools,
      );
      if (!target) {
        log.unshift("Нет легальной цели для урона — эффект пропущен.");
        continue;
      }
      const amount = damageAmount(effect, actorAfterPayment, target, payment, pools);
      players = updateCreature(players, target.id, (creature) => ({
        ...creature,
        hp: Math.max(0, creature.hp - amount),
      }));
      log.unshift(`${target.card.name_ru} получает ${amount} урона.`);
      players = cleanupDeaths(players, log);
      continue;
    }

    if (effect.type === "heal") {
      const target = chooseDefaultTarget(
        players,
        actorAfterPayment,
        effect,
        preferredTargetId ?? null,
        pools,
      );
      if (!target) {
        log.unshift("Нет легальной цели для лечения — эффект пропущен.");
        continue;
      }
      const amount = effect.amount ?? 0;
      players = updateCreature(players, target.id, (creature) => ({
        ...creature,
        hp: Math.min(creature.card.health, creature.hp + amount),
      }));
      log.unshift(`${target.card.name_ru} лечится на ${amount}.`);
      continue;
    }

    if (effect.type === "self_damage") {
      const amount = effect.amount ?? 0;
      players = updateCreature(players, actor.id, (creature) => ({
        ...creature,
        hp: Math.max(0, creature.hp - amount),
      }));
      log.unshift(`${actor.card.name_ru} получает ${amount} самоурона.`);
      players = cleanupDeaths(players, log);
      continue;
    }

    if (effect.type === "heal_two_allies") {
      const amount = effect.amount ?? 1;
      const targets = livingCreatures(players)
        .filter((creature) => creature.owner === actor.owner)
        .sort(
          (left, right) =>
            right.card.health - right.hp - (left.card.health - left.hp),
        )
        .slice(0, 2);
      for (const target of targets) {
        players = updateCreature(players, target.id, (creature) => ({
          ...creature,
          hp: Math.min(creature.card.health, creature.hp + amount),
        }));
      }
      log.unshift(`До двух союзников лечатся на ${amount}.`);
      continue;
    }

    log.unshift(`Сложный эффект «${effect.type}» пока оставлен как текст правила.`);
  }

  return {
    ...state,
    players,
    battle: {
      ...state.battle,
      pools,
      log: log.slice(0, 24),
    },
  };
}

function startNextRoundOrDeployment(state: GameState): GameState {
  if (!state.battle) return state;

  if (!bothSidesCanContinue(state.players)) {
    return finishGame(state);
  }

  if (state.battle.reinforcementWave < REINFORCEMENT_ROUNDS) {
    const nextWave = state.battle.reinforcementWave + 1;
    const count = Math.min(
      REINFORCEMENTS_PER_ROUND,
      state.players.A.hand.length,
      state.players.B.hand.length,
    );
    if (count > 0) {
      return {
        ...state,
        phase: "deploy_select",
        deployment: {
          playerId: "A",
          count,
          wave: nextWave,
          nextRound: state.battle.round + 1,
          selectedIds: [],
        },
        battle: {
          ...state.battle,
          queue: [],
          activeCreatureId: null,
          needsDie: false,
          selectedTargetId: null,
          log: [
            `Раунд ${state.battle.round} завершён. Выберите подкрепления ${nextWave}/2: по ${count} карте из руки.`,
            ...state.battle.log,
          ].slice(0, 24),
        },
      };
    }
  }

  const queue = sortInitiative(allCreatures(state.players));
  if (queue.length === 0 || !bothSidesCanContinue(state.players)) {
    return finishGame(state);
  }

  return {
    ...state,
    battle: {
      ...state.battle,
      round: state.battle.round + 1,
      queue,
      activeCreatureId: queue[0] ?? null,
      needsDie: false,
      selectedTargetId: null,
      log: [`Раунд ${state.battle.round + 1}: очередь инициативы обновлена.`, ...state.battle.log].slice(0, 24),
    },
  };
}

function bothSidesCanContinue(players: Record<PlayerId, Player>) {
  return (["A", "B"] as PlayerId[]).every(
    (playerId) =>
      players[playerId].creatures.some((creature) => creature.alive) ||
      players[playerId].hand.length > 0,
  );
}

function finishGame(state: GameState): GameState {
  const scoreA = score(state.players.A);
  const scoreB = score(state.players.B);
  const winner =
    scoreA === scoreB ? "Ничья" : scoreA > scoreB ? "Победил Игрок A" : "Победил Игрок B";
  return {
    ...state,
    phase: "finished",
    battle: state.battle
      ? {
          ...state.battle,
          activeCreatureId: null,
          needsDie: false,
          log: [`${winner}. Финальная слава: A ${scoreA} — B ${scoreB}.`, ...state.battle.log],
        }
      : state.battle,
  };
}

function advanceActivation(state: GameState): GameState {
  if (!state.battle) return state;
  const queue = state.battle.queue.filter((id) => {
    const creature = getCreature(state.players, id);
    return creature?.alive && id !== state.battle?.activeCreatureId;
  });

  if (queue.length === 0) return startNextRoundOrDeployment({ ...state, battle: { ...state.battle, queue } });

  return {
    ...state,
    battle: {
      ...state.battle,
      queue,
      activeCreatureId: queue[0],
      needsDie: false,
      selectedTargetId: null,
      log: [`Ход переходит к ${getCreature(state.players, queue[0])?.card.name_ru}.`, ...state.battle.log].slice(0, 24),
    },
  };
}

function formatDiceList(dice: Die[]) {
  return dice
    .map((die) => `${DIE_META[die.type].icon}${die.value}`)
    .join(" ");
}

function costText(cost: Cost) {
  const requirements = cost.requirements ?? {};
  const parts = (["attack", "defense", "magic"] as DieType[])
    .flatMap((type) => Array.from({ length: requirements[type] ?? 0 }, () => DIE_META[type].icon));
  if (requirements.any) parts.push(`${requirements.any} любых`);
  const suffixes = [
    cost.threshold ? `${cost.threshold}+` : "",
    cost.exact_dice ? `ровно ${cost.exact_dice}` : "",
    cost.same_values ? "одинаковые" : "",
    cost.different_values ? "разные" : "",
  ].filter(Boolean);
  return [...parts, ...suffixes].join(" ");
}

function abilityImpactBadges(ability: Ability) {
  const badges: { kind: "damage" | "heal" | "self" | "control"; label: string }[] = [];

  for (const effect of ability.effects) {
    if (effect.type === "damage_equal_spent_die_value") {
      badges.push({ kind: "damage", label: "Урон = куб" });
      continue;
    }

    if (effect.type === "damage") {
      const base = effect.amount ?? 0;
      if (effect.override_amount && effect.override_amount !== base) {
        badges.push({ kind: "damage", label: `Урон ${base}/${effect.override_amount}` });
      } else if (effect.bonus_amount) {
        badges.push({ kind: "damage", label: `Урон ${base}–${base + effect.bonus_amount}` });
      } else {
        badges.push({ kind: "damage", label: `Урон ${base}` });
      }
      continue;
    }

    if (effect.type === "heal") {
      badges.push({ kind: "heal", label: `Лечение ${effect.amount ?? 0}` });
      continue;
    }

    if (effect.type === "heal_two_allies") {
      badges.push({ kind: "heal", label: `Лечение 2×${effect.amount ?? 1}` });
      continue;
    }

    if (effect.type === "self_damage") {
      badges.push({ kind: "self", label: `Себе ${effect.amount ?? 0}` });
    }
  }

  if (!badges.some((badge) => badge.kind === "damage" || badge.kind === "heal")) {
    badges.push({ kind: "control", label: "Контроль" });
  }

  return badges;
}

function AbilityImpact({ ability }: { ability: Ability }) {
  return (
    <span className="impactBadges" aria-label="Сила способности">
      {abilityImpactBadges(ability).map((badge) => (
        <i className={`impactBadge ${badge.kind}`} key={`${ability.id}-${badge.label}`}>
          {badge.label}
        </i>
      ))}
    </span>
  );
}

function dominantDie(card: CardData) {
  const counts = card.dice.reduce(
    (acc, die) => ({ ...acc, [die]: acc[die] + 1 }),
    { attack: 0, defense: 0, magic: 0 } as Record<DieType, number>,
  );
  return (Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    "attack") as DieType;
}

function lightAbilityFor(card: CardData): Ability {
  const primary = dominantDie(card);
  const icon = DIE_META[primary].icon;

  if (primary === "defense") {
    return {
      id: "light_guard",
      name_ru: "Простая защита",
      text_ru: `${icon}3: восстанови 1 HP себе или союзнику.`,
      cost: { threshold: 3, requirements: { defense: 1 } },
      effects: [{ type: "heal", amount: 1, target: "ally" }],
    };
  }

  if (primary === "magic") {
    return {
      id: "light_spark",
      name_ru: "Простая искра",
      text_ru: `${icon}3: нанеси 1 урон.`,
      cost: { threshold: 3, requirements: { magic: 1 } },
      effects: [{ type: "damage", amount: 1, target: "enemy" }],
    };
  }

  return {
    id: "light_strike",
    name_ru: "Простой удар",
    text_ru: `${icon}3: нанеси 1 урон.`,
    cost: { threshold: 3, requirements: { attack: 1 } },
    effects: [{ type: "damage", amount: 1, target: "enemy" }],
  };
}

function cardsForRulesMode(cards: CardData[], mode: RulesMode) {
  if (mode === "full") return cards;
  return cards.map((card) => ({
    ...card,
    id: `${card.id}__light`,
    abilities: [lightAbilityFor(card)],
  }));
}

function diceCounts(card: CardData) {
  return (["attack", "defense", "magic"] as DieType[]).map((type) => ({
    type,
    count: card.dice.filter((die) => die === type).length,
  }));
}

function FrameDiceRail({ card }: { card: CardData }) {
  return (
    <div className="frameDiceRail" aria-label="Printed dice">
      {diceCounts(card).map(({ type, count }) => (
        <span className={`frameDiceBadge ${type}`} key={type}>
          <i>{DIE_META[type].icon}</i>
          <b>{count}</b>
        </span>
      ))}
    </div>
  );
}

function FrameStats({ card, owner }: { card: CardData; owner?: PlayerId }) {
  return (
    <div className="frameStats" aria-label="Card stats">
      <span className="frameStat initiative">⚡{card.initiative}</span>
      <span className="frameStat glory">★{card.glory}</span>
      {owner ? <span className={`frameOwner owner${owner}`}>{PLAYERS[owner].short}</span> : null}
    </div>
  );
}

function CardFrame({
  card,
  owner,
  compact,
  hpText,
  healthPercent,
  onArtClick,
  children,
}: {
  card: CardData;
  owner?: PlayerId;
  compact?: boolean;
  hpText: string;
  healthPercent?: number;
  onArtClick?: () => void;
  children?: ReactNode;
}) {
  const flavor = dominantDie(card);
  const art = spaceArtForCard(card);
  return (
    <div className={`cardFrame ${compact ? "compact" : ""}`}>
      <div className="frameHero">
        <div
          className={`frameArt ${onArtClick ? "frameArtButton" : ""}`}
          role={onArtClick ? "button" : undefined}
          tabIndex={onArtClick ? 0 : undefined}
          onClick={(event) => {
            if (!onArtClick) return;
            event.stopPropagation();
            onArtClick();
          }}
          onKeyDown={(event) => {
            if (!onArtClick) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onArtClick();
            }
          }}
        >
          <img alt="" src={art} />
        </div>
        <FrameDiceRail card={card} />
        <FrameStats card={card} owner={owner} />
        <div className="frameTitle">
          <strong>{card.name_ru}</strong>
          <small>{DIE_META[flavor].label}</small>
        </div>
        <div className="frameHp" aria-label="Health">
          {healthPercent !== undefined ? <i style={{ width: `${healthPercent}%` }} /> : null}
          <span>♥ {hpText}</span>
        </div>
      </div>
      {!compact ? <div className="frameRules">{children}</div> : null}
    </div>
  );
}

function HandCardButton({
  card,
  owner,
  selected,
  disabled,
  onClick,
  onInspect,
}: {
  card: CardData;
  owner: PlayerId;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  onInspect: () => void;
}) {
  const flavor = dominantDie(card);
  return (
    <button
      className={`card compact handChoiceCard ${flavor} ${selected ? "selected" : ""}`}
      disabled={disabled && !selected}
      onClick={onClick}
      type="button"
    >
      <CardFrame card={card} compact hpText={`${card.health}`} owner={owner} onArtClick={onInspect}>
        {card.abilities.map((ability) => (
          <p key={ability.id}>
            <span className="abilityLineHead">
              <b>{ability.name_ru}</b>
              <AbilityImpact ability={ability} />
            </span>
            <span className="abilityRule">{ability.text_ru}</span>
          </p>
        ))}
      </CardFrame>
    </button>
  );
}

function CreatureCard({
  creature,
  active,
  target,
  canUseAbilities,
  armed,
  ownerPool,
  onSelect,
  onAbilityDragStart,
  onAbilityDragEnd,
  onAbilityTap,
  onDropAbility,
  onInspect,
}: {
  creature: Creature;
  active: boolean;
  target: boolean;
  canUseAbilities: boolean;
  armed: boolean;
  ownerPool: Die[];
  onSelect: () => void;
  onAbilityDragStart: (ability: Ability) => void;
  onAbilityDragEnd: () => void;
  onAbilityTap: (ability: Ability) => void;
  onDropAbility: () => void;
  onInspect: () => void;
}) {
  const healthPercent = Math.max(0, (creature.hp / creature.card.health) * 100);
  return (
    <div
      role="button"
      tabIndex={0}
      className={`creature ${dominantDie(creature.card)} ${active ? "active" : ""} ${target ? "target" : ""} ${armed ? "armedTarget" : ""} ${!creature.alive ? "dead" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect();
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const payload = event.dataTransfer.getData("text/plain");
        if (payload.startsWith("ability:")) onDropAbility();
      }}
    >
      <CardFrame
        card={creature.card}
        healthPercent={healthPercent}
        hpText={`${creature.hp}/${creature.card.health}`}
        owner={creature.owner}
        onArtClick={onInspect}
      >
        {creature.card.abilities.map((ability) => {
          const payment = findPayment(ownerPool, ability.cost);
          const ready = canUseAbilities && Boolean(payment);
          return (
            <span
              className={`abilityChip ${ready ? "ready" : ""}`}
              draggable={ready}
              key={ability.id}
              role="button"
              tabIndex={ready ? 0 : -1}
              title={ability.text_ru}
              onClick={(event) => {
                event.stopPropagation();
                if (ready) onAbilityTap(ability);
              }}
              onDragStart={(event) => {
                if (!ready) return;
                event.dataTransfer.setData("text/plain", `ability:${ability.id}`);
                onAbilityDragStart(ability);
              }}
              onDragEnd={() => {
                onAbilityDragEnd();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && ready) onAbilityTap(ability);
              }}
            >
              <b>{ability.name_ru}</b>
              <AbilityImpact ability={ability} />
              <small>
                {costText(ability.cost)} → {abilityPrimaryObject(ability)}
              </small>
            </span>
          );
        })}
      </CardFrame>
    </div>
  );
}

function MiniHandCard({
  card,
  owner,
  onInspect,
}: {
  card: CardData;
  owner: PlayerId;
  onInspect: () => void;
}) {
  return (
    <button
      className={`miniHandCard ${dominantDie(card)}`}
      type="button"
      onClick={onInspect}
      title={card.name_ru}
    >
      <CardFrame card={card} compact hpText={`${card.health}`} owner={owner} />
    </button>
  );
}

function HandsOverview({
  players,
  onInspect,
}: {
  players: Record<PlayerId, Player>;
  onInspect: (card: CardData, owner: PlayerId) => void;
}) {
  return (
    <section className="handsOverview" aria-label="Руки игроков">
      {(["A", "B"] as PlayerId[]).map((playerId) => (
        <div className={`handRow player${playerId}`} key={playerId}>
          <div className="handRowHead">
            <strong>Рука {PLAYERS[playerId].short}</strong>
            <span>{players[playerId].hand.length}</span>
          </div>
          <div className="miniHandCards">
            {players[playerId].hand.length ? (
              players[playerId].hand.map((card) => (
                <MiniHandCard
                  card={card}
                  key={card.id}
                  owner={playerId}
                  onInspect={() => onInspect(card, playerId)}
                />
              ))
            ) : (
              <span className="emptyHand">рука пуста</span>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function CardInspectModal({
  card,
  owner,
  onClose,
}: {
  card: CardData;
  owner?: PlayerId;
  onClose: () => void;
}) {
  return (
    <div className="cardModalBackdrop">
      <div
        aria-modal="true"
        className="cardModal"
        role="dialog"
        aria-label={card.name_ru}
      >
        <button className="modalClose" type="button" onClick={onClose}>
          закрыть
        </button>
        <CardFrame card={card} hpText={`${card.health}`} owner={owner}>
          {card.abilities.map((ability) => (
            <p key={ability.id}>
              <span className="abilityLineHead">
                <b>{ability.name_ru}</b>
                <AbilityImpact ability={ability} />
              </span>
              <span className="abilityRule">{ability.text_ru}</span>
            </p>
          ))}
        </CardFrame>
      </div>
    </div>
  );
}

function RulesGuide() {
  return (
    <section className="rulesGuide" aria-label="Правила и описание игры">
      <details open>
        <summary>
          <span>
            <b>Правила / как играть</b>
            <small>Космическая версия боевого теста</small>
          </span>
        </summary>
        <div className="rulesGrid">
          <article>
            <h3>Что это?</h3>
            <p>
              Space Combat Draft — отдельный прототип боя для космической 4X. Он сохраняет
              идею карт и кубов, но делит экономику на два пула: у каждого игрока свой общий
              пул кубов.
            </p>
          </article>
          <article>
            <h3>Быстрый старт</h3>
            <ol>
              <li>Нажми “новая битва”, чтобы получить новую случайную руку из 6 карт.</li>
              <li>Для простой партии включи Light mode.</li>
              <li>Меняй seed, чтобы повторять или сравнивать конкретную раздачу.</li>
            </ol>
          </article>
          <article>
            <h3>Колоды</h3>
            <p>
              У каждого игрока одинаковая сбалансированная колода из 10 карт. Перед боем
              каждая колода отдельно перемешивается, и из неё случайно берутся 6 карт в руку.
              Игрок сам выбирает 3 стартовых корабля, затем 2 раунда подкреплений по 1 кораблю.
            </p>
          </article>
          <article>
            <h3>Бой</h3>
            <p>
              Корабли ходят по инициативе: чем выше значение, тем раньше ход. В начале боя
              у каждого игрока на линии 3 корабля.
            </p>
          </article>
          <article>
            <h3>Кубы и способности</h3>
            <p>
              При выходе корабль сразу бросает свои напечатанные кубы и добавляет их в общий
              пул своего игрока. Активный корабль тратит кубы из пула владельца. Если куб
              больше нужного значения, он всё равно тратится целиком.
            </p>
          </article>
          <article>
            <h3>Цели и победа</h3>
            <p>
              Способность перетаскивается на корабль-цель, если эффект это позволяет. В конце
              побеждает игрок с большей славой на выживших кораблях.
            </p>
          </article>
        </div>
        <p className="rulesFootnote">
          Подсказка: слева на карте показано, какие кубы корабль добавляет в пул, справа —
          инициатива и слава, по центру — прочность, снизу — способности и их цена.
        </p>
      </details>
    </section>
  );
}

function PlayerPoolPanel({ playerId, dice }: { playerId: PlayerId; dice: Die[] }) {
  return (
    <div className={`poolGroup playerPool player${playerId}`}>
      <div className="poolGroupHead">
        <strong>Пул {PLAYERS[playerId].short}</strong>
        <span>{dice.length}</span>
      </div>
      <div className="poolGroupDice">
        {dice.length ? (
          groupedDice(dice).map((group) => (
            <div className="poolTypeLine" key={group.type}>
              <b>{DIE_META[group.type].icon}</b>
              <span>
                {group.dice.length
                  ? group.dice.map((die) => (
                      <i className={`die ${die.type}`} key={die.id}>
                        {die.value}
                      </i>
                    ))
                  : "—"}
              </span>
            </div>
          ))
        ) : (
          <span className="muted">пул пуст</span>
        )}
      </div>
    </div>
  );
}

export function SpaceCombatGame() {
  const [state, setState] = useState<GameState>(() => initialState());
  const [fullCards, setFullCards] = useState<CardData[]>([]);
  const [initialRulesMode] = useState<RulesMode>(() => readStoredRulesMode());
  const [rulesMode, setRulesMode] = useState<RulesMode>(initialRulesMode);
  const [seedInput, setSeedInput] = useState(DEFAULT_SEED_TEXT);
  const [gameScale, setGameScale] = useState(() => readStoredGameScale());
  const [armedAbilityId, setArmedAbilityId] = useState<string | null>(null);
  const [draggedAbilityId, setDraggedAbilityId] = useState<string | null>(null);
  const [inspectedCard, setInspectedCard] = useState<{
    card: CardData;
    owner?: PlayerId;
  } | null>(null);
  const cardsLoaded = fullCards.length > 0;

  useEffect(() => {
    let cancelled = false;
    fetch("/cards.v0.3.json")
      .then((response) => response.json())
      .then((data: { cards: CardData[] }) => {
        if (cancelled) return;
        setFullCards(data.cards);
        setState(makeRandomBattle(cardsForRulesMode(data.cards, initialRulesMode), DEFAULT_SEED_TEXT));
      });
    return () => {
      cancelled = true;
    };
  }, [initialRulesMode]);

  useEffect(() => {
    window.localStorage.setItem("space-combat-scale", String(gameScale));
  }, [gameScale]);

  useEffect(() => {
    window.localStorage.setItem("space-combat-rules-mode", rulesMode);
  }, [rulesMode]);

  useEffect(() => {
    if (!inspectedCard) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setInspectedCard(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [inspectedCard]);

  const activeCreature = useMemo(
    () => getCreature(state.players, state.battle?.activeCreatureId ?? null),
    [state.players, state.battle?.activeCreatureId],
  );
  const battleLine = useMemo(
    () => orderedBattleLine(state.players),
    [state.players],
  );
  const activeAbility =
    activeCreature?.card.abilities.find(
      (ability) => ability.id === (draggedAbilityId ?? armedAbilityId),
    ) ?? null;

  function restart(seedText = seedInput) {
    if (!cardsLoaded) return;
    setArmedAbilityId(null);
    setDraggedAbilityId(null);
    setInspectedCard(null);
    setState(makeRandomBattle(cardsForRulesMode(fullCards, rulesMode), seedText));
    setSeedInput(seedText);
  }

  function startRandomBattle(seedText = seedInput) {
    restart(seedText);
  }

  function inspectCard(card: CardData, owner?: PlayerId) {
    setInspectedCard({ card, owner });
  }

  function switchRulesMode(nextMode: RulesMode) {
    if (!cardsLoaded || nextMode === rulesMode) return;
    const cards = cardsForRulesMode(fullCards, nextMode);
    setRulesMode(nextMode);
    setArmedAbilityId(null);
    setDraggedAbilityId(null);
    setInspectedCard(null);
    setState(makeRandomBattle(cards, seedInput));
  }

  function toggleDeploymentCard(cardId: string) {
    if (!state.deployment) return;
    const selectedIds = state.deployment.selectedIds;
    const nextSelectedIds = selectedIds.includes(cardId)
      ? selectedIds.filter((id) => id !== cardId)
      : selectedIds.length < state.deployment.count
        ? [...selectedIds, cardId]
        : selectedIds;

    setState({
      ...state,
      deployment: {
        ...state.deployment,
        selectedIds: nextSelectedIds,
      },
    });
  }

  function confirmDeployment() {
    setArmedAbilityId(null);
    setDraggedAbilityId(null);
    setState((current) => confirmDeploymentSelection(current));
  }

  function activateAbilityOnCreature(creatureId: string) {
    if (!activeAbility) return;
    setState(resolveAbility(state, activeAbility, creatureId));
    setArmedAbilityId(null);
    setDraggedAbilityId(null);
  }

  function armAbility(ability: Ability) {
    if (!activeCreature || state.battle?.needsDie) return;
    const ownerPool = state.battle?.pools[activeCreature.owner] ?? [];
    if (!findPayment(ownerPool, ability.cost)) return;
    setArmedAbilityId((current) => (current === ability.id ? null : ability.id));
  }

  function setTarget(creatureId: string) {
    if (!state.battle) return;
    setState({
      ...state,
      battle: {
        ...state.battle,
        selectedTargetId:
          state.battle.selectedTargetId === creatureId ? null : creatureId,
      },
    });
  }

  function skipActive() {
    if (!state.battle || !activeCreature) return;
    setArmedAbilityId(null);
    setDraggedAbilityId(null);
    setState(
      advanceActivation({
        ...state,
        battle: {
          ...state.battle,
          log: [`${activeCreature.card.name_ru} завершает активацию.`, ...state.battle.log].slice(0, 24),
        },
      }),
    );
  }

  const deploymentPlayer = state.deployment
    ? state.players[state.deployment.playerId]
    : null;

  return (
    <main
      className={`shell ${
        state.phase === "deploy_select" || state.phase === "battle" || state.phase === "finished"
          ? "battleShell"
          : ""
      }`}
      style={{ "--game-scale": gameScale / 100 } as CSSProperties}
    >
      <section className="hero">
        <div>
          <p className="eyebrow">
            Space Combat Draft · v0.1 · 10 карт в колоде · {rulesMode === "light" ? "Light" : "Full"}
          </p>
          <h1>Космическая боевая система</h1>
          <p>
            Альтернативный тест для космической 4X: у каждого игрока симметричная колода из 10 карт,
            перед боем случайно берутся 6 в руку. Игрок сам выбирает 3 корабля на старт, затем
            ещё 2 раунда подкреплений по 1 кораблю, а кубы идут в общий пул своего игрока.
          </p>
        </div>
        <figure className="coverPreview">
          <img alt="Космический арт обложки карт" src={SPACE_CARD_COVER_ART} />
          <figcaption>обложка карт</figcaption>
        </figure>
        <div className="seedBox">
          <label htmlFor="seed">Seed партии</label>
          <div>
            <input
              id="seed"
              value={seedInput}
              onChange={(event) => setSeedInput(event.target.value)}
            />
            <button type="button" onClick={() => restart(seedInput)}>
              новая битва
            </button>
            <button
              type="button"
              className="quickBattle"
              disabled={!cardsLoaded}
              onClick={() => startRandomBattle(seedInput)}
            >
              пересдать руку
            </button>
            <button
              type="button"
              className={`modeToggle ${rulesMode === "light" ? "active" : ""}`}
              disabled={!cardsLoaded}
              onClick={() => switchRulesMode(rulesMode === "light" ? "full" : "light")}
            >
              {rulesMode === "light" ? "Light включён" : "Light режим"}
            </button>
          </div>
          <p className="modeHint">
            {rulesMode === "light"
              ? "Light: у каждой карты одна простая способность для быстрых тестов."
              : "Full: полный набор способностей и эффектов."}
          </p>
          <div className="scaleControl">
            <span>Масштаб игры</span>
            <input
              aria-label="Масштаб игры"
              max="110"
              min="70"
              step="5"
              type="range"
              value={gameScale}
              onChange={(event) => setGameScale(Number(event.target.value))}
            />
            <strong>{gameScale}%</strong>
          </div>
        </div>
      </section>

      <RulesGuide />

      <section className="scoreBar">
        <div>
          <span>{PLAYERS.A.name}</span>
          <strong>{state.players.A.roster.length} в колоде · {state.players.A.hand.length} в руке · ★{score(state.players.A)}</strong>
        </div>
        <div>
          <span>{PLAYERS.B.name}</span>
          <strong>{state.players.B.roster.length} в колоде · {state.players.B.hand.length} в руке · ★{score(state.players.B)}</strong>
        </div>
      </section>

      {state.phase === "loading" ? (
        <section className="panel">Загружаю карты…</section>
      ) : null}

      {state.phase !== "loading" ? (
        <HandsOverview players={state.players} onInspect={inspectCard} />
      ) : null}

      {state.phase === "deploy_select" && state.deployment && deploymentPlayer ? (
        <section className="panel deploymentPanel">
          <div className="phaseHead">
            <div>
              <p className="eyebrow">
                {state.deployment.wave === 0
                  ? "Стартовая выкладка"
                  : `Подкрепления ${state.deployment.wave}/${REINFORCEMENT_ROUNDS}`}
              </p>
              <h2>
                {deploymentPlayer.name}: выбери {state.deployment.count} из руки ·{" "}
                {state.deployment.selectedIds.length}/{state.deployment.count}
              </h2>
            </div>
            <button
              type="button"
              disabled={state.deployment.selectedIds.length !== state.deployment.count}
              onClick={confirmDeployment}
            >
              подтвердить
            </button>
          </div>
          <div className="deploymentMeta">
            <span>{state.deployment.wave === 0 ? "Перед боем" : `Перед раундом ${state.deployment.nextRound}`}</span>
            <strong>
              {state.deployment.wave === 0
                ? "выберите стартовые корабли"
                : "выберите корабли, которые войдут подкреплением"}
            </strong>
            <span>Осталось в руке: {deploymentPlayer.hand.length}</span>
          </div>
          <div className="cardGrid">
            {deploymentPlayer.hand.map((card) => {
              const selected = state.deployment?.selectedIds.includes(card.id) ?? false;
              return (
                <HandCardButton
                  card={card}
                  disabled={
                    Boolean(state.deployment) &&
                    state.deployment.selectedIds.length >= state.deployment.count
                  }
                  key={card.id}
                  owner={state.deployment?.playerId ?? "A"}
                  selected={selected}
                  onInspect={() => inspectCard(card, state.deployment?.playerId ?? "A")}
                  onClick={() => toggleDeploymentCard(card.id)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {(state.phase === "battle" || state.phase === "finished") && state.battle ? (
        <section className="battleGrid">
          <div className="panel battlePanel">
            <div className="phaseHead">
              <div>
                <p className="eyebrow">Бой · раунд {state.battle.round}</p>
                <h2>
                  {state.phase === "finished"
                    ? "Партия завершена"
                    : activeCreature
                      ? `Активен: ${activeCreature.card.name_ru} (${PLAYERS[activeCreature.owner].short})`
                      : "Очередь пуста"}
                </h2>
              </div>
              <button type="button" onClick={() => setState(finishGame(state))}>
                закончить бой
              </button>
            </div>

            <div className="pool">
              <p>Пулы кубов игроков</p>
              <div className="poolGroups">
                <PlayerPoolPanel dice={state.battle.pools.A} playerId="A" />
                <PlayerPoolPanel dice={state.battle.pools.B} playerId="B" />
                <div className="poolGroup magic">
                  <div className="poolGroupHead">
                    <strong>Правило</strong>
                    <span>{OPENING_CARDS_PER_PLAYER}+{REINFORCEMENT_ROUNDS}×{REINFORCEMENTS_PER_ROUND}</span>
                  </div>
                  <span className="muted">
                    Корабль при выходе бросает напечатанные кубы в общий пул своего игрока.
                  </span>
                </div>
              </div>
            </div>

            {activeCreature && state.phase === "battle" ? (
              <div className="actionBox">
                <p>
                  {state.battle.needsDie
                    ? "Кубы уже находятся в пуле владельца активного корабля."
                    : activeAbility
                      ? `Выбрана «${activeAbility.name_ru}». Перетащи её на карту или тапни по цели.`
                      : "Готовые способности видны на активном корабле, если в пуле его игрока хватает кубов. Перетащи способность на цель или тапни способность, потом цель."}
                </p>
                <div className="abilityActions">
                  <button type="button" className="secondary" onClick={skipActive}>
                    завершить активацию
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!activeAbility}
                    onClick={() => {
                      setArmedAbilityId(null);
                      setDraggedAbilityId(null);
                    }}
                  >
                    отменить способность
                  </button>
                </div>
                <p className="hint">
                  Оплата списывает минимальную подходящую сумму кубов. Если точной
                  суммы нет, целый куб переплачивает остаток.
                </p>
              </div>
            ) : null}

            <div className="initiativeBoard">
              <div className="initiativeMeta">
                <span>{PLAYERS.A.name} сверху</span>
                <strong>общая очередь: инициатива ↓, затем Glory ↑</strong>
                <span>{PLAYERS.B.name} снизу</span>
              </div>
              <div className="initiativeScroller">
                <div className="initiativeLine">
                  {battleLine.map((creature, index) => (
                    <div className="initiativeColumn" key={creature.id}>
                      <div className="slot topSlot">
                        {creature.owner === "A" ? (
                          <CreatureCard
                            armed={Boolean(activeAbility)}
                            canUseAbilities={
                              creature.id === state.battle?.activeCreatureId &&
                              !state.battle.needsDie
                            }
                            creature={creature}
                            ownerPool={state.battle.pools[creature.owner]}
                            active={creature.id === state.battle?.activeCreatureId}
                            target={creature.id === state.battle?.selectedTargetId}
                            onAbilityDragStart={(ability) => {
                              setDraggedAbilityId(ability.id);
                              setArmedAbilityId(ability.id);
                            }}
                            onAbilityDragEnd={() => setDraggedAbilityId(null)}
                            onAbilityTap={armAbility}
                            onDropAbility={() => activateAbilityOnCreature(creature.id)}
                            onInspect={() => inspectCard(creature.card, creature.owner)}
                            onSelect={() => {
                              if (activeAbility) activateAbilityOnCreature(creature.id);
                              else setTarget(creature.id);
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="axis">
                        <span>{index + 1}</span>
                        <i>⚡{creature.card.initiative}</i>
                      </div>
                      <div className="slot bottomSlot">
                        {creature.owner === "B" ? (
                          <CreatureCard
                            armed={Boolean(activeAbility)}
                            canUseAbilities={
                              creature.id === state.battle?.activeCreatureId &&
                              !state.battle.needsDie
                            }
                            creature={creature}
                            ownerPool={state.battle.pools[creature.owner]}
                            active={creature.id === state.battle?.activeCreatureId}
                            target={creature.id === state.battle?.selectedTargetId}
                            onAbilityDragStart={(ability) => {
                              setDraggedAbilityId(ability.id);
                              setArmedAbilityId(ability.id);
                            }}
                            onAbilityDragEnd={() => setDraggedAbilityId(null)}
                            onAbilityTap={armAbility}
                            onDropAbility={() => activateAbilityOnCreature(creature.id)}
                            onInspect={() => inspectCard(creature.card, creature.owner)}
                            onSelect={() => {
                              if (activeAbility) activateAbilityOnCreature(creature.id);
                              else setTarget(creature.id);
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="reinforcementInfo">
                <span>
                  Рука A: {state.players.A.hand.length}
                </span>
                <span>
                  Рука B: {state.players.B.hand.length}
                </span>
              </div>
            </div>
          </div>

          <aside className="panel notes">
            <details open>
              <summary>
                Журнал <span>{state.battle.log.length}</span>
              </summary>
              <ol>
                {state.battle.log.slice(0, 8).map((entry, index) => (
                  <li key={`${entry}-${index}`}>{entry}</li>
                ))}
              </ol>
            </details>
            <details>
              <summary>Допущения</summary>
              <ul>
                <li>Сложные эффекты движения/кражи/изменения кубов пока не исполняются.</li>
                <li>Можно применить несколько способностей за одну активацию, если хватает кубов.</li>
                <li>Кубы погибшего существа удаляются из игры.</li>
                <li>Финальная ничья инициативы решается стабильным порядком A/B + id карты.</li>
              </ul>
            </details>
          </aside>
        </section>
      ) : null}
      {inspectedCard ? (
        <CardInspectModal
          card={inspectedCard.card}
          owner={inspectedCard.owner}
          onClose={() => setInspectedCard(null)}
        />
      ) : null}
    </main>
  );
}
