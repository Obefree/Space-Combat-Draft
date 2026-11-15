"use client";
import { useEffect, useMemo, useState } from "react";
import { CARD_TYPES, DIE_SYMBOL, UNIT_TYPES, aiActionChoice, aiDraftChoice, aiReactionChoice, aliveUnits, chooseCards, createGame, fleetHp, other, resolveReaction, tryAction, turnOf } from "./engine.mjs";
import "./fleet-test.css";

function DiceSymbol({ type, value }) { return <span className={"ftSymbol ft-" + type}>{DIE_SYMBOL[type]}{value || ""}</span>; }
function Die({ die, picked, disabled, onClick }) { return <button disabled={disabled} onClick={onClick} aria-pressed={picked} className={"ftDie ft-" + die.type + (picked ? " ftPicked" : "")}><DiceSymbol type={die.type} value={die.value}/></button>; }
function Ship({ unit, side, current, target, queued, onClick, canTarget }) {
  const data = UNIT_TYPES[unit.role];
  return <button disabled={!canTarget || unit.hp <= 0} onClick={onClick} className={"ftShip" + (unit.hp <= 0 ? " ftDead" : "") + (current ? " ftCurrent" : "") + (target ? " ftTarget" : "")}>
    <div className="ftShipImage"><img src={data.art} alt=""/><span>INI {unit.initiative}</span></div>
    <div className="ftShipText"><b>{data.name}</b> <small>{side}</small><div className="ftHealth">{unit.hp}/{unit.maxHp} HP · {queued ? "ещё действует" : "ожидает"}</div>
      <div className="ftHealthBar"><i style={{width: 100 * unit.hp / unit.maxHp + "%"}}/></div>
      <div className="ftAbility">{data.ability}</div><div className="ftCost">{data.cost}</div>
    </div>
  </button>;
}
function name(side) { return side === "A" ? "Лига Ориона" : "Гегемония"; }

