"use client";
import { useEffect, useMemo, useState } from "react";
import { CARD_TYPES, DEMO_FLOW, DIE_SYMBOL, UNIT_TYPES, aiActionChoice, aiDraftChoice, aiReactionChoice, aliveUnits, chooseCards, createGame, fleetHp, fleetLosses, victoryPoints, other, placeCards, suggestedAssignments, resolveReaction, tryAction, turnOf } from "./engine.mjs";
import "./fleet-test.css";

function DiceSymbol({ type, value }) { return <span className={"ftSymbol ft-" + type}>{DIE_SYMBOL[type]}{value || ""}</span>; }
function Die({ die, picked, disabled, onClick }) { return <button disabled={disabled} onClick={onClick} aria-pressed={picked} className={"ftDie ft-" + die.type + (picked ? " ftPicked" : "")}><DiceSymbol type={die.type} value={die.value}/></button>; }
function Ship({ unit, side, current, target, queued, commands, specialSpent, onClick, canTarget }) {
  const data = UNIT_TYPES[unit.role];
  const [payment, effect] = data.cost.split("→").map(text => text.trim());
  return <button type="button" disabled={!canTarget || unit.hp <= 0} onClick={onClick}
    aria-label={data.name + ", инициатива " + unit.initiative + ", способность " + data.ability + ", " + data.cost}
    className={"ftShip" + (unit.hp <= 0 ? " ftDead" : "") + (current ? " ftCurrent" : "") + (target ? " ftTarget" : "")}>
    <div className="ftShipImage"><img src={data.art} alt="" loading="lazy"/><span>⚡ {unit.initiative} · ★ {unit.glory}</span></div>
    <div className="ftShipText">
      <div className="ftShipTitle"><b>{data.name}</b><small>{side === "A" ? "Лига" : "Гегемония"}</small></div>
      <div className="ftHealth">{unit.hp}/{unit.maxHp} HP · ★ {unit.glory} за выживание</div>
      <div className="ftHealthBar"><i style={{width:100*unit.hp/unit.maxHp+"%"}}/></div>
      <div className="ftShipOrders">{commands ? "Приказов: " + commands : "Приказов пока нет"}{queued ? " · впереди ход" : ""}</div>
      <div className="ftShipSpecial">
        <div className="ftShipSpecialHead"><span>ОСОБАЯ СПОСОБНОСТЬ</span><em>{specialSpent ? "Уже применена" : "1 раз за раунд"}</em></div>
        <strong>{data.ability}</strong>
        <div className="ftShipPayment">{payment}</div>
        <div className="ftShipEffect">{effect || data.cost}</div>
      </div>
      <div className="ftShipModule">{data.module}</div>
    </div>
  </button>;
}
function InitiativeBattlefield({ game, turn, targetId, canChooseTarget, onTarget }) {
  // The original game places League above the initiative axis and Hegemony below it.
  // The DOM is ordered highest initiative first; RTL layout starts with that ship on the RIGHT.
  const lineup = ["A","B"].flatMap(side =>
    game.fleets[side].units.map(unit => ({ side, unit })))
    .sort((a,b) => b.unit.initiative - a.unit.initiative ||
      b.unit.glory - a.unit.glory || a.unit.id.localeCompare(b.unit.id));
  const renderShip = ({side,unit}) => {
    const commandCount = game.fleets[side].activeCards.filter(c => c.assignedShipId === unit.id).length;
    return <Ship unit={unit} side={side} current={turn?.id === unit.id}
      target={targetId === unit.id && turn?.side !== side}
      queued={game.queue.slice(game.index).some(q => q.id === unit.id)}
      commands={commandCount} specialSpent={game.specialUsed[side].includes(unit.id)}
      canTarget={canChooseTarget && turn?.side !== side}
      onClick={() => onTarget(unit.id)}/>;
  };
  return <section className="ftPanel ftBattlefield" aria-label="Поле боя: очередь справа налево">
    <div className="ftPanelHead">
      <div><small>БОЕВОЕ ПОЛЕ · КАК В КЛАССИЧЕСКОМ РЕЖИМЕ</small>
        <h2>Линия инициативы — справа налево</h2></div>
      <span className="ftCounter">⚡ 8 → 7 → 5 → 4 → 3 → 2</span>
    </div>
    <div className="ftBattlefieldMeta"><span>Лига Ориона · сверху</span>
      <strong>Высокая инициатива справа → ход к левому краю</strong>
      <span>Гегемония · снизу</span></div>
    <div className="ftBattlefieldScroller" dir="rtl" role="region" tabIndex={0}
      aria-label="Горизонтальное поле боя. Прокрутите для просмотра кораблей. Высокая инициатива справа.">
      <div className="ftBattlefieldLine">
        {lineup.map(entry => <div className="ftBattlefieldColumn" key={entry.unit.id}>
          <div className={"ftBattlefieldSlot ftBattlefieldTop" + (entry.side==="A"?" ftFilled":"")}>
            {entry.side === "A" ? renderShip(entry) : null}
          </div>
          <div className={"ftBattlefieldAxis" + (turn?.id === entry.unit.id ? " ftAxisActive" : "")}>
            <span>⚡ {entry.unit.initiative}</span>
            <strong>{turn?.id === entry.unit.id ? "СЕЙЧАС ХОД" : "ИНИЦИАТИВА"}</strong>
          </div>
          <div className={"ftBattlefieldSlot ftBattlefieldBottom" + (entry.side==="B"?" ftFilled":"")}>
            {entry.side === "B" ? renderShip(entry) : null}
          </div>
        </div>)}
      </div>
    </div>
    {canChooseTarget && <p className="ftBattlefieldHint">Выбери корабль противника прямо на линии инициативы. Выделенная красным карточка — текущая цель.</p>}
  </section>;
}
function name(side) { return side === "A" ? "Лига Ориона" : "Гегемония"; }

