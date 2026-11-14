"use client";
import { useMemo, useState } from "react";

type Side = "A" | "B";
type DieKind = "attack" | "defense" | "tech";
type Family = "fire" | "guard" | "maneuver" | "prepare" | "coordinate";
type Faction = "steel" | "ether";
type Die = { id: string; kind: DieKind; value: number; shipId: string | null };
type Ship = { id: string; name: string; role: string; hp: number; maxHp: number };
type Card = { id: string; family: Family; name: string; dice: DieKind[]; level: number };
type Fleet = {
  faction: Faction;
  ships: Ship[];
  hand: Card[];
  dice: Die[];
  shields: number;
  dealt: number;
  played: string[];
};
type Phase = "choose-card" | "orders" | "finished";
type Game = {
  round: number;
  active: Side;
  phase: Phase;
  acted: Record<Side, boolean>;
  fleets: Record<Side, Fleet>;
  current: Card | null;
  actions: number;
  commandUsed: boolean;
  rng: number;
  dieNumber: number;
  log: string[];
};

const kinds: Record<DieKind, string> = { attack: "⚔", defense: "🛡", tech: "✦" };
const families: Record<Family, { name: string; kinds: DieKind[] }> = {
  fire: { name: "Огонь", kinds: ["attack", "attack", "tech"] },
  guard: { name: "Оборона", kinds: ["defense", "defense", "tech"] },
  maneuver: { name: "Манёвр", kinds: ["tech", "defense", "attack"] },
  prepare: { name: "Подготовка", kinds: ["tech", "tech", "defense"] },
  coordinate: { name: "Координация", kinds: ["attack", "defense", "tech"] },
};
const unitSpecs = [
  { name: "Линкор", role: "battleship", hp: 7 },
  { name: "Эскорт", role: "escort", hp: 5 },
  { name: "Разведчик", role: "scout", hp: 4 },
  { name: "Эсминец", role: "destroyer", hp: 5 },
  { name: "Крейсер", role: "cruiser", hp: 6 },
];
const textStyle: React.CSSProperties = { fontFamily: "system-ui, sans-serif", lineHeight: 1.5 };
const buttonStyle: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #778296", background: "transparent", color: "inherit", cursor: "pointer" };
const panelStyle: React.CSSProperties = { padding: 14, borderRadius: 12, border: "1px solid #78839955", marginBottom: 14 };

