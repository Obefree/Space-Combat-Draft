// Initiative Fleet Playtest — tactical rules for the existing Space Combat Draft.
// This module has no DOM or framework dependencies, so it can be simulated directly.
export const DIE_SYMBOL = { attack: "⚔", defense: "🛡", tech: "✦" };
export const CARD_TYPES = [
  { id: "assault", name: "Боевой натиск", dice: ["attack", "attack"], hint: "Два атакующих куба", why: "Чистое давление, когда цель открыта и щиты уже сняты." },
  { id: "guard", name: "Глухая оборона", dice: ["defense", "defense"], hint: "Два защитных куба", why: "Щит и реакция: спасает хрупкий ★-корабль без траты активации." },
  { id: "tracking", name: "Наведение", dice: ["attack", "tech"], hint: "Атака и технология", why: "Выстрел сейчас или калибровка куба под особую способность." },
  { id: "maneuver", name: "Тактический манёвр", dice: ["defense", "tech"], hint: "Защита и технология", why: "Темп: щит сегодня или подготовка чужого залпа завтра." },
  { id: "combined", name: "Общий резерв", dice: ["attack", "defense"], hint: "Универсальный запас", why: "Гибкость. У Лиги одна копия — ⚔✦, у Гегемонии обе остаются ⚔🛡." },
];
export const UNIT_TYPES = {
  scout: { name: "Разведчик", initiative: 8, glory: 6, hp: 4, art: "/card-art/space/generated/swift_blade.png", ability: "Сенсорный импульс", cost: "✦2+ → повысить другой куб на 2 (макс. 3)", module: "Начало боя: +1 ✦", why: "Хрупкий, но ★6." },
  destroyer: { name: "Эсминец", initiative: 5, glory: 4, hp: 6, art: "/card-art/space/generated/huntress.png", ability: "Торпедная связка", cost: "⚔ + ✦, сумма 4+ → 4 урона", module: "Модуль: торпедные аппараты", why: "Средний ★4." },
  cruiser: { name: "Крейсер", initiative: 3, glory: 1, hp: 8, art: "/card-art/space/generated/mercenary_captain.png", ability: "Бортовой залп", cost: "⚔ + ⚔, сумма 4+ → 5 урона", module: "Модуль: батарея тяжёлого огня", why: "Танк ★1." },
  interceptor: { name: "Перехватчик", initiative: 7, glory: 5, hp: 4, art: "/card-art/space/generated/raider.png", ability: "Ракетный заход", cost: "⚔2+ → урон равен значению куба", module: "Начало боя: +1 ⚔", why: "Быстрый ★5." },
  frigate: { name: "Фрегат", initiative: 4, glory: 4, hp: 6, art: "/card-art/space/generated/bodyguard.png", ability: "Плотный заслон", cost: "🛡2+ → значение куба +1 щита флоту", module: "Модуль: усиленный щит", why: "Щит ★4." },
  dreadnought: { name: "Дредноут", initiative: 2, glory: 2, hp: 8, art: "/card-art/space/generated/old_veteran.png", ability: "Осадный разряд", cost: "⚔ + ⚔ + ✦, сумма 6+ → 6 урона", module: "Модуль: осадный реактор", why: "Кувалда ★2." },
};
export const DEMO_FLOW = [
  { n: 1, title: "Флоты уже выбраны", what: "Лига: разведчик, эсминец, крейсер. Гегемония: перехватчик, фрегат, дредноут. Составы заданы сценарием, не драфтом.", why: "Это тактический слой 4X: в бой входят уже выбранные корабли." },
  { n: 2, title: "Выбери 3 карты из 5", what: "Колода — 10 карт (5 пар), в руке 5. На старте вводишь 3; ещё по одной в раундах 2 и 3.", why: "Выбор сразу задаёт и кубы, и будущие приказы." },
  { n: 3, title: "Карта становится приказом", what: "Каждая введённая карта даёт 2 куба и встаёт в ряд инициативы как одна команда кораблю.", why: "Карта — не одноразовая вспышка, а слот хода на весь бой." },
  { n: 4, title: "Ход по инициативе", what: "Корабль с большей инициативой ходит раньше. Не больше двух активаций на корабль в раунд, особая способность — один раз.", why: "Быстрые хрупкие корабли бьют первыми, но их ★ дороже терять." },
  { n: 5, title: "Трать кубы или пропусти", what: "В активацию можно атаковать, поднять щит, калибровать, использовать способность корабля или пропустить ход.", why: "Пропуск сохраняет кубы; потраченные исчезают из общего пула флота." },
  { n: 6, title: "Щит глотает удар", what: "Щиты поглощают урон. 🛡 можно потратить как реакцию без активации. Неистраченные щиты сгорают в конце раунда.", why: "Реакция спасает ★-корабль, не тратя его ход." },
  { n: 7, title: "Победа по ★ живых", what: "Три раунда или уничтожение флота. Побеждает сумма ★ выживших кораблей; оставшийся HP не счёт.", why: "Хрупкий разведчик ★6 ценнее танка-крейсера ★1." },
];
const ORDER = { A: ["scout", "destroyer", "cruiser"], B: ["interceptor", "frigate", "dreadnought"] };
// Each existing ship contributes one starting die; scout/interceptor modules contribute a bonus die.
const SHIP_START_DICE = { scout: "tech", destroyer: "attack", cruiser: "attack", interceptor: "attack", frigate: "defense", dreadnought: "attack" };
const MODULE_BONUS_DICE = { scout: "tech", interceptor: "attack" };
const MAX_ROUND = 3;