export default function FleetTestPage() {
  const [seed, setSeed] = useState("battle-01");
  const [mode, setMode] = useState("solo");
  const [game, setGame] = useState(() => createGame("battle-01","solo"));
  const [picked, setPicked] = useState([]);
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const turn = turnOf(game);
  const activeSide = game.phase === "draft" ? game.drafting : game.phase === "react" ? game.pending?.defender : turn?.side;
  const ai = mode === "solo" && activeSide === "B";
  const myFleet = activeSide ? game.fleets[activeSide] : null;
  const opponent = turn ? game.fleets[other(turn.side)] : null;
  const actualTarget = opponent?.units.find(u => u.id === target && u.hp > 0)?.id || opponent?.units.find(u => u.hp > 0)?.id || "";
  const selectedCardsNeed = game.round === 1 ? 3 : 1;
  const nextQueue = useMemo(() => game.queue.slice(game.index, game.index + 8).filter(q => game.fleets[q.side].units.some(u => u.id === q.id && u.hp > 0)), [game]);

  useEffect(() => {
    if (game.mode !== "solo") return;
    let timer;
    if (game.phase === "draft" && game.drafting === "B") {
      timer = setTimeout(() => { setGame(g => chooseCards(g, aiDraftChoice(g))); setPicked([]); setSelected([]); }, 400);
    } else if (game.phase === "activate" && turn?.side === "B") {
      timer = setTimeout(() => { setGame(g => tryAction(g, aiActionChoice(g))); setSelected([]); }, 650);
    } else if (game.phase === "react" && game.pending?.defender === "B") {
      timer = setTimeout(() => { setGame(g => resolveReaction(g, aiReactionChoice(g))); setSelected([]); }, 450);
    }
    return () => clearTimeout(timer);
  }, [game, turn]);

  function reset() { setGame(createGame(seed, mode)); setPicked([]); setSelected([]); setTarget(""); setError(""); }
  function pickCard(id) { setPicked(v => v.includes(id) ? v.filter(x => x !== id) : v.length < selectedCardsNeed ? [...v,id] : selectedCardsNeed === 1 ? [id] : v); }
  function confirm() {
    const next = chooseCards(game, picked);
    if (next === game) { setError("Нужно выбрать " + selectedCardsNeed + " карт."); return; }
    setGame(next);setPicked([]);setSelected([]);setError("");
  }
  function pickDie(id) { setSelected(v => v.includes(id) ? v.filter(x => x !== id) : v.length >= 3 ? [...v.slice(1),id] : [...v,id]); }
  function act(kind) {
    const next = tryAction(game,{kind,diceIds:selected,targetId:actualTarget});
    if (next === game) { setError("Выбранные кубы не подходят. Проверь стоимость способности и значения кубов."); return; }
    setGame(next);setSelected([]);setError("");
  }
  function defend(id) {
    const next = resolveReaction(game,id);
    if (next !== game) { setGame(next);setSelected([]);setError(""); }
  }
  const pending = game.pending;
  const reactionUnit = pending && game.fleets[pending.defender].units.find(u => u.id === pending.target);

  return <main className="ftRoot">
    <header className="ftTop">
      <div className="ftIntro"><a href="/" className="ftBack">← Старый космический драфт</a><div className="ftOverline">SPACE COMBAT DRAFT · НОВАЯ СЦЕНА</div>
        <h1>Инициативный бой флотов</h1><p>Карты определяют кубы. Корабли сражаются по инициативе. Каждый потраченный куб уходит из пула.</p></div>
      <div className="ftSettings"><label>Режим<select value={mode} onChange={e => setMode(e.target.value)}><option value="solo">Против компьютера</option><option value="hotseat">Два игрока рядом</option></select></label>
        <label>Seed<input value={seed} onChange={e => setSeed(e.target.value)}/></label><button className="ftPrimary" onClick={reset}>Новый бой</button></div>
    </header>

    <div className="ftScore">
      <div><small>Раунд</small><strong>{game.round} / 3</strong></div>
      {["A","B"].map(s => <div key={s}><small>{name(s)}</small><strong>{fleetHp(game.fleets[s])} HP</strong><span>Щиты {game.fleets[s].shield} · Кубы {game.fleets[s].dice.length}</span></div>)}
      <div><small>Этап</small><strong>{game.phase === "draft" ? "Карты" : game.phase === "activate" ? "Активация" : game.phase === "react" ? "Защита" : "Конец боя"}</strong></div>
    </div>

    <div className="ftColumns"><div className="ftGameplay">
      {game.phase === "draft" && <section className="ftPanel ftMainPanel"><div className="ftPanelHead"><div><small>ПОДГОТОВКА К РАУНДУ {game.round}</small><h2>{name(game.drafting)} — {game.round === 1 ? "три стартовые карты" : "одна дополнительная карта"}</h2></div><span className="ftCounter">{picked.length}/{selectedCardsNeed}</span></div>
        {ai ? <p className="ftNotice">Компьютер подбирает карты…</p> : <>
          <p>{game.round === 1 ? "Выбери три из пяти карт. Их кубы бросаются в общий резерв флота. Оставшиеся две карты пригодятся в следующих раундах." : "Выбери карту, чтобы добавить новые кубы. Старые кубы и их значения остаются."}</p>
          <div className="ftCards">{myFleet.hand.map(c => <button key={c.id} onClick={() => pickCard(c.id)} aria-pressed={picked.includes(c.id)} className={"ftCard" + (picked.includes(c.id) ? " ftCardPicked" : "")}>
            <strong>{c.name}</strong><span>{c.dice.map((d,i)=><DiceSymbol key={i} type={d}/>)}</span><small>{c.hint}</small></button>)}</div>
          <div className="ftActions"><button disabled={picked.length !== selectedCardsNeed} className="ftPrimary" onClick={confirm}>Получить кубы и продолжить</button><span className="ftFine">Каждая введённая карта даёт 2 куба и 1 активацию за раунд.</span></div>
        </>}
      </section>}

      {game.phase === "activate" && <section className="ftPanel ftMainPanel"><div className="ftPanelHead"><div><small>ХОД ПО ИНИЦИАТИВЕ · ВОЛНА {turn?.wave}</small><h2>{UNIT_TYPES[turn.role].name} — {name(turn.side)}</h2></div><span className="ftCounter">INI {turn.initiative}</span></div>
        {ai ? <p className="ftNotice">Корабль противника выбирает действие…</p> : <>
          <p>Выбери кубы, затем действие корабля. Кубы списываются сразу. Для атаки нажми нужный корабль противника справа.</p>
          <h3>Ваш резерв <small>({myFleet.dice.length} кубов, выбрано {selected.length})</small></h3>
          <div className="ftDice">{myFleet.dice.map(d => <Die key={d.id} die={d} picked={selected.includes(d.id)} onClick={() => pickDie(d.id)}/>)}</div>
          <div className="ftSpecial"><b>{UNIT_TYPES[turn.role].ability}</b><span>{UNIT_TYPES[turn.role].cost}</span></div>
          <div className="ftActions"><button className="ftPrimary" onClick={() => act("special")}>★ Особая способность</button><button onClick={() => act("fire")}>⚔ Выстрел</button><button onClick={() => act("brace")}>🛡 Поднять щит</button><button onClick={() => act("tune")}>✦ Улучшить куб</button><button onClick={() => act("pass")}>Пропустить</button></div>
          <p className="ftFine">Выстрел: ⚔1–2 = 1 урон, ⚔3 = 2. Щит: 🛡 добавляет защиту по значению куба. ✦ увеличивает другой куб на 1.</p>
        </>}
        {!!error && <p role="status" className="ftError">{error}</p>}
      </section>}

      {game.phase === "react" && <section className="ftPanel ftMainPanel"><div className="ftPanelHead"><div><small>РЕАКЦИЯ БЕЗ ТРАТЫ АКТИВАЦИИ</small><h2>{name(pending.defender)} — защита</h2></div><span className="ftCounter">−{pending.damage} урона</span></div>
        <p>Атакован: {UNIT_TYPES[reactionUnit?.role]?.name}. Можно потратить один 🛡 куб, уменьшив урон на его значение, либо принять удар.</p>
        {ai ? <p className="ftNotice">Компьютер выбирает защитную реакцию…</p> : <>
          <div className="ftDice">{myFleet.dice.filter(d=>d.type==="defense").map(d=><Die key={d.id} die={d} picked={selected.includes(d.id)} onClick={()=>setSelected([d.id])}/>)}</div>
          <div className="ftActions"><button className="ftPrimary" disabled={selected.length!==1} onClick={()=>defend(selected[0])}>Потратить выбранный щит</button><button onClick={()=>defend(null)}>Принять урон</button></div>
        </>}
      </section>}

      {game.phase === "done" && <section className="ftPanel ftMainPanel"><small>БОЙ ЗАВЕРШЁН</small><h2>{game.winner==="draw"?"Ничья":"Победила "+name(game.winner)}</h2><p>Лига Ориона: {fleetHp(game.fleets.A)} HP. Гегемония: {fleetHp(game.fleets.B)} HP.</p><button className="ftPrimary" onClick={reset}>Сыграть ещё раз</button></section>}

      <section className="ftPanel"><h2>Очередь по инициативе</h2><div className="ftQueue">{nextQueue.length ? nextQueue.map((q,i)=><span className={"ftQueueChip"+(i===0?" ftQueueNow":"")} key={q.id+"-"+i}><b>{q.initiative}</b> {UNIT_TYPES[q.role].name} <small>{q.side}{q.wave===2?" • снова":""}</small></span>) : <p>Формируется после выбора карт обоими игроками.</p>}</div></section>
      <section className="ftPanel"><h2>Введённые боевые карты</h2><div className="ftDeployed">{["A","B"].map(s=><div key={s}><h3>{name(s)} ({game.fleets[s].activeCards.length} активации)</h3><div className="ftCardMinis">{game.fleets[s].activeCards.map(c=><div key={c.id} className="ftCardMini"><b>{c.name}</b><span>{c.dice.map((d,i)=><DiceSymbol type={d} key={i}/>)}</span></div>)}</div></div>)}</div></section>
    </div>

    <aside className="ftSidebar">{["A","B"].map(s=><section className={"ftPanel ftFleet ftFleet"+s} key={s}><div className="ftPanelHead"><h2>{name(s)}</h2><span className="ftCounter">{aliveUnits(game.fleets[s]).length}/3</span></div>
      <div className="ftShips">{game.fleets[s].units.map(u=><Ship key={u.id} unit={u} side={s} current={turn?.id===u.id} targeted={actualTarget===u.id&&turn?.side!==s}
        queued={game.queue.slice(game.index).some(q=>q.id===u.id)}
        canTarget={game.phase==="activate"&&!ai&&turn?.side!==s} onClick={()=>setTarget(u.id)}/>)}</div>
      {game.phase==="activate"&&!ai&&turn?.side!==s&&<p className="ftFine">Нажми на корабль, чтобы назначить его целью.</p>}</section>)}
      <section className="ftPanel"><h2>Журнал боя</h2><ol className="ftLog">{game.log.slice(0,12).map((l,i)=><li key={i}>{l}</li>)}</ol></section>
    </aside></div>
    <footer className="ftFooter">Это отдельная тестовая сцена в существующем Space Combat Draft. Составы флотов пока заданы сценарием; старая игра остаётся на главной странице.</footer>
  </main>;
}