function RulesBrief({ onPlay }) {
  return <section id="demo-rules" className="ftBrief">
    <div className="ftBriefHead">
      <p className="ftOverline">КАК ИГРАТЬ ДЕМО-БОЙ</p>
      <h2>Семь шагов, потом бой</h2>
      <p>Флоты уже стоят на поле. Карты дают кубы и становятся приказами. Победа — по ★ живых кораблей.</p>
    </div>
    <div className="ftLoop" aria-hidden="true">
      <div className="ftLoopBeat ftLoopCards">
        <b>Карты</b>
        <div className="ftLoopCardRow">{CARD_TYPES.map((c, i) =>
          <span key={c.id} className={"ftLoopMini" + (i < 3 ? " ftLoopMiniOn" : "")}>{c.dice.map(d => DIE_SYMBOL[d]).join("")}</span>)}
        </div>
      </div>
      <div className="ftLoopBeat ftLoopDice">
        <b>Кубы</b>
        <div className="ftLoopDiceRow">
          <span className="ftSymbol ft-attack">⚔2</span>
          <span className="ftSymbol ft-defense">🛡3</span>
          <span className="ftSymbol ft-tech">✦1</span>
        </div>
      </div>
      <div className="ftLoopBeat ftLoopInitiative">
        <b>Инициатива</b>
        <div className="ftQueue">
          <span className="ftQueueChip ftQueueNow"><b>8</b> Разведчик</span>
          <span className="ftQueueChip"><b>7</b> Перехватчик</span>
          <span className="ftQueueChip"><b>5</b> Эсминец</span>
        </div>
      </div>
      <div className="ftLoopBeat ftLoopClash">
        <b>Удар</b>
        <div className="ftLoopClashRow">
          <span className="ftSymbol ft-attack">⚔</span>
          <span className="ftLoopClashFlash">vs</span>
          <span className="ftSymbol ft-defense">🛡</span>
        </div>
      </div>
    </div>
    <div className="ftDemoCards">{CARD_TYPES.map(c =>
      <article key={c.id} className="ftDemoCard">
        <strong>{c.name}</strong>
        <span>{c.dice.map((d, i) => <DiceSymbol key={i} type={d}/>)}</span>
        <small>{c.hint}</small>
        <p className="ftWhy">{c.why}</p>
      </article>)}
    </div>
    <ol className="ftWhySteps">{DEMO_FLOW.map(step =>
      <li key={step.n}><b>{step.n}. {step.title}</b><span>{step.what}</span><em>{step.why}</em></li>)}
    </ol>
    <div className="ftActions"><button className="ftPrimary" onClick={onPlay}>Играть демо-бой</button></div>
  </section>;
}