function hash(text) {
  let v = 2166136261;
  for (const c of text) { v ^= c.charCodeAt(0); v = Math.imul(v, 16777619); }
  return v >>> 0 || 1;
}
function roll(g) {
  g.rng = (g.rng + 0x6d2b79f5) >>> 0;
  let t = g.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function addDie(g, side, type) {
  g.nextDie++;
  g.fleets[side].dice.push({ id: "d" + g.nextDie, type, value: 1 + Math.floor(roll(g) * 3) });
}
function msg(g, text) { g.log.unshift(text); g.log = g.log.slice(0, 45); }
function clone(g) { return structuredClone(g); }
export function other(side) { return side === "A" ? "B" : "A"; }
export function fleetHp(f) { return f.units.reduce((sum, u) => sum + u.hp, 0); }
export function victoryPoints(f) { return f.units.reduce((sum, u) => sum + (u.hp > 0 ? u.glory : 0), 0); }
export function fleetLosses(f) { return f.units.filter(u => u.hp <= 0).length; }
export function turnOf(g) { return g.phase === "activate" ? g.queue[g.index] || null : null; }
export function aliveUnits(f) { return f.units.filter(u => u.hp > 0); }
export function createGame(seed = "battle-01", mode = "solo") {
  const g = { rng: hash(seed), seed, mode, round: 1, phase: "draft", drafting: "A", placing: "A", queue: [], index: 0, pending: null, winner: null, result: null, specialUsed: { A: [], B: [] }, nextDie: 0, log: [], fleets: {} };
  for (const side of ["A", "B"]) {
    const cards = CARD_TYPES.flatMap(t => [0, 1].map(copyNumber => ({ id: side + "-" + t.id + "-" + copyNumber, type: t.id, name: t.name, dice: [...t.dice], hint: t.hint, why: t.why })));
    // Initial faction asymmetry is deliberately small:
    // one League "combined" copy becomes ⚔✦ (mobility),
    // Hegemony retains ⚔🛡 (security). Both still receive exactly two dice.
    const swap = cards.find(c => c.type === "combined" && c.id.endsWith("-1"));
    if (side === "A") {
      swap.dice = ["attack", "tech"];
      swap.hint = "Огонь и технологическая гибкость";
      swap.why = "Лига: одна копия резерва даёт выстрел и калибровку вместо щита.";
    } else {
      swap.dice = ["attack", "defense"];
      swap.hint = "Атака и щит";
      swap.why = "Гегемония держит обе копии универсальными: удар или реакция.";
    }
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(roll(g) * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    g.fleets[side] = {
      name: side === "A" ? "Лига Ориона" : "Гегемония",
      hand: cards.slice(0, 5),
      activeCards: [],
      dice: [],
      shield: 0,
      units: ORDER[side].map((role, i) => ({
        id: side + "-" + role, role, hp: UNIT_TYPES[role].hp, maxHp: UNIT_TYPES[role].hp,
        initiative: UNIT_TYPES[role].initiative, glory: UNIT_TYPES[role].glory, art: UNIT_TYPES[role].art,
      })),
    };
  }
  msg(g, "Начало боя. Флоты уже определены стратегической частью. Выберите три стартовые карты каждого флота.");
  return g;
}
export function chooseCards(state, ids) {
  const g = clone(state);
  if (g.phase !== "draft") return state;
  const required = g.round === 1 ? 3 : 1;
  const side = g.drafting, f = g.fleets[side];
  if (!Array.isArray(ids) || ids.length !== required || new Set(ids).size !== required) return state;
  if (!ids.every(id => f.hand.some(c => c.id === id))) return state;
  const cards = ids.map(id => f.hand.find(c => c.id === id));
  f.hand = f.hand.filter(c => !ids.includes(c.id));
  f.activeCards.push(...cards);
  for (const c of cards) for (const type of c.dice) addDie(g, side, type);
  if (g.round === 1) {
    for (const ship of aliveUnits(f)) {
      addDie(g, side, SHIP_START_DICE[ship.role]);
      if (MODULE_BONUS_DICE[ship.role]) addDie(g, side, MODULE_BONUS_DICE[ship.role]);
    }
  }
  msg(g, f.name + ": " + cards.map(c => "«" + c.name + "»").join(", ") + "; получено кубов: " + (cards.length * 2 + (g.round === 1 ? aliveUnits(f).length + aliveUnits(f).filter(u => MODULE_BONUS_DICE[u.role]).length : 0)) + ".");
  if (side === "A") g.drafting = "B";
  else { g.phase = "place"; g.placing = "A"; }
  return g;
}
// Cards are command tokens on the initiative track. A token grants one action,
// not a fresh dice roll. A ship can take at most two tokens per round.
export function suggestedAssignments(g, side) {
  const cards = g.fleets[side].activeCards;
  const units = aliveUnits(g.fleets[side]);
  const assignments = {};
  const counts = Object.fromEntries(units.map(u => [u.id, 0]));
  // Previous card placements stay in the row; new cards are added to available ships.
  for (const card of cards) {
    const unit = units.find(u => u.id === card.assignedShipId);
    if (unit && counts[unit.id] < 2) { assignments[card.id] = unit.id; counts[unit.id]++; }
  }
  for (const card of cards) {
    if (assignments[card.id]) continue;
    const preferences = units.map(u => {
      const attack = card.dice.filter(d => d === "attack").length;
      const defense = card.dice.filter(d => d === "defense").length;
      const tech = card.dice.filter(d => d === "tech").length;
      const synergy = u.role === "scout" ? tech * 2 : u.role === "frigate" ? defense * 2
        : u.role === "destroyer" ? attack * 2 : u.role === "cruiser" || u.role === "dreadnought" ? attack * 2 + tech : attack * 2;
      return { u, score: synergy - 4 * counts[u.id] + (card.assignedShipId === u.id ? 0.75 : 0) };
    }).filter(p => counts[p.u.id] < 2).sort((a,b) => b.score - a.score || b.u.initiative - a.u.initiative);
    const chosen = preferences[0]?.u;
    assignments[card.id] = chosen ? chosen.id : "reserve";
    if (chosen) counts[chosen.id]++;
  }
  return assignments;
}
export function placeCards(state, assignments) {
  if (state.phase !== "place") return state;
  const g = clone(state);
  const side = g.placing, fleet = g.fleets[side];
  if (!assignments || typeof assignments !== "object") return state;
  const counts = {};
  for (const card of fleet.activeCards) {
    const target = assignments[card.id];
    if (target !== "reserve" && !fleet.units.some(u => u.id === target && u.hp > 0)) return state;
    if (target !== "reserve") {
      counts[target] = (counts[target] || 0) + 1;
      if (counts[target] > 2) return state;
    }
    card.assignedShipId = target;
  }
  msg(g, fleet.name + ": приказы выставлены на шкалу инициативы (" + fleet.activeCards.filter(c => c.assignedShipId !== "reserve").length + " активации).");
  if (side === "A") g.placing = "B";
  else beginActivation(g);
  return g;
}
function beginActivation(g) {
  g.phase = "activate";
  g.queue = [];
  g.specialUsed = { A: [], B: [] };
  for (const side of ["A", "B"]) {
    const counts = {};
    for (const card of g.fleets[side].activeCards) {
      const unit = g.fleets[side].units.find(u => u.id === card.assignedShipId && u.hp > 0);
      if (!unit) continue;
      counts[unit.id] = (counts[unit.id] || 0) + 1;
      g.queue.push({side, id:unit.id, role:unit.role, initiative:unit.initiative,
        wave:counts[unit.id], cardId:card.id, cardName:card.name});
    }
  }
  g.queue.sort((a,b) => a.wave - b.wave || b.initiative - a.initiative || a.side.localeCompare(b.side));
  g.index = 0;
  msg(g, "Раунд " + g.round + ": " + g.queue.length + " приказов в очереди инициативы. Один приказ = одна активация; можно пропустить, не расходуя кубы.");
  advance(g);
}
function applyDamage(g, hit) {
  const defender = g.fleets[hit.defender];
  const unit = defender.units.find(u => u.id === hit.target && u.hp > 0);
  if (!unit) return;
  const actual = Math.min(unit.hp, hit.damage);
  unit.hp -= actual;
  msg(g, defender.name + ": " + UNIT_TYPES[unit.role].name + " получает " + actual + " урона" + (unit.hp ? "" : " и уничтожен") + ".");
}
function victory(g) {
  const aAlive = aliveUnits(g.fleets.A).length;
  const bAlive = aliveUnits(g.fleets.B).length;
  const roundEnded = g.round === MAX_ROUND && g.index >= g.queue.length;
  if (aAlive > 0 && bAlive > 0 && !roundEnded) return false;

  // HP is never a victory tiebreaker. Only the glory of SURVIVING ships counts.
  const a = victoryPoints(g.fleets.A), b = victoryPoints(g.fleets.B);
  const mutual = aAlive === 0 && bAlive === 0;
  const wiped = aAlive === 0 || bAlive === 0;
  const kind = mutual ? "mutual-annihilation" : wiped ? "annihilation" : a === b ? "draw" : "points";
  g.winner = a === b ? "draw" : a > b ? "A" : "B";
  g.result = { kind, scoreA:a, scoreB:b, lostA:fleetLosses(g.fleets.A),
    lostB:fleetLosses(g.fleets.B), initialA:g.fleets.A.units.length,
    initialB:g.fleets.B.units.length, round:g.round };
  g.phase = "done";
  g.pending = null;
  const label = kind === "mutual-annihilation" ? "взаимное уничтожение" :
    kind === "annihilation" ? "полное уничтожение флота" :
    kind === "draw" ? "ничья по победным очкам" : "победа по очкам выживших кораблей";
  msg(g, "Бой окончен: " + label + ". Очки " + a + ":" + b +
    ", потери " + g.result.lostA + ":" + g.result.lostB + ".");
  return true;
}
function advance(g) {
  if (victory(g)) return;
  while (g.index < g.queue.length) {
    const q = g.queue[g.index];
    if (g.fleets[q.side].units.some(u => u.id === q.id && u.hp > 0)) {
      g.phase = "activate";
      return;
    }
    g.index++;
  }
  if (g.round >= MAX_ROUND) { victory(g); return; }
  g.fleets.A.shield = 0;
  g.fleets.B.shield = 0;
  msg(g, "Конец раунда: неистраченные временные щиты рассеиваются, кубы остаются.");
  g.round++;
  g.phase = "draft";
  g.drafting = "A";
  g.queue = [];
  g.index = 0;
  msg(g, "Раунд " + g.round + ": выберите по одной новой карте. Старые кубы сохраняются.");
}
function nextTurn(g) { g.index++; advance(g); }
function launch(g, attacker, targetId, amount) {
  const defenderSide = other(attacker);
  const defender = g.fleets[defenderSide];
  if (!defender.units.some(u => u.id === targetId && u.hp > 0)) return false;
  const blocked = Math.min(defender.shield, amount);
  defender.shield -= blocked;
  let hit = { attacker, defender: defenderSide, target: targetId, damage: amount - blocked, original: amount };
  msg(g, g.fleets[attacker].name + " атакует на " + amount + " урона" + (blocked ? "; щит поглотил " + blocked : "") + ".");
  if (hit.damage > 0 && defender.dice.some(d => d.type === "defense")) {
    g.pending = hit;
    g.phase = "react";
  } else {
    applyDamage(g, hit);
    nextTurn(g);
  }
  return true;
}
export function resolveReaction(state, dieId = null) {
  if (state.phase !== "react" || !state.pending) return state;
  const g = clone(state);
  const p = g.pending, f = g.fleets[p.defender];
  if (dieId) {
    const die = f.dice.find(d => d.id === dieId && d.type === "defense");
    if (!die) return state;
    p.damage = Math.max(0, p.damage - die.value);
    f.dice = f.dice.filter(d => d.id !== dieId);
    msg(g, f.name + " тратит 🛡" + die.value + " на защитную реакцию.");
  } else {
    msg(g, f.name + " принимает удар без защитной реакции.");
  }
  applyDamage(g, p);
  g.pending = null;
  nextTurn(g);
  return g;
}
function selectedDice(f, ids) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) return null;
  const dice = ids.map(id => f.dice.find(d => d.id === id));
  return dice.every(Boolean) ? dice : null;
}
function typesAre(dice, types) {
  if (dice.length !== types.length) return false;
  return [...dice.map(d => d.type)].sort().join("|") === [...types].sort().join("|");
}
export function tryAction(state, action) {
  if (state.phase !== "activate" || !turnOf(state)) return state;
  const g = clone(state), turn = turnOf(g);
  const f = g.fleets[turn.side], unit = f.units.find(u => u.id === turn.id);
  if (!unit || unit.hp <= 0) { nextTurn(g); return g; }
  if (action.kind === "special" && g.specialUsed[turn.side].includes(unit.id)) return state;
  if (action.kind === "pass") {
    msg(g, "«" + turn.cardName + "»: " + UNIT_TYPES[unit.role].name + " (" + turn.side + ") пропускает активацию, сохраняя кубы.");
    nextTurn(g); return g;
  }
  const dice = selectedDice(f, action.diceIds || []);
  if (!dice) return state;
  const sum = dice.reduce((n, d) => n + d.value, 0);
  let hit = 0, barrier = 0, boost = 0;
  if (action.kind === "fire" && typesAre(dice, ["attack"])) hit = dice[0].value === 3 ? 2 : 1;
  else if (action.kind === "brace" && typesAre(dice, ["defense"])) barrier = dice[0].value;
  else if (action.kind === "tune" && typesAre(dice, ["tech"])) boost = 1;
  else if (action.kind === "special") {
    if (unit.role === "scout" && typesAre(dice, ["tech"]) && dice[0].value >= 2) boost = 2;
    else if (unit.role === "interceptor" && typesAre(dice, ["attack"]) && dice[0].value >= 2) hit = dice[0].value;
    else if (unit.role === "destroyer" && typesAre(dice, ["attack", "tech"]) && sum >= 4) hit = 4;
    else if (unit.role === "frigate" && typesAre(dice, ["defense"]) && dice[0].value >= 2) barrier = dice[0].value + 1;
    else if (unit.role === "cruiser" && typesAre(dice, ["attack", "attack"]) && sum >= 4) hit = 5;
    else if (unit.role === "dreadnought" && typesAre(dice, ["attack", "attack", "tech"]) && sum >= 6) hit = 6;
    else return state;
  } else return state;

  if (hit && !g.fleets[other(turn.side)].units.some(u => u.id === action.targetId && u.hp > 0)) return state;
  if (boost && !f.dice.some(d => !action.diceIds.includes(d.id) && d.value < 3)) return state;

  const payment = new Set(action.diceIds);
  f.dice = f.dice.filter(d => !payment.has(d.id));
  if (action.kind === "special") g.specialUsed[turn.side].push(unit.id);
  msg(g, "«" + turn.cardName + "» → " + UNIT_TYPES[unit.role].name + " использует «" + (action.kind === "special" ? UNIT_TYPES[unit.role].ability : action.kind === "fire" ? "Стрельба" : action.kind === "brace" ? "Щит" : "Калибровка") + "»: " + dice.map(d => DIE_SYMBOL[d.type] + d.value).join(" + ") + ".");
  if (barrier) {
    const before = f.shield;
    f.shield = Math.min(7, f.shield + barrier);
    msg(g, "Защитное поле " + f.name + ": +" + (f.shield - before) + " (всего " + f.shield + ").");
  }
  if (boost) {
    const candidates = f.dice.filter(d => d.value < 3);
    candidates.sort((a, b) => a.value - b.value || (a.type === "attack" ? -1 : 1));
    const chosen = candidates[0];
    chosen.value = Math.min(3, chosen.value + boost);
    msg(g, "Усилен резерв: " + DIE_SYMBOL[chosen.type] + chosen.value + ".");
  }
  if (hit) launch(g, turn.side, action.targetId, hit);
  else nextTurn(g);
  return g;
}
export const SPECIAL_PATTERNS = {
  scout: [["tech"], 2],
  destroyer: [["attack", "tech"], 4],
  cruiser: [["attack", "attack"], 4],
  interceptor: [["attack"], 2],
  frigate: [["defense"], 2],
  dreadnought: [["attack", "attack", "tech"], 6],
};