function hash(text: string) {
  let h = 2166136261;
  for (const char of text) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0 || 1;
}
function nextRandom(seed: number): [number, number] {
  let x = (seed + 0x6d2b79f5) >>> 0;
  let t = x;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, x];
}
function makeDeck(faction: Faction): Card[] {
  return (Object.keys(families) as Family[]).flatMap((family) => [0, 1].map((copy) => {
    const dice = [...families[family].kinds];
    if (faction === "steel" && family === "fire" && copy === 0) dice[2] = "attack";
    if (faction === "steel" && family === "prepare" && copy === 0) dice[1] = "defense";
    if (faction === "ether" && family === "maneuver" && copy === 0) dice[2] = "tech";
    if (faction === "ether" && family === "fire" && copy === 0) dice[1] = "defense";
    return { id: faction + "-" + family + "-" + copy, family, name: families[family].name, dice, level: family === "fire" && copy === 1 ? 1 : 0 };
  }));
}
function handFromDeck(faction: Faction, seed: number): [Card[], number] {
  const deck = makeDeck(faction);
  let rng = seed;
  for (let i = deck.length - 1; i > 0; i--) {
    let roll: number;
    [roll, rng] = nextRandom(rng);
    const j = Math.floor(roll * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return [deck.slice(0, 5), rng];
}
function initial(seedText: string): Game {
  let rng = hash(seedText);
  const [handA, rngA] = handFromDeck("steel", rng);
  const [handB, rngB] = handFromDeck("ether", rngA);
  rng = rngB;
  function fleet(side: Side, faction: Faction, hand: Card[]): Fleet {
    return {
      faction, hand, dice: [], shields: 0, dealt: 0, played: [],
      ships: unitSpecs.map((s, i) => ({ id: side + i, name: s.name, role: s.role, hp: s.hp, maxHp: s.hp })),
    };
  }
  return {
    round: 1, active: "A", phase: "choose-card", acted: { A: false, B: false },
    fleets: { A: fleet("A", "steel", handA), B: fleet("B", "ether", handB) },
    current: null, actions: 0, commandUsed: false, rng, dieNumber: 0,
    log: ["Состав флотов задан стратегической частью (демонстрационный зеркальный состав). Карты дают кубы, корабли их тратят."],
  };
}
function totalHp(fleet: Fleet) { return fleet.ships.reduce((n, s) => n + s.hp, 0); }
function pairs(dice: Die[], predicate: (a: Die, b: Die) => boolean): Die[] | null {
  const valid: Die[][] = [];
  for (let i = 0; i < dice.length; i++) for (let j = i + 1; j < dice.length; j++) {
    if (predicate(dice[i], dice[j])) valid.push([dice[i], dice[j]]);
  }
  valid.sort((a, b) => a[0].value + a[1].value - b[0].value - b[1].value);
  return valid[0] || null;
}
function log(g: Game, message: string) { g.log = [message, ...g.log].slice(0, 14); }
function alive(f: Fleet, shipId: string | null) { return !!f.ships.find(s => s.id === shipId && s.hp > 0); }
function dealDamage(g: Game, amount: number, targetId: string) {
  const enemyId: Side = g.active === "A" ? "B" : "A";
  const enemy = g.fleets[enemyId];
  const target = enemy.ships.find(s => s.id === targetId && s.hp > 0) || enemy.ships.find(s => s.hp > 0);
  if (!target) return false;
  const absorbed = Math.min(enemy.shields, amount);
  enemy.shields -= absorbed;
  const actual = Math.min(target.hp, amount - absorbed);
  target.hp -= actual;
  g.fleets[g.active].dealt += actual;
  log(g, target.name + " (" + enemyId + "): " + actual + " урона" + (absorbed ? ", щиты поглотили " + absorbed : "") + ".");
  return true;
}
function takeCost(g: Game, ids: string[]) {
  const idset = new Set(ids);
  g.fleets[g.active].dice = g.fleets[g.active].dice.filter(d => !idset.has(d.id));
}
function command(g: Game, mode: "order" | "attack" | "guard" | "coordinate-shield", targetId: string): boolean {
  if (g.phase !== "orders" || g.actions <= 0) return false;
  const p = g.fleets[g.active];
  const dice = p.dice.filter(d => d.shipId && alive(p, d.shipId));
  const card = g.current;
  if (!card) return false;
  if ((mode === "order" || mode === "coordinate-shield") && g.commandUsed) { log(g, "Приказ этой карты уже использован."); return false; }
  if (mode === "attack") {
    const die = dice.find(d => d.kind === "attack" && d.value >= 2);
    if (!die) { log(g, "Для базовой атаки нужен назначенный ⚔2+."); return false; }
    takeCost(g, [die.id]);
    dealDamage(g, 1, targetId);
    log(g, "Базовый выстрел: ⚔" + die.value + ".");
  } else if (mode === "guard") {
    const die = dice.find(d => d.kind === "defense" && d.value >= 2);
    if (!die) { log(g, "Для базовой защиты нужен назначенный 🛡2+."); return false; }
    takeCost(g, [die.id]);
    p.shields = Math.min(6, p.shields + 2);
    log(g, "Базовая защита: +2 щита.");
  } else if (card.family === "fire") {
    const selected = pairs(dice, (a, b) => a.kind === "attack" && b.kind === "attack" && a.shipId !== b.shipId && a.value + b.value >= (card.level ? 3 : 4));
    if (!selected) { log(g, "Огонь требует два ⚔ с разных кораблей (сумма " + (card.level ? "3+" : "4+") + ")."); return false; }
    const bonus = selected.some(d => p.ships.some(s => s.id === d.shipId && s.role === "battleship" && s.hp > 0)) ? 1 : 0;
    takeCost(g, selected.map(d => d.id));
    dealDamage(g, 3 + bonus, targetId);
    log(g, "Совместный залп, усиление линкором: +" + bonus + ".");
  } else if (card.family === "guard") {
    const selected = pairs(dice, (a, b) => a.kind === "defense" && b.kind === "defense" && a.value + b.value >= 3);
    if (!selected) { log(g, "Оборона требует два 🛡 суммой 3+."); return false; }
    const bonus = selected.some(d => p.ships.some(s => s.id === d.shipId && s.role === "escort" && s.hp > 0)) ? 1 : 0;
    takeCost(g, selected.map(d => d.id));
    p.shields = Math.min(6, p.shields + 3 + bonus);
    log(g, "Общая оборона: +" + (3 + bonus) + " щита.");
  } else if (card.family === "maneuver") {
    const fuel = dice.find(d => d.kind === "tech" && d.value >= 2);
    const mod = dice.find(d => d.id !== fuel?.id && d.value < 3);
    if (!fuel || !mod) { log(g, "Манёвр требует ✦2+ и другой куб со значением 1–2."); return false; }
    takeCost(g, [fuel.id]);
    const remaining = p.dice.find(d => d.id === mod.id);
    if (remaining) remaining.value = Math.min(3, remaining.value + 1);
    log(g, "Манёвр: +" + 1 + " к закреплённому кубу.");
  } else if (card.family === "prepare") {
    const fuel = dice.find(d => d.kind === "tech" && d.value >= 2);
    const mod = dice.find(d => d.id !== fuel?.id && d.kind !== "attack");
    if (!fuel || !mod) { log(g, "Подготовка требует ✦2+ и ещё один куб не-⚔."); return false; }
    takeCost(g, [fuel.id]);
    const remaining = p.dice.find(d => d.id === mod.id);
    if (remaining) remaining.kind = "attack";
    log(g, "Подготовка: один куб преобразован в ⚔.");
  } else {
    const selected = pairs(dice, (a, b) => a.shipId !== b.shipId && a.value + b.value >= 4);
    if (!selected) { log(g, "Координация требует два куба разных кораблей суммой 4+."); return false; }
    const bonus = selected[0].value === selected[1].value && selected.some(d => p.ships.some(s => s.id === d.shipId && s.role === "destroyer" && s.hp > 0)) ? 1 : 0;
    takeCost(g, selected.map(d => d.id));
    if (mode === "coordinate-shield") {
      p.shields = Math.min(6, p.shields + 3 + bonus);
      log(g, "Координация: +" + (3 + bonus) + " щита.");
    } else {
      dealDamage(g, 2 + bonus, targetId);
      log(g, "Координация: " + (2 + bonus) + " урона.");
    }
  }
  g.actions--;
  if (mode === "order" || mode === "coordinate-shield") g.commandUsed = true;
  if (totalHp(g.fleets.A) === 0 || totalHp(g.fleets.B) === 0) g.phase = "finished";
  return true;
}

export default function FleetCombatV2() {
  const [seed, setSeed] = useState("fleet-playtest-01");
  const [game, setGame] = useState<Game>(() => initial("fleet-playtest-01"));
  const [selectedDie, setSelectedDie] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const activeFleet = game.fleets[game.active];
  const otherId: Side = game.active === "A" ? "B" : "A";
  const otherFleet = game.fleets[otherId];
  const currentTargetId = otherFleet.ships.some(s => s.id === targetId && s.hp > 0) ? targetId : otherFleet.ships.find(s => s.hp > 0)?.id || "";
  const winner = useMemo(() => totalHp(game.fleets.A) === totalHp(game.fleets.B) ? "Ничья" : totalHp(game.fleets.A) > totalHp(game.fleets.B) ? "A — Лига Стали" : "B — Сеть Эфира", [game]);

  function playCard(card: Card) {
    setSelectedDie(null);
    setGame(prev => {
      if (prev.phase !== "choose-card") return prev;
      const g: Game = structuredClone(prev);
      const p = g.fleets[g.active];
      if (!p.hand.find(c => c.id === card.id)) return prev;
      p.hand = p.hand.filter(c => c.id !== card.id);
      p.played.push(card.name + (card.level ? " I" : ""));
      g.current = card;
      g.phase = "orders";
      g.actions = 2;
      g.commandUsed = false;
      for (const kind of card.dice) {
        let roll: number;
        [roll, g.rng] = nextRandom(g.rng);
        g.dieNumber++;
        p.dice.push({ id: "v2d" + g.dieNumber, kind, value: 1 + Math.floor(roll * 3), shipId: null });
      }
      log(g, "Игрок " + g.active + " разыграл «" + card.name + "». Получено " + card.dice.map(k => kinds[k]).join("") + ".");
      return g;
    });
  }
  function assignDie(shipId: string) {
    if (!selectedDie) return;
    setGame(prev => {
      if (prev.phase !== "orders") return prev;
      const g: Game = structuredClone(prev);
      const fleet = g.fleets[g.active];
      if (!alive(fleet, shipId)) return prev;
      const die = fleet.dice.find(d => d.id === selectedDie);
      if (die) die.shipId = shipId;
      return g;
    });
    setSelectedDie(null);
  }
  function runAction(mode: "order" | "attack" | "guard" | "coordinate-shield") {
    setGame(prev => {
      const g: Game = structuredClone(prev);
      command(g, mode, currentTargetId);
      return g;
    });
  }
  function endTurn() {
    setSelectedDie(null);
    setGame(prev => {
      if (prev.phase !== "orders") return prev;
      const g: Game = structuredClone(prev);
      const p = g.fleets[g.active];
      if (p.dice.length > 6) {
        const sorted = [...p.dice].sort((a,b) => b.value - a.value);
        p.dice = sorted.slice(0,6);
        log(g, "Превышен запас 6 кубов: оставлены шесть с наибольшими значениями (автоправило MVP).");
      }
      g.acted[g.active] = true;
      const nextSide: Side = g.active === "A" ? "B" : "A";
      g.current = null;
      g.actions = 0;
      if (!g.acted[nextSide]) {
        g.active = nextSide;
        g.phase = "choose-card";
      } else if (g.round === 3 || totalHp(g.fleets.A) === 0 || totalHp(g.fleets.B) === 0) {
        g.phase = "finished";
      } else {
        g.round++;
        g.acted = { A: false, B: false };
        g.active = g.round % 2 === 0 ? "B" : "A";
        g.phase = "choose-card";
      }
      return g;
    });
  }

  return (
    <main style={{ ...textStyle, maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 750 }}>Fleet Combat v2 — эксперимент</h1>
      <p>Отдельный тестовый маршрут. Старый Dice Draft не изменён. Колода: 10 карт, рука: 5, бой: 3 раунда. Кубы генерируют <strong>карты</strong>, а корабли их используют.</p>
      <div style={panelStyle}>
        <label>Seed <input aria-label="Seed" style={{ padding: 7, margin: "0 8px", borderRadius: 6, border: "1px solid #888", background: "transparent", color: "inherit" }} value={seed} onChange={e => setSeed(e.target.value)} /></label>
        <button style={buttonStyle} onClick={() => { setGame(initial(seed)); setSelectedDie(null); setTargetId(""); }}>Новый бой</button>
      </div>
      <div style={panelStyle}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>
          {game.phase === "finished" ? "Бой завершён: " + winner : "Раунд " + game.round + "/3 · ход " + game.active + " (" + (game.active === "A" ? "Лига Стали" : "Сеть Эфира") + ")"}
        </h2>
        <p>Игрок A: {totalHp(game.fleets.A)} HP · {game.fleets.A.shields} щитов · урон {game.fleets.A.dealt} | Игрок B: {totalHp(game.fleets.B)} HP · {game.fleets.B.shields} щитов · урон {game.fleets.B.dealt}</p>
        {game.phase === "finished" ? <p>Сравнение по оставшемуся HP. Баланс пока не утверждён.</p> : null}
      </div>
      {game.phase !== "finished" && <section style={panelStyle}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>Рука приказов {game.active} ({activeFleet.hand.length})</h2>
        <p style={{ opacity: 0.75, fontSize: 13 }}>Карты не привязаны к конкретному кораблю. Выбери одну: она добавит три куба в пул.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {activeFleet.hand.map(card => (
            <button key={card.id} disabled={game.phase !== "choose-card"} style={{ ...buttonStyle, minWidth: 128, textAlign: "left", opacity: game.phase === "choose-card" ? 1 : 0.55 }} onClick={() => playCard(card)}>
              <strong>{card.name} {card.level ? "I" : ""}</strong><div style={{ fontSize: 23 }}>{card.dice.map(k => kinds[k]).join(" ")}</div>
            </button>
          ))}
        </div>
        {game.phase === "orders" && <p>Разыграна: <strong>{game.current?.name}</strong> · осталось действий: {game.actions} · приказ карты: {game.commandUsed ? "использован" : "доступен"}</p>}
      </section>}
      {game.phase === "orders" && <section style={panelStyle}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>Кубы · сначала назначь на корабли</h2>
        <p style={{ fontSize: 13, opacity: 0.75 }}>Нажми на куб, затем на свой корабль. Можно перераспределять до траты. Кубы сохраняются между раундами (до 6).</p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 15 }}>
          {activeFleet.dice.map(d => <button key={d.id} onClick={() => setSelectedDie(d.id)} style={{ ...buttonStyle, background: selectedDie === d.id ? "#315b8b" : "transparent", fontWeight: "bold" }} aria-pressed={selectedDie === d.id}>{kinds[d.kind]}{d.value} <small>{d.shipId ? "→" + activeFleet.ships.find(s => s.id === d.shipId)?.name : "· пул"}</small></button>)}
        </div>
        <h3 style={{ fontWeight: 650 }}>Мой флот — назначение кубов</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {activeFleet.ships.map(s => <button key={s.id} style={{ ...buttonStyle, textAlign: "left", opacity: s.hp > 0 ? 1 : .45 }} disabled={s.hp <= 0} onClick={() => assignDie(s.id)}>
            <strong>{s.name}</strong><div>HP {s.hp}/{s.maxHp}</div>
            <small>{activeFleet.dice.filter(d => d.shipId === s.id).map(d => kinds[d.kind] + d.value).join(" ") || "Нет кубов"}</small>
          </button>)}
        </div>
        <h3 style={{ fontWeight: 650, marginTop: 15 }}>Цель</h3>
        <select aria-label="Цель атаки" value={currentTargetId} onChange={e => setTargetId(e.target.value)} style={{ ...buttonStyle, minWidth: 180 }}>
          {otherFleet.ships.filter(s => s.hp > 0).map(s => <option key={s.id} value={s.id}>{s.name} · HP {s.hp}</option>)}
        </select>
        <h3 style={{ fontWeight: 650, marginTop: 15 }}>Приказы (всего 2 действия за раунд)</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button style={buttonStyle} disabled={game.actions <= 0 || game.commandUsed} onClick={() => runAction("order")}>Приказ карты: {game.current?.name}</button>
          {game.current?.family === "coordinate" && <button style={buttonStyle} disabled={game.actions <= 0 || game.commandUsed} onClick={() => runAction("coordinate-shield")}>Координация: защита</button>}
          <button style={buttonStyle} disabled={game.actions <= 0} onClick={() => runAction("attack")}>Обычный выстрел ⚔2+ → 1 урон</button>
          <button style={buttonStyle} disabled={game.actions <= 0} onClick={() => runAction("guard")}>Обычный щит 🛡2+ → +2 щита</button>
          <button style={{ ...buttonStyle, background: "#21466c", color: "white" }} onClick={endTurn}>Завершить ход</button>
        </div>
        <p style={{ fontSize: 12, opacity: .7 }}>Приказ автоматически расходует подходящую комбинацию уже назначенных кубов. Ручной выбор конкретной пары и реакционная защита — следующие этапы, пока не реализованы.</p>
      </section>}
      <section style={panelStyle}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>Корабли противника {otherId}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {otherFleet.ships.map(s => <div key={s.id} style={{ padding: 9, minWidth: 124, border: "1px solid #8892a355", borderRadius: 9, opacity: s.hp > 0 ? 1 : .4 }}><strong>{s.name}</strong><div>{s.hp}/{s.maxHp} HP</div></div>)}
        </div>
      </section>
      <section style={panelStyle}>
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>Журнал</h2>
        <ol>{game.log.map((entry, i) => <li key={i}>{entry}</li>)}</ol>
      </section>
      <p style={{ fontSize: 12, opacity: 0.72 }}>Это экспериментальный вертикальный срез для проверки экономики приказов и совместного расхода кубов, не окончательная боевая система и не сбалансированная 4X.</p>
    </main>
  );
}