export default function FleetTestPage() {
  const [seed, setSeed] = useState("battle-01");
  const [mode, setMode] = useState("solo");
  const [game, setGame] = useState(() => createGame("battle-01","solo"));
  const [picked, setPicked] = useState([]);
  const [selected, setSelected] = useState([]);
  const [placements, setPlacements] = useState({});
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [showBrief, setShowBrief] = useState(true);
  const turn = turnOf(game);
  const activeSide = game.phase === "draft" ? game.drafting : game.phase === "place" ? game.placing : game.phase === "react" ? game.pending?.defender : turn?.side;
  const ai = game.mode === "solo" && activeSide === "B";
  const myFleet = activeSide ? game.fleets[activeSide] : null;
  const opponent = turn ? game.fleets[other(turn.side)] : null;
  const actualTarget = opponent?.units.find(u => u.id === target && u.hp > 0)?.id || opponent?.units.find(u => u.hp > 0)?.id || "";
  const selectedCardsNeed = game.round === 1 ? 3 : 1;
  const proposed = game.phase === "place" ? { ...suggestedAssignments(game, game.placing), ...placements } : {};
  const rowPreview = game.phase === "place" ? game.fleets[game.placing].activeCards.map(card => ({
    card, unit: game.fleets[game.placing].units.find(u => u.id === proposed[card.id])
  })).sort((a,b) => (b.unit?.initiative || 0) - (a.unit?.initiative || 0)) : [];
  const nextQueue = useMemo(() => game.queue.slice(game.index, game.index + 12).filter(q => game.fleets[q.side].units.some(u => u.id === q.id && u.hp > 0)), [game]);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("space-fleet-brief-dismissed") === "1";
      const wantRules = window.location.hash.includes("rules");
      if (dismissed && !wantRules) setShowBrief(false);
    } catch { /* localStorage may be blocked */ }
  }, []);

  function playDemo() {
    try { localStorage.setItem("space-fleet-brief-dismissed", "1"); } catch { /* ignore */ }
    setShowBrief(false);
  }

  useEffect(() => {
    if (game.mode !== "solo") return;
    let timer;
    if (game.phase === "draft" && game.drafting === "B") {
      timer = setTimeout(() => { setGame(g => chooseCards(g, aiDraftChoice(g))); setPicked([]); setSelected([]); }, 400);
    } else if (game.phase === "place" && game.placing === "B") {
      timer = setTimeout(() => { setGame(g => placeCards(g, suggestedAssignments(g,"B"))); setPlacements({}); setSelected([]); }, 430);
    } else if (game.phase === "activate" && turn?.side === "B") {
      timer = setTimeout(() => { setGame(g => tryAction(g, aiActionChoice(g))); setSelected([]); }, 650);
    } else if (game.phase === "react" && game.pending?.defender === "B") {
      timer = setTimeout(() => { setGame(g => resolveReaction(g, aiReactionChoice(g))); setSelected([]); }, 450);
    }
    return () => clearTimeout(timer);
  }, [game, turn]);

  function reset() { setGame(createGame(seed, mode)); setPicked([]); setSelected([]); setPlacements({}); setTarget(""); setError(""); }
  function pickCard(id) { setPicked(v => v.includes(id) ? v.filter(x => x !== id) : v.length < selectedCardsNeed ? [...v,id] : selectedCardsNeed === 1 ? [id] : v); }
  function confirm() {
    const next = chooseCards(game, picked);
    if (next === game) { setError("Нужно выбрать " + selectedCardsNeed + " карт."); return; }
    setGame(next);setPicked([]);setSelected([]);setPlacements({});setError("");
  }
  function commitPlacement() {
    const next = placeCards(game, proposed);
    if (next === game) { setError("Не больше двух активаций на корабль. Излишние карты можно оставить в резерве."); return; }
    setGame(next); setPlacements({}); setSelected([]); setError("");
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
        <h1>Инициативный бой флотов</h1><p>Карты становятся приказами в ряду инициативы. Корабли расходуют кубы или сохраняют их.</p></div>
      <div className="ftSettings"><label>Режим<select value={mode} onChange={e => setMode(e.target.value)}><option value="solo">Против компьютера</option><option value="hotseat">Два игрока рядом</option></select></label>
        <label>Seed<input value={seed} onChange={e => setSeed(e.target.value)}/></label>
        <button type="button" onClick={() => setShowBrief(true)}>Правила</button>
        <button className="ftPrimary" onClick={reset}>Новый бой</button></div>
    </header>

    {showBrief && <RulesBrief onPlay={playDemo}/>}

    {!showBrief && <><div className="ftScore">
      <div><small>Раунд</small><strong>{game.round} / 3</strong></div>
      {["A","B"].map(s => <div key={s}><small>{name(s)}</small><strong>★ {victoryPoints(game.fleets[s])} очков</strong><span>{fleetHp(game.fleets[s])} HP · Потерь {fleetLosses(game.fleets[s])} · Щиты {game.fleets[s].shield} · Кубы {game.fleets[s].dice.length}</span></div>)}
      <div><small>Этап</small><strong>{game.phase === "draft" ? "Карты" : game.phase === "place" ? "Инициатива" : game.phase === "activate" ? "Активация" : game.phase === "react" ? "Защита" : "Конец боя"}</strong></div>
    </div>

    <InitiativeBattlefield game={game} turn={turn} targetId={actualTarget}
      canChooseTarget={game.phase==="activate" && !ai}
      onTarget={setTarget}/>

    <div className="ftColumns"><div className="ftGameplay">
      {game.phase === "draft" && <section className="ftPanel ftMainPanel"><div className="ftPanelHead"><div><small>ПОДГОТОВКА К РАУНДУ {game.round}</small><h2>{name(game.drafting)} — {game.round === 1 ? "три стартовые карты" : "одна дополнительная карта"}</h2></div><span className="ftCounter">{picked.length}/{selectedCardsNeed}</span></div>
        {ai ? <p className="ftNotice">Компьютер подбирает карты…</p> : <>
          <p>{game.round === 1 ? "Выбери три из пяти карт. Их кубы бросаются в общий резерв флота. Оставшиеся две карты пригодятся в следующих раундах." : "Выбери карту, чтобы добавить новые кубы. Старые кубы и их значения остаются."}</p>
          <div className="ftCards">{myFleet.hand.map(c => <button key={c.id} onClick={() => pickCard(c.id)} aria-pressed={picked.includes(c.id)} className={"ftCard" + (picked.includes(c.id) ? " ftCardPicked" : "")}>
            <strong>{c.name}</strong><span>{c.dice.map((d,i)=><DiceSymbol key={i} type={d}/>)}</span><small>{c.hint}</small>{c.why ? <em className="ftCardWhy">{c.why}</em> : null}</button>)}</div>
          <div className="ftActions"><button disabled={picked.length !== selectedCardsNeed} className="ftPrimary" onClick={confirm}>Получить кубы и продолжить</button><span className="ftFine">Каждая введённая карта даёт 2 куба и 1 активацию за раунд.</span></div>
        </>}
      </section>}

      {game.phase === "place" && <section className="ftPanel ftMainPanel">
        <div className="ftPanelHead"><div><small>КОМАНДНЫЕ КАРТЫ → ШКАЛА ИНИЦИАТИВЫ</small>
          <h2>{name(game.placing)} — назначь исполнителей</h2></div><span className="ftCounter">{myFleet.activeCards.length} карт</span></div>
        {ai ? <p className="ftNotice">Компьютер размещает приказы на шкале инициативы…</p> : <>
          <p>Каждая карта остаётся в ряду и даёт одну активацию за раунд. Очерёдность зависит от инициативы назначенного корабля. Не больше двух активаций на корабль.</p>
          <div className="ftAssignments">{myFleet.activeCards.map(card => <label key={card.id} className="ftAssignment">
            <span className="ftAssignmentCard"><b>{card.name}</b><span>{card.dice.map((d,i) => <DiceSymbol type={d} key={i}/>)}</span></span>
            <select aria-label={"Исполнитель: "+card.name} value={proposed[card.id] || "reserve"}
              onChange={e => setPlacements(v => ({...v, [card.id]: e.target.value}))}>
              {aliveUnits(myFleet).map(u => <option key={u.id} value={u.id}>{UNIT_TYPES[u.role].name} (INI {u.initiative})</option>)}
              <option value="reserve">Резерв без активации</option>
            </select>
          </label>)}</div>
          <div className="ftTimeline"><h3>Предварительный ряд инициативы</h3>
            <div className="ftQueue ftQueueRtl" dir="rtl">{rowPreview.map(({card,unit}) => <span className="ftQueueChip" key={card.id}>
              <b>{unit?.initiative || "—"}</b> {unit ? UNIT_TYPES[unit.role].name : "Резерв"} <small>{card.name}</small>
            </span>)}</div></div>
          <div className="ftActions"><button className="ftPrimary" onClick={commitPlacement}>Разместить приказы и начать раунд</button></div>
        </>}
        {!!error && <p role="status" className="ftError">{error}</p>}
      </section>}

      {game.phase === "activate" && <section className="ftPanel ftMainPanel"><div className="ftPanelHead"><div><small>ХОД ПО ИНИЦИАТИВЕ · ВОЛНА {turn?.wave}</small><h2>{UNIT_TYPES[turn.role].name} — {name(turn.side)}</h2></div><span className="ftCounter">INI {turn.initiative} · ★ {game.fleets[turn.side].units.find(u=>u.id===turn.id)?.glory}</span></div>
        <div className="ftCommandNote">Приказ: <strong>{turn?.cardName}</strong> — одна активация. Особая способность корабля доступна один раз за раунд.</div>
        {ai ? <p className="ftNotice">Корабль противника выбирает действие…</p> : <>
          <p>Выбери кубы, затем действие корабля. Кубы списываются сразу. Для атаки выбери корабль противника на линии инициативы выше.</p>
          <h3>Ваш резерв <small>({myFleet.dice.length} кубов, выбрано {selected.length})</small></h3>
          <div className="ftDice">{myFleet.dice.map(d => <Die key={d.id} die={d} picked={selected.includes(d.id)} onClick={() => pickDie(d.id)}/>)}</div>
          <div className="ftSpecial"><b>{UNIT_TYPES[turn.role].ability}</b><span>{UNIT_TYPES[turn.role].cost}</span></div>
          <div className="ftActions"><button className="ftPrimary" disabled={game.specialUsed[turn.side].includes(turn.id)} onClick={() => act("special")}>★ Особая способность</button><button onClick={() => act("fire")}>⚔ Выстрел</button><button onClick={() => act("brace")}>🛡 Поднять щит</button><button onClick={() => act("tune")}>✦ Улучшить куб</button><button onClick={() => act("pass")}>Пропустить</button></div>
          <p className="ftFine">Выстрел: ⚔1–2 = 1 урон, ⚔3 = 2. Щиты поглощают входящий урон и исчезают в конце раунда. ✦ увеличивает другой куб на 1. Пропуск сохраняет кубы.</p>
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

      {game.phase === "done" && <section className="ftPanel ftMainPanel">
        <small>БОЙ ЗАВЕРШЁН · {game.result?.kind === "mutual-annihilation" ? "ВЗАИМНОЕ УНИЧТОЖЕНИЕ" :
        game.result?.kind === "annihilation" ? "ПОЛНОЕ УНИЧТОЖЕНИЕ ФЛОТА" :
        game.result?.kind === "draw" ? "РАВЕНСТВО ОЧКОВ" : "ПОБЕДА ПО ОЧКАМ ВЫЖИВШИХ"}</small>
        <h2>{game.winner==="draw"?"Ничья":"Победила "+name(game.winner)}</h2>
        <div className="ftOutcomeScores">{["A","B"].map(s=><div key={s}>
          <strong>{name(s)}: ★ {victoryPoints(game.fleets[s])}</strong>
          <span>{aliveUnits(game.fleets[s]).length} выжили · {fleetLosses(game.fleets[s])} уничтожены</span>
          <small>Живые: {aliveUnits(game.fleets[s]).map(u=>UNIT_TYPES[u.role].name+" (★"+u.glory+")").join(", ")||"нет"}</small>
        </div>)}</div>
        <p className="ftFine">Очки дают только выжившие корабли. HP определяет повреждения и уничтожение, но не служит счётом победы.</p>
        <button className="ftPrimary" onClick={reset}>Сыграть ещё раз</button>
      </section>}

      <section className="ftPanel"><h2>Очередь по инициативе</h2><div className="ftQueue ftQueueRtl" dir="rtl">{nextQueue.length ? nextQueue.map((q,i)=><span className={"ftQueueChip"+(i===0?" ftQueueNow":"")} key={q.id+"-"+i}><b>{q.initiative}</b> {UNIT_TYPES[q.role].name} <small>★ {UNIT_TYPES[q.role].glory} · {q.side} · {q.cardName}{q.wave===2?" · повтор":""}</small></span>) : <p>Формируется после выбора карт обоими игроками.</p>}</div></section>
      <section className="ftPanel"><h2>Введённые боевые карты</h2><div className="ftDeployed">{["A","B"].map(s=><div key={s}><h3>{name(s)} ({game.fleets[s].activeCards.length} командных карт)</h3><div className="ftCardMinis">{game.fleets[s].activeCards.map(c=><div key={c.id} className="ftCardMini"><b>{c.name}</b><small>{UNIT_TYPES[game.fleets[s].units.find(u => u.id === c.assignedShipId)?.role]?.name || "В резерве"}</small><span>{c.dice.map((d,i)=><DiceSymbol type={d} key={i}/>)}</span></div>)}</div></div>)}</div></section>
    </div>

    <aside className="ftSidebar">
      <section className="ftPanel"><h2>Журнал боя</h2>
        <ol className="ftLog">{game.log.slice(0,12).map((l,i)=><li key={i}>{l}</li>)}</ol>
      </section>
    </aside></div>
    </>}
    <footer className="ftFooter">Это отдельная тестовая сцена в существующем Space Combat Draft. Составы флотов пока заданы сценарием; старая игра остаётся на главной странице.</footer>
  </main>;
}