export function findDiceCandidates(dice, types, minSum = 0) {
  const sorted = [...dice].sort((a, b) => a.value - b.value);
  if (types.length === 1) return sorted.filter(d => d.type === types[0] && d.value >= minSum).map(d => [d]);
  const out = [];
  for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) {
    if (types.length === 2) {
      const pair = [sorted[i], sorted[j]];
      if (typesAre(pair, types) && pair[0].value + pair[1].value >= minSum) out.push(pair);
    } else for (let k = j + 1; k < sorted.length; k++) {
      const triple = [sorted[i], sorted[j], sorted[k]];
      if (typesAre(triple, types) && triple.reduce((s, d) => s + d.value, 0) >= minSum) out.push(triple);
    }
  }
  out.sort((a, b) => a.reduce((s, d) => s + d.value, 0) - b.reduce((s, d) => s + d.value, 0));
  return out;
}

function draftScore(card) {
  return card.dice.reduce((sum, kind) => sum + (kind === "attack" ? 3 : kind === "tech" ? 2 : 1.5), 0);
}

export function aiDraftChoice(g, side = g.drafting) {
  const cards = g.fleets[side].hand;
  const n = g.round === 1 ? 3 : 1;
  return [...cards].sort((a, b) => draftScore(b) - draftScore(a) || a.id.localeCompare(b.id)).slice(0, n).map(c => c.id);
}

