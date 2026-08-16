"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type PlayerId = "A" | "B";
type Phase = "loading" | "draft" | "deck_select" | "battle" | "finished";
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
  drafted: CardData[];
  deck: CardData[];
  creatures: Creature[];
  nextDeckIndex: number;
};

type DraftState = {
  packIndex: number;
  pickIndex: number;
  pack: CardData[];
  packs: CardData[][];
};

type BattleState = {
  round: number;
  queue: string[];
  activeCreatureId: string | null;
  needsDie: boolean;
  pool: Die[];
  selectedTargetId: string | null;
  log: string[];
};

type GameState = {
  phase: Phase;
  seedText: string;
  rng: number;
  allCards: CardData[];
  players: Record<PlayerId, Player>;
  draft: DraftState | null;
  selecting: PlayerId;
  selectedForDeck: Record<PlayerId, string[]>;
  battle: BattleState | null;
  nextCreatureNumber: number;
  nextDieNumber: number;
};

const DIE_FACE_VALUES = [1, 1, 2, 2, 3, 3];
const OPENING_CARDS_PER_PLAYER = 3;
const RESERVE_CARDS_PER_PLAYER = 2;
const BATTLE_DECK_SIZE = OPENING_CARDS_PER_PLAYER + RESERVE_CARDS_PER_PLAYER;
const DEFAULT_SEED_TEXT = "playtest-01";

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
    drafted: [],
    deck: [],
    creatures: [],
    nextDeckIndex: 0,
  },
  B: {
    id: "B",
    name: PLAYERS.B.name,
    drafted: [],
    deck: [],
    creatures: [],
    nextDeckIndex: 0,
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

function currentPicker(draft: DraftState): PlayerId {
  const orderA: PlayerId[] = ["A", "B", "B", "A"];
  const orderB: PlayerId[] = ["B", "A", "A", "B"];
  return (draft.packIndex % 2 === 0 ? orderA : orderB)[draft.pickIndex];
}

function initialState(): GameState {
  return {
    phase: "loading",
    seedText: DEFAULT_SEED_TEXT,
    rng: hashSeed(DEFAULT_SEED_TEXT),
    allCards: [],
    players: structuredClone(EMPTY_PLAYERS),
    draft: null,
    selecting: "A",
    selectedForDeck: { A: [], B: [] },
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

function makeDraft(cards: CardData[], seedText: string): GameState {
  const [shuffled, rng] = shuffleWithSeed(cards, hashSeed(seedText));
  const packs = Array.from({ length: 5 }, (_, packIndex) =>
    shuffled.slice(packIndex * 4, packIndex * 4 + 4),
  );

  return {
    ...initialState(),
    phase: "draft",
    seedText,
    rng,
    allCards: cards,
    draft: {
      packIndex: 0,
      pickIndex: 0,
      pack: packs[0],
      packs,
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

function clonePlayers(players: Record<PlayerId, Player>): Record<PlayerId, Player> {
  return {
    A: {
      ...players.A,
      drafted: [...players.A.drafted],
      deck: [...players.A.deck],
      creatures: players.A.creatures.map((creature) => ({
        ...creature,
        attached: [...creature.attached],
      })),
    },
    B: {
      ...players.B,
      drafted: [...players.B.drafted],
      deck: [...players.B.deck],
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
): [Creature, GameState] {
  const attached: Die[] = [];
  const creature: Creature = {
    id: `c${state.nextCreatureNumber}`,
    owner: playerId,
    card,
    hp: card.health,
    attached,
    alive: true,
  };
  let nextState = {
    ...state,
    nextCreatureNumber: state.nextCreatureNumber + 1,
  };

  for (const dieType of card.dice) {
    const [die, rolledState] = rollDie(dieType, nextState);
    nextState = rolledState;
    attached.push(die);
  }

  return [creature, nextState];
}

function startBattle(state: GameState): GameState {
  const players = clonePlayers(state.players);
  let nextState = state;

  for (const playerId of ["A", "B"] as PlayerId[]) {
    const openingCards = players[playerId].deck.slice(0, OPENING_CARDS_PER_PLAYER);
    const deployed: Creature[] = [];
    for (const card of openingCards) {
      const [creature, rolledState] = deployOneCreature(nextState, playerId, card);
      nextState = rolledState;
      deployed.push(creature);
    }
    players[playerId] = {
      ...players[playerId],
      creatures: deployed,
      nextDeckIndex: openingCards.length,
    };
  }

  const queue = sortInitiative(allCreatures(players));
  return {
    ...nextState,
    phase: "battle",
    players,
    battle: {
      round: 1,
      queue,
      activeCreatureId: queue[0] ?? null,
      needsDie: false,
      pool: [],
      selectedTargetId: null,
      log: [
        "Бой начался: каждый игрок выставил 3 корабля, а напечатанные кубы легли прямо на свои карты.",
      ],
    },
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
) {
  if (!target || !target.alive) return false;
  if (effect.target === "enemy" && target.owner === actor.owner) return false;
  if (effect.target?.startsWith("ally") && target.owner !== actor.owner) return false;
  if (effect.target === "ally_other" && target.id === actor.id) return false;
  if (effect.target === "self" && target.id !== actor.id) return false;
  if (effect.condition === "target_has_no_dice" && target.attached.length > 0) {
    return false;
  }
  if (effect.condition === "target_damaged" && target.hp >= target.card.health) {
    return false;
  }
  return true;
}

function damageAmount(effect: Effect, actor: Creature, target: Creature, spent: Die[]) {
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
    target.attached.some((die) => die.value === 1)
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
) {
  const preferred = getCreature(players, preferredId);
  if (canTarget(effect, actor, preferred)) return preferred;

  const candidates = livingCreatures(players).filter((creature) =>
    canTarget(effect, actor, creature),
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

function findCreatureWithDie(
  players: Record<PlayerId, Player>,
  actor: Creature,
  preferredId: string | null,
  predicate: (die: Die) => boolean,
  side: "ally" | "enemy" | "any",
) {
  const preferred = getCreature(players, preferredId);
  if (
    preferred?.alive &&
    preferred.attached.some(predicate) &&
    (side === "any" ||
      (side === "ally" && preferred.owner === actor.owner) ||
      (side === "enemy" && preferred.owner !== actor.owner))
  ) {
    return preferred;
  }

  return livingCreatures(players)
    .filter((creature) => {
      if (side === "ally" && creature.owner !== actor.owner) return false;
      if (side === "enemy" && creature.owner === actor.owner) return false;
      return creature.attached.some(predicate);
    })
    .sort((left, right) => {
      const leftBest = Math.max(...left.attached.filter(predicate).map((die) => die.value));
      const rightBest = Math.max(...right.attached.filter(predicate).map((die) => die.value));
      if (rightBest !== leftBest) return rightBest - leftBest;
      return left.card.initiative - right.card.initiative;
    })[0];
}

function resolveAbility(
  state: GameState,
  ability: Ability,
  explicitTargetId?: string | null,
): GameState {
  if (!state.battle?.activeCreatureId) return state;
  const actor = getCreature(state.players, state.battle.activeCreatureId);
  if (!actor || !actor.alive) return state;

  const payment = findPayment(actor.attached, ability.cost);
  if (!payment) return state;

  const spentIds = new Set(payment.map((die) => die.id));
  let players = updateCreature(state.players, actor.id, (creature) => ({
    ...creature,
    attached: creature.attached.filter((die) => !spentIds.has(die.id)),
  }));
  const actorAfterPayment = getCreature(players, actor.id) ?? actor;
  const log = [
    `${actor.card.name_ru} платит ${formatDiceList(payment)} за «${ability.name_ru}».`,
    ...state.battle.log,
  ];
  const preferredTargetId = explicitTargetId ?? state.battle.selectedTargetId;

  for (const effect of ability.effects) {
    if (effect.type === "adjust_own_die") {
      const currentActor = getCreature(players, actor.id) ?? actorAfterPayment;
      const min = effect.min ?? 1;
      const max = effect.max ?? 3;
      const amount = effect.amount ?? 1;
      const dieToAdjust =
        bestDieForValueIncrease(currentActor.attached, max) ??
        bestDieForValueDecrease(currentActor.attached, min);
      if (!dieToAdjust) {
        log.unshift("На этой карте нет куба, который можно изменить.");
        continue;
      }
      const nextValue =
        dieToAdjust.value < max
          ? Math.min(max, dieToAdjust.value + amount)
          : Math.max(min, dieToAdjust.value - amount);
      players = updateCreature(players, currentActor.id, (creature) => ({
        ...creature,
        attached: creature.attached.map((die) =>
          die.id === dieToAdjust.id ? { ...die, value: nextValue } : die,
        ),
      }));
      log.unshift(
        `${currentActor.card.name_ru}: ${DIE_META[dieToAdjust.type].icon}${dieToAdjust.value} → ${DIE_META[dieToAdjust.type].icon}${nextValue}.`,
      );
      continue;
    }

    if (effect.type === "adjust_pool_die") {
      const min = effect.min ?? 1;
      const max = effect.max ?? 3;
      const amount = effect.amount ?? 1;
      const currentActor = getCreature(players, actor.id) ?? actorAfterPayment;
      const dieToAdjust =
        bestDieForValueIncrease(currentActor.attached, max) ??
        bestDieForValueDecrease(currentActor.attached, min);
      if (!dieToAdjust) {
        log.unshift("На активной карте нет куба, который можно изменить.");
        continue;
      }
      const nextValue =
        dieToAdjust.value < max
          ? Math.min(max, dieToAdjust.value + amount)
          : Math.max(min, dieToAdjust.value - amount);
      players = updateCreature(players, currentActor.id, (creature) => ({
        ...creature,
        attached: creature.attached.map((die) =>
          die.id === dieToAdjust.id ? { ...die, value: nextValue } : die,
        ),
      }));
      log.unshift(
        `${currentActor.card.name_ru}: ${DIE_META[dieToAdjust.type].icon}${dieToAdjust.value} → ${DIE_META[dieToAdjust.type].icon}${nextValue}.`,
      );
      continue;
    }

    if (effect.type === "decrease_target_die") {
      const min = effect.min ?? 1;
      const amount = effect.amount ?? 1;
      const target = findCreatureWithDie(
        players,
        actorAfterPayment,
        preferredTargetId ?? null,
        (die) => die.value > min,
        "enemy",
      );
      const dieToDecrease = target
        ? bestDieForValueDecrease(target.attached, min)
        : null;
      if (!target || !dieToDecrease) {
        log.unshift("Нет вражеского куба, который можно уменьшить.");
        continue;
      }
      const nextValue = Math.max(min, dieToDecrease.value - amount);
      players = updateCreature(players, target.id, (creature) => ({
        ...creature,
        attached: creature.attached.map((die) =>
          die.id === dieToDecrease.id ? { ...die, value: nextValue } : die,
        ),
      }));
      log.unshift(
        `${target.card.name_ru}: ${DIE_META[dieToDecrease.type].icon}${dieToDecrease.value} → ${DIE_META[dieToDecrease.type].icon}${nextValue}.`,
      );
      continue;
    }

    if (effect.type === "increase_target_ally_die") {
      const max = effect.max ?? 3;
      const amount = effect.amount ?? 1;
      const target = findCreatureWithDie(
        players,
        actorAfterPayment,
        preferredTargetId ?? null,
        (die) => die.value < max,
        "ally",
      );
      const dieToIncrease = target
        ? bestDieForValueIncrease(target.attached, max)
        : null;
      if (!target || !dieToIncrease) {
        log.unshift("Нет союзного куба, который можно увеличить.");
        continue;
      }
      const nextValue = Math.min(max, dieToIncrease.value + amount);
      players = updateCreature(players, target.id, (creature) => ({
        ...creature,
        attached: creature.attached.map((die) =>
          die.id === dieToIncrease.id ? { ...die, value: nextValue } : die,
        ),
      }));
      log.unshift(
        `${target.card.name_ru}: ${DIE_META[dieToIncrease.type].icon}${dieToIncrease.value} → ${DIE_META[dieToIncrease.type].icon}${nextValue}.`,
      );
      continue;
    }

    if (effect.type === "return_target_die_to_pool") {
      const valueMax = effect.value_max ?? 3;
      const target = findCreatureWithDie(
        players,
        actorAfterPayment,
        preferredTargetId ?? null,
        (die) => die.value <= valueMax,
        "enemy",
      );
      const dieToReturn = target ? bestDieForReturn(target.attached, valueMax) : null;
      if (!target || !dieToReturn) {
        log.unshift(`Нет вражеского куба значения ${valueMax} или ниже для возврата.`);
        continue;
      }
      players = updateCreature(players, target.id, (creature) => ({
        ...creature,
        attached: creature.attached.filter((die) => die.id !== dieToReturn.id),
      }));
      log.unshift(
        `${target.card.name_ru} сбрасывает ${DIE_META[dieToReturn.type].icon}${dieToReturn.value}.`,
      );
      continue;
    }

    if (effect.type === "move_own_die_to_ally") {
      const currentActor = getCreature(players, actor.id) ?? actorAfterPayment;
      const count = effect.count ?? 1;
      const target =
        livingCreatures(players).find(
          (creature) =>
            creature.id === preferredTargetId &&
            creature.owner === actor.owner &&
            creature.id !== actor.id,
        ) ??
        livingCreatures(players)
          .filter((creature) => creature.owner === actor.owner && creature.id !== actor.id)
          .sort((left, right) => left.attached.length - right.attached.length)[0];
      const diceToMove = [...currentActor.attached]
        .sort((left, right) => {
          if (left.value !== right.value) return left.value - right.value;
          return left.id.localeCompare(right.id);
        })
        .slice(0, count);
      if (!target || diceToMove.length === 0) {
        log.unshift("Нет союзника или своего куба для переноса.");
        continue;
      }
      const movingIds = new Set(diceToMove.map((die) => die.id));
      players = updateCreature(players, currentActor.id, (creature) => ({
        ...creature,
        attached: creature.attached.filter((die) => !movingIds.has(die.id)),
      }));
      players = updateCreature(players, target.id, (creature) => ({
        ...creature,
        attached: [...creature.attached, ...diceToMove],
      }));
      log.unshift(
        `${currentActor.card.name_ru} переносит ${formatDiceList(diceToMove)} на ${target.card.name_ru}.`,
      );
      continue;
    }

    if (effect.type === "damage" || effect.type === "damage_equal_spent_die_value") {
      const target = chooseDefaultTarget(
        players,
        actorAfterPayment,
        effect,
        preferredTargetId ?? null,
      );
      if (!target) {
        log.unshift("Нет легальной цели для урона — эффект пропущен.");
        continue;
      }
      const amount = damageAmount(effect, actorAfterPayment, target, payment);
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
      pool: [],
      log: log.slice(0, 24),
    },
  };
}

function reinforceAndQueue(state: GameState): GameState {
  if (!state.battle) return state;
  let nextState = state;
  const players = clonePlayers(state.players);
  const log = [...state.battle.log];

  for (const playerId of ["A", "B"] as PlayerId[]) {
    const nextCard = players[playerId].deck[players[playerId].nextDeckIndex];
    if (!nextCard) continue;
    const [creature, rolledState] = deployOneCreature(nextState, playerId, nextCard);
    nextState = rolledState;
    players[playerId].creatures.push(creature);
    players[playerId].nextDeckIndex += 1;
    log.unshift(`${PLAYERS[playerId].name} докладывает корабль из руки: ${nextCard.name_ru}.`);
  }

  const queue = sortInitiative(allCreatures(players));
  if (queue.length === 0 || !bothSidesCanContinue(players)) {
    return finishGame({ ...nextState, players, battle: { ...state.battle, pool: [], log } });
  }

  return {
    ...nextState,
    players,
    battle: {
      ...state.battle,
      round: state.battle.round + 1,
      queue,
      activeCreatureId: queue[0] ?? null,
      needsDie: false,
      pool: [],
      selectedTargetId: null,
      log: [`Раунд ${state.battle.round + 1}: очередь инициативы обновлена.`, ...log].slice(0, 24),
    },
  };
}

function bothSidesCanContinue(players: Record<PlayerId, Player>) {
  return (["A", "B"] as PlayerId[]).every(
    (playerId) =>
      players[playerId].creatures.some((creature) => creature.alive) ||
      players[playerId].nextDeckIndex < players[playerId].deck.length,
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

  if (queue.length === 0) return reinforceAndQueue({ ...state, battle: { ...state.battle, queue } });

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
  attached,
  children,
}: {
  card: CardData;
  owner?: PlayerId;
  compact?: boolean;
  hpText: string;
  healthPercent?: number;
  attached?: ReactNode;
  children?: ReactNode;
}) {
  const flavor = dominantDie(card);
  const art = spaceArtForCard(card);
  return (
    <div className={`cardFrame ${compact ? "compact" : ""}`}>
      <div className="frameHero">
        <div className="frameArt">
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
      {attached ? <div className="frameAttached">{attached}</div> : null}
      {!compact ? <div className="frameRules">{children}</div> : null}
    </div>
  );
}

function Card({
  card,
  owner,
  selected,
  compact,
  onClick,
}: {
  card: CardData;
  owner?: PlayerId;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const flavor = dominantDie(card);
  return (
    <button
      className={`card ${flavor} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      onClick={onClick}
      type="button"
    >
      <CardFrame card={card} compact={compact} hpText={`${card.health}`} owner={owner}>
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
  onSelect,
  onAbilityDragStart,
  onAbilityDragEnd,
  onAbilityTap,
  onDropAbility,
}: {
  creature: Creature;
  active: boolean;
  target: boolean;
  canUseAbilities: boolean;
  armed: boolean;
  onSelect: () => void;
  onAbilityDragStart: (ability: Ability) => void;
  onAbilityDragEnd: () => void;
  onAbilityTap: (ability: Ability) => void;
  onDropAbility: () => void;
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
        attached={
          creature.attached.length
            ? creature.attached.map((die) => (
                <span className={`die ${die.type}`} key={die.id}>
                  {DIE_META[die.type].icon}
                  {die.value}
                </span>
              ))
            : "кубов нет"
        }
      >
        {creature.card.abilities.map((ability) => {
          const payment = findPayment(creature.attached, ability.cost);
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
              идею карт и кубов, но убирает общий пул: каждый корабль работает своими кубами.
            </p>
          </article>
          <article>
            <h3>Быстрый старт</h3>
            <ol>
              <li>Нажми “сразу бой”, если хочешь быстро протестировать.</li>
              <li>Для простой партии включи Light mode.</li>
              <li>Для полного теста начни “новая draft”.</li>
            </ol>
          </article>
          <article>
            <h3>Драфт</h3>
            <p>
              Игроки выбирают карты из открытых паков по очереди. После драфта каждый
              выбирает 5 карт в боевую руку: 3 стартуют на поле, 2 остаются резервом.
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
              При выходе корабль сразу бросает свои напечатанные кубы и хранит их на карте.
              Эти кубы тратятся на способности снизу карты. Если куб больше нужного значения,
              он всё равно тратится целиком.
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
          Подсказка: слева на карте показаны личные кубы корабля, справа — инициатива и слава,
          по центру — прочность, снизу — способности и их цена.
        </p>
      </details>
    </section>
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
  const cardsLoaded = fullCards.length > 0;

  useEffect(() => {
    let cancelled = false;
    fetch("/cards.v0.3.json")
      .then((response) => response.json())
      .then((data: { cards: CardData[] }) => {
        if (cancelled) return;
        setFullCards(data.cards);
        setState(makeDraft(cardsForRulesMode(data.cards, initialRulesMode), DEFAULT_SEED_TEXT));
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
    setState(makeDraft(cardsForRulesMode(fullCards, rulesMode), seedText));
    setSeedInput(seedText);
  }

  function startRandomBattle(seedText = seedInput) {
    if (!cardsLoaded) return;
    const cards = cardsForRulesMode(fullCards, rulesMode);
    const [shuffledCards, rng] = shuffleWithSeed(cards, hashSeed(seedText));
    const players = structuredClone(EMPTY_PLAYERS);
    players.A = {
      ...players.A,
      drafted: shuffledCards.slice(0, BATTLE_DECK_SIZE),
      deck: shuffledCards.slice(0, BATTLE_DECK_SIZE),
    };
    players.B = {
      ...players.B,
      drafted: shuffledCards.slice(BATTLE_DECK_SIZE, BATTLE_DECK_SIZE * 2),
      deck: shuffledCards.slice(BATTLE_DECK_SIZE, BATTLE_DECK_SIZE * 2),
    };

    setArmedAbilityId(null);
    setDraggedAbilityId(null);
    setSeedInput(seedText);
    setState(
      startBattle({
        ...initialState(),
        phase: "battle",
        seedText,
        rng,
        allCards: cards,
        players,
      }),
    );
  }

  function switchRulesMode(nextMode: RulesMode) {
    if (!cardsLoaded || nextMode === rulesMode) return;
    const cards = cardsForRulesMode(fullCards, nextMode);
    setRulesMode(nextMode);
    setArmedAbilityId(null);
    setDraggedAbilityId(null);
    setState(makeDraft(cards, seedInput));
  }

  function pickCard(card: CardData) {
    if (!state.draft) return;
    const picker = currentPicker(state.draft);
    const players = clonePlayers(state.players);
    players[picker].drafted.push(card);

    const nextPack = state.draft.pack.filter((packCard) => packCard.id !== card.id);
    const nextPickIndex = state.draft.pickIndex + 1;
    if (nextPickIndex >= 4) {
      const nextPackIndex = state.draft.packIndex + 1;
      if (nextPackIndex >= state.draft.packs.length) {
        setState({
          ...state,
          phase: "deck_select",
          players,
          draft: null,
          selecting: "A",
          selectedForDeck: { A: [], B: [] },
        });
        return;
      }
      setState({
        ...state,
        players,
        draft: {
          ...state.draft,
          packIndex: nextPackIndex,
          pickIndex: 0,
          pack: state.draft.packs[nextPackIndex],
        },
      });
      return;
    }

    setState({
      ...state,
      players,
      draft: {
        ...state.draft,
        pickIndex: nextPickIndex,
        pack: nextPack,
      },
    });
  }

  function toggleDeckCard(playerId: PlayerId, cardId: string) {
    const selected = state.selectedForDeck[playerId];
    const nextSelected = selected.includes(cardId)
      ? selected.filter((id) => id !== cardId)
      : selected.length < BATTLE_DECK_SIZE
        ? [...selected, cardId]
        : selected;
    setState({
      ...state,
      selectedForDeck: {
        ...state.selectedForDeck,
        [playerId]: nextSelected,
      },
    });
  }

  function confirmDeck(playerId: PlayerId) {
    const selectedIds = state.selectedForDeck[playerId];
    if (selectedIds.length !== BATTLE_DECK_SIZE) return;
    const selectedCards = state.players[playerId].drafted.filter((card) =>
      selectedIds.includes(card.id),
    );
    const [deck, rng] = shuffleWithSeed(selectedCards, state.rng);
    const players = clonePlayers(state.players);
    players[playerId] = { ...players[playerId], deck };

    const nextState = {
      ...state,
      rng,
      players,
      selecting: playerId === "A" ? ("B" as PlayerId) : ("A" as PlayerId),
    };

    if (playerId === "B") {
      setState(startBattle(nextState));
    } else {
      setState(nextState);
    }
  }

  function activateAbilityOnCreature(creatureId: string) {
    if (!activeAbility) return;
    setState(resolveAbility(state, activeAbility, creatureId));
    setArmedAbilityId(null);
    setDraggedAbilityId(null);
  }

  function armAbility(ability: Ability) {
    if (!activeCreature || state.battle?.needsDie) return;
    if (!findPayment(activeCreature.attached, ability.cost)) return;
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

  const currentDraftPicker = state.draft ? currentPicker(state.draft) : null;
  const selectedPlayer = state.players[state.selecting];
  const selectedIds = state.selectedForDeck[state.selecting];
  return (
    <main
      className={`shell ${
        state.phase === "battle" || state.phase === "finished" ? "battleShell" : ""
      }`}
      style={{ "--game-scale": gameScale / 100 } as CSSProperties}
    >
      <section className="hero">
        <div>
          <p className="eyebrow">
            Space Combat Draft · v0.1 · 36 карт · {rulesMode === "light" ? "Light" : "Full"}
          </p>
          <h1>Космическая боевая система</h1>
          <p>
            Альтернативный тест для космической 4X: открытый draft 1–2–1, 5 карт в боевой руке,
            3 корабля на старте, 2 подкрепления позже и личные кубы на каждой карте.
          </p>
        </div>
        <div className="seedBox">
          <label htmlFor="seed">Seed партии</label>
          <div>
            <input
              id="seed"
              value={seedInput}
              onChange={(event) => setSeedInput(event.target.value)}
            />
            <button type="button" onClick={() => restart(seedInput)}>
              новая draft
            </button>
            <button
              type="button"
              className="quickBattle"
              disabled={!cardsLoaded}
              onClick={() => startRandomBattle(seedInput)}
            >
              сразу бой
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
          <strong>{state.players.A.drafted.length} draft · ★{score(state.players.A)}</strong>
        </div>
        <div>
          <span>{PLAYERS.B.name}</span>
          <strong>{state.players.B.drafted.length} draft · ★{score(state.players.B)}</strong>
        </div>
      </section>

      {state.phase === "loading" ? (
        <section className="panel">Загружаю карты…</section>
      ) : null}

      {state.phase === "draft" && state.draft ? (
        <section className="panel">
          <div className="phaseHead">
            <div>
              <p className="eyebrow">Draft · pack {state.draft.packIndex + 1}/5</p>
              <h2>Выбирает {PLAYERS[currentDraftPicker ?? "A"].name}</h2>
            </div>
            <span className="pill">порядок {state.draft.packIndex % 2 === 0 ? "A → B → B → A" : "B → A → A → B"}</span>
          </div>
          <div className="cardGrid">
            {state.draft.pack.map((card) => (
              <Card card={card} key={card.id} onClick={() => pickCard(card)} />
            ))}
          </div>
        </section>
      ) : null}

      {state.phase === "deck_select" ? (
        <section className="panel">
          <div className="phaseHead">
            <div>
              <p className="eyebrow">Выбор колоды</p>
              <h2>
                {selectedPlayer.name}: выбери {BATTLE_DECK_SIZE} из 10 · {selectedIds.length}/{BATTLE_DECK_SIZE}
              </h2>
            </div>
            <button
              type="button"
              disabled={selectedIds.length !== BATTLE_DECK_SIZE}
              onClick={() => confirmDeck(state.selecting)}
            >
              подтвердить
            </button>
          </div>
          <div className="cardGrid">
            {selectedPlayer.drafted.map((card) => (
              <Card
                card={card}
                key={card.id}
                selected={selectedIds.includes(card.id)}
                onClick={() => toggleDeckCard(state.selecting, card.id)}
              />
            ))}
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
              <p>Личные кубы кораблей</p>
              <div className="poolGroups">
                <div className="poolGroup attack">
                  <div className="poolGroupHead">
                    <strong>Старт</strong>
                    <span>{OPENING_CARDS_PER_PLAYER}</span>
                  </div>
                  <span className="muted">У каждого игрока сразу 3 корабля.</span>
                </div>
                <div className="poolGroup defense">
                  <div className="poolGroupHead">
                    <strong>Рука</strong>
                    <span>{RESERVE_CARDS_PER_PLAYER}</span>
                  </div>
                  <span className="muted">Еще 2 карты докладываются позже.</span>
                </div>
                <div className="poolGroup magic">
                  <div className="poolGroupHead">
                    <strong>Кубы</strong>
                    <span>личные</span>
                  </div>
                  <span className="muted">Кубы лежат на своих кораблях, без общего пула.</span>
                </div>
              </div>
            </div>

            {activeCreature && state.phase === "battle" ? (
              <div className="actionBox">
                <p>
                  {state.battle.needsDie
                    ? "Активный корабль уже получает кубы при выходе на поле."
                    : activeAbility
                      ? `Выбрана «${activeAbility.name_ru}». Перетащи её на карту или тапни по цели.`
                      : "Готовые способности видны на активном корабле. Перетащи способность на цель или тапни способность, потом цель."}
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
                            active={creature.id === state.battle?.activeCreatureId}
                            target={creature.id === state.battle?.selectedTargetId}
                            onAbilityDragStart={(ability) => {
                              setDraggedAbilityId(ability.id);
                              setArmedAbilityId(ability.id);
                            }}
                            onAbilityDragEnd={() => setDraggedAbilityId(null)}
                            onAbilityTap={armAbility}
                            onDropAbility={() => activateAbilityOnCreature(creature.id)}
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
                            active={creature.id === state.battle?.activeCreatureId}
                            target={creature.id === state.battle?.selectedTargetId}
                            onAbilityDragStart={(ability) => {
                              setDraggedAbilityId(ability.id);
                              setArmedAbilityId(ability.id);
                            }}
                            onAbilityDragEnd={() => setDraggedAbilityId(null)}
                            onAbilityTap={armAbility}
                            onDropAbility={() => activateAbilityOnCreature(creature.id)}
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
                  Подкрепления A:{" "}
                  {Math.max(0, state.players.A.deck.length - state.players.A.nextDeckIndex)}
                </span>
                <span>
                  Подкрепления B:{" "}
                  {Math.max(0, state.players.B.deck.length - state.players.B.nextDeckIndex)}
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
    </main>
  );
}
