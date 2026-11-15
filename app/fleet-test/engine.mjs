// Initiative Fleet Playtest — tactical rules for the existing Space Combat Draft.
// This module has no DOM or framework dependencies, so it can be simulated directly.
export const DIE_SYMBOL = { attack: "⚔", defense: "🛡", tech: "✦" };
export const CARD_TYPES = [
  { id: "assault", name: "Боевой натиск", dice: ["attack", "attack"], hint: "Два атакующих куба" },
  { id: "guard", name: "Глухая оборона", dice: ["defense", "defense"], hint: "Два защитных куба" },
  { id: "tracking", name: "Наведение", dice: ["attack", "tech"], hint: "Атака и технология" },
  { id: "maneuver", name: "Тактический манёвр", dice: ["defense", "tech"], hint: "Защита и технология" },
  { id: "combined", name: "Общий резерв", dice: ["attack", "defense"], hint: "Универсальный запас" },
];
export const UNIT_TYPES = {
  scout: { name: "Разведчик", initiative: 8, hp: 4, art: "/card-art/space/generated/swift_blade.png", ability: "Сенсорный импульс", cost: "✦2+ → повысить другой куб на 2 (макс. 3)", module: "Начало боя: +1 ✦" },
  destroyer: { name: "Эсминец", initiative: 5, hp: 6, art: "/card-art/space/generated/huntress.png", ability: "Торпедная связка", cost: "⚔ + ✦, сумма 4+ → 3 урона", module: "Модуль: торпедные аппараты" },
  cruiser: { name: "Крейсер", initiative: 3, hp: 8, art: "/card-art/space/generated/mercenary_captain.png", ability: "Бортовой залп", cost: "⚔ + ⚔, сумма 4+ → 4 урона", module: "Модуль: батарея тяжёлого огня" },
  interceptor: { name: "Перехватчик", initiative: 7, hp: 4, art: "/card-art/space/generated/raider.png", ability: "Ракетный заход", cost: "⚔2+ → значение куба +1 урона", module: "Начало боя: +1 ⚔" },
  frigate: { name: "Фрегат", initiative: 4, hp: 6, art: "/card-art/space/generated/bodyguard.png", ability: "Плотный заслон", cost: "🛡2+ → значение куба +2 щита флоту", module: "Модуль: усиленный щит" },
  dreadnought: { name: "Дредноут", initiative: 2, hp: 8, art: "/card-art/space/generated/old_veteran.png", ability: "Осадный разряд", cost: "⚔ + ⚔ + ✦, сумма 6+ → 6 урона", module: "Модуль: осадный реактор" },
};
const ORDER = { A: ["scout", "destroyer", "cruiser"], B: ["interceptor", "frigate", "dreadnought"] };
const START_DICE = { A: "tech", B: "attack" };
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
export function turnOf(g) { return g.phase === "activate" ? g.queue[g.index] || null : null; }
export function aliveUnits(f) { return f.units.filter(u => u.hp > 0); }
export function createGame(seed = "battle-01", mode = "solo") {
  const g = { rng: hash(seed), seed, mode, round: 1, phase: "draft", drafting: "A", queue: [], index: 0, pending: null, winner: null, nextDie: 0, log: [], fleets: {} };
  for (const side of ["A", "B"]) {
    const cards = CARD_TYPES.flatMap(t => [0, 1].map(copyNumber => ({ id: side + "-" + t.id + "-" + copyNumber, type: t.id, name: t.name, dice: [...t.dice], hint: t.hint })));
    // Faction B emphasizes heavy assault; A has an extra technological option.
    const swap = cards.find(c => c.type === "combined" && c.id.endsWith("-1"));
    if (side === "A") swap.dice = ["tech", "defense"];
    else swap.dice = ["attack", "attack"];
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
        initiative: UNIT_TYPES[role].initiative, art: UNIT_TYPES[role].art,
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
  if (g.round === 1) addDie(g, side, START_DICE[side]);
  msg(g, f.name + ": " + cards.map(c => "«" + c.name + "»").join(", ") + "; получено кубов: " + (cards.length * 2 + (g.round === 1 ? 1 : 0)) + ".");
  if (side === "A") g.drafting = "B";
  else beginActivation(g);
  return g;
}
function beginActivation(g) {
  g.phase = "activate";
  g.queue = [];
  const used = { A: {}, B: {} };
  const remaining = { A: g.fleets.A.activeCards.length, B: g.fleets.B.activeCards.length };
  for (let wave = 1; wave <= 2; wave++) {
    const possible = ["A", "B"].flatMap(side => aliveUnits(g.fleets[side]).map(u => ({ side, id: u.id, role: u.role, initiative: u.initiative, wave })));
    possible.sort((a, b) => b.initiative - a.initiative || a.side.localeCompare(b.side));
    for (const entry of possible) {
      if (remaining[entry.side] <= 0) continue;
      const count = used[entry.side][entry.id] || 0;
      if (count !== wave - 1) continue;
      g.queue.push(entry);
      used[entry.side][entry.id] = count + 1;
      remaining[entry.side]--;
    }
  }
  g.index = 0;
  msg(g, "Раунд " + g.round + ": инициатива определила очередь. Кубы из общего резерва тратятся без возврата.");
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
  const a = fleetHp(g.fleets.A), b = fleetHp(g.fleets.B);
  if (a === 0 || b === 0 || (g.round === MAX_ROUND && g.index >= g.queue.length)) {
    g.phase = "done"; g.pending = null;
    g.winner = a === b ? "draw" : a > b ? "A" : "B";
    msg(g, "Бой закончен: " + (g.winner === "draw" ? "ничья" : "побеждает " + g.fleets[g.winner].name) + ".");
    return true;
  }
  return false;
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
  if (action.kind === "pass") {
    msg(g, UNIT_TYPES[unit.role].name + " (" + turn.side + ") пропускает активацию.");
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
    else if (unit.role === "interceptor" && typesAre(dice, ["attack"]) && dice[0].value >= 2) hit = dice[0].value + 1;
    else if (unit.role === "destroyer" && typesAre(dice, ["attack", "tech"]) && sum >= 4) hit = 3;
    else if (unit.role === "frigate" && typesAre(dice, ["defense"]) && dice[0].value >= 2) barrier = dice[0].value + 2;
    else if (unit.role === "cruiser" && typesAre(dice, ["attack", "attack"]) && sum >= 4) hit = 4;
    else if (unit.role === "dreadnought" && typesAre(dice, ["attack", "attack", "tech"]) && sum >= 6) hit = 6;
    else return state;
  } else return state;

  if (hit && !g.fleets[other(turn.side)].units.some(u => u.id === action.targetId && u.hp > 0)) return state;
  if (boost && !f.dice.some(d => !action.diceIds.includes(d.id) && d.value < 3)) return state;

  const payment = new Set(action.diceIds);
  f.dice = f.dice.filter(d => !payment.has(d.id));
  msg(g, UNIT_TYPES[unit.role].name + " использует «" + (action.kind === "special" ? UNIT_TYPES[unit.role].ability : action.kind === "fire" ? "Стрельба" : action.kind === "brace" ? "Щит" : "Калибровка") + "»: " + dice.map(d => DIE_SYMBOL[d.type] + d.value).join(" + ") + ".");
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
function candidates(dice, types, minSum = 0) {
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
export function aiDraftChoice(g) {
  const cards = g.fleets.B.hand;
  const n = g.round === 1 ? 3 : 1;
  const score = c => c.dice.reduce((s, v) => s + (v === "attack" ? 3 : v === "defense" ? 1.5 : 2), 0);
  return [...cards].sort((a, b) => score(b) - score(a)).slice(0, n).map(c => c.id);
}
export function aiReactionChoice(g) {
  if (g.phase !== "react") return null;
  const options = g.fleets.B.dice.filter(d => d.type === "defense");
  const want = g.pending?.damage || 0;
  const efficient = [...options].sort((a, b) => Math.abs(a.value - want) - Math.abs(b.value - want))[0];
  return (want > 1 && efficient) ? efficient.id : null;
}
export function aiActionChoice(g) {
  const turn = turnOf(g);
  if (!turn || turn.side !== "B") return null;
  const f = g.fleets.B, role = turn.role, d = f.dice;
  const enemy = aliveUnits(g.fleets.A);
  if (!enemy.length) return { kind: "pass", diceIds: [] };
  const target = [...enemy].sort((a, b) => a.hp - b.hp || b.initiative - a.initiative)[0];
  const patterns = {
    interceptor: [["attack"], 2],
    frigate: [["defense"], 2],
    dreadnought: [["attack", "attack", "tech"], 6],
  };
  const priority = patterns[role];
  const special = priority ? candidates(d, priority[0], priority[1])[0] : null;
  if (special && (role !== "frigate" || f.shield < 3)) return { kind: "special", diceIds: special.map(x => x.id), targetId: target.id };
  const shot = candidates(d, ["attack"], 0)[0];
  if (shot) return { kind: "fire", diceIds: shot.map(x => x.id), targetId: target.id };
  const shield = candidates(d, ["defense"], 0)[0];
  if (shield && f.shield < 5) return { kind: "brace", diceIds: shield.map(x => x.id) };
  const tech = candidates(d, ["tech"], 0)[0];
  if (tech && d.some(x => x.id !== tech[0].id && x.value < 3)) return { kind: "tune", diceIds: tech.map(x => x.id) };
  return { kind: "pass", diceIds: [] };
}