export function aiReactionChoice(g) {
  if (g.phase !== "react" || !g.pending) return null;
  const hit = g.pending;
  const fleet = g.fleets[hit.defender];
  const target = fleet.units.find(u => u.id === hit.target);
  const candidate = fleet.dice.filter(d => d.type === "defense")
    .sort((a, b) => Math.abs(a.value - hit.damage) - Math.abs(b.value - hit.damage) || a.id.localeCompare(b.id))[0];
  return candidate && (hit.damage >= 2 || target?.hp <= hit.damage) ? candidate.id : null;
}

export function aiActionChoice(g, policy = "finish") {
  const turn = turnOf(g);
  if (!turn) return { kind: "pass", diceIds: [] };
  const fleet = g.fleets[turn.side];
  const enemy = aliveUnits(g.fleets[other(turn.side)]);
  if (!enemy.length) return { kind: "pass", diceIds: [] };
  const score = (unit) => {
    if (policy === "value") return unit.glory / unit.hp;
    if (policy === "threat") return (unit.role === "dreadnought" || unit.role === "cruiser" ? 10 : 4) - unit.hp / 5;
    if (policy === "heavy") return unit.maxHp;
    return -unit.hp;
  };
  const target = [...enemy].sort((a, b) => score(b) - score(a) || a.hp - b.hp || b.initiative - a.initiative)[0];
  const pattern = SPECIAL_PATTERNS[turn.role];
  const special = pattern && !g.specialUsed[turn.side].includes(turn.id)
    ? findDiceCandidates(fleet.dice, pattern[0], pattern[1])[0] : null;
  if (special &&
      (turn.role !== "scout" || fleet.dice.some(d => !special.some(s => s.id === d.id) && d.value < 3)) &&
      (turn.role !== "frigate" || fleet.shield < 3)) {
    return { kind: "special", diceIds: special.map(d => d.id), targetId: target.id };
  }
  const shot = findDiceCandidates(fleet.dice, ["attack"], 0)[0];
  if (shot) return { kind: "fire", diceIds: shot.map(d => d.id), targetId: target.id };
  const shield = findDiceCandidates(fleet.dice, ["defense"], 0)[0];
  if (shield && fleet.shield < 5) return { kind: "brace", diceIds: shield.map(d => d.id) };
  const tech = findDiceCandidates(fleet.dice, ["tech"], 0)[0];
  if (tech && fleet.dice.some(d => d.id !== tech[0].id && d.value < 3)) return { kind: "tune", diceIds: tech.map(d => d.id) };
  return { kind: "pass", diceIds: [] };
}
