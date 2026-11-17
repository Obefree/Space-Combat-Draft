"use client";
import { useEffect, useState } from "react";
import { DIE_SYMBOL, UNIT_TYPES, DEMO_FLOW, createGame, chooseCards, availableDice, costText, canPay, turnOf, other, aliveUnits, victoryPoints, initiative, tryAction, playReaction, resolveReaction, aiStep } from "./engine.mjs";
import "./fleet-test.css";
function name(side) {return side === "A" ? "Лига Ориона" : "Гегемония";}
function AbilityFields({abilities}) {return <div className="ftDualAbilities">{abilities.map((a,i)=><div className="ftAbilityField" key={a.name}><small>{i===0?"БАЗОВАЯ":"УСИЛЕННАЯ"} · {costText(a.cost)||"Без оплаты"}</small><strong>{a.name}</strong><span>{a.text}</span></div>)}</div>;}
function Ship({unit,side,current,target,queued,acted,dice,onClick,canTarget}) {
 const data=UNIT_TYPES[unit.role];
 return <button type="button" disabled={!canTarget||unit.hp<=0} onClick={onClick} aria-label={data.name+", инициатива "+unit.initiative+(canTarget?", выбрать целью":"")} className={"ftShip"+(unit.hp<=0?" ftDead":"")+(current?" ftCurrent":"")+(target?" ftTarget":"")}>
  <div className="ftShipImage"><img src={data.art} alt="" loading="lazy"/><span>⚡ {unit.initiative} · ★ {unit.glory}</span></div>
  <div className="ftShipText"><div className="ftShipTitle"><b>{data.name}</b><small>{side==="A"?"Лига":"Гегемония"}</small></div>
   <div className="ftHealth">{unit.hp}/{unit.maxHp} HP</div><div className="ftHealthBar"><i style={{width:100*unit.hp/unit.maxHp+"%"}}/></div>
   <div className="ftShipDice" aria-label="Собственные кубы корабля">{data.dice.map((type,i)=>{const d=dice.find(d=>d.id===unit.id+"-d"+i);return <span className={!d?"ftBurned":d.spent?"ftExhausted":""} key={i}>{DIE_SYMBOL[type]}{d?d.value:"×"}</span>;})}</div>
   <small>{unit.hp<=0?"Уничтожен":current?"Сейчас ход":queued?"Ожидает активации":acted?"Ход завершён":"Собственная активация"}</small>
   <AbilityFields abilities={data.abilities}/>
  </div>
 </button>;
}
function InitiativeBattlefield({ game, turn, targetId, canChooseTarget, onTarget }) {
  // The original game places League above the initiative axis and Hegemony below it.
  // The DOM is ordered highest initiative first; RTL layout starts with that ship on the RIGHT.
  const lineup = ["A","B"].flatMap(side =>
    game.fleets[side].units.map(unit => ({ side, unit })))
    .sort((a,b) => initiative(game,b.side,b.unit) - initiative(game,a.side,a.unit) ||
      b.unit.glory - a.unit.glory || a.unit.id.localeCompare(b.unit.id));
  const renderShip = ({side,unit}) => {
    
    return <Ship unit={unit} side={side} current={turn?.id === unit.id}
      target={targetId === unit.id && turn?.side !== side}
      queued={game.queue.slice(game.index).some(q => q.id === unit.id)}
      dice={game.fleets[side].dice.filter(d=>d.source===unit.id)} acted={!game.queue.slice(game.index).some(q=>q.id===unit.id) && game.phase!=="draft"}
      canTarget={canChooseTarget && turn?.side !== side}
      onClick={() => onTarget(unit.id)}/>;
  };
  return <section className="ftPanel ftBattlefield" aria-label="Поле боя: очередь справа налево">
    <div className="ftPanelHead">
      <div><small>БОЕВОЕ ПОЛЕ · КАК В КЛАССИЧЕСКОМ РЕЖИМЕ</small>
        <h2>Линия инициативы — справа налево</h2></div>
      <span className="ftCounter">Каждый живой корабль · каждый раунд</span>
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
            <span>⚡ {initiative(game,entry.side,entry.unit)}</span>
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
export default function FleetTestPage() {
 const [seed,setSeed]=useState("battle-01"),[mode,setMode]=useState("solo"),[defender,setDefender]=useState("B");
 const [game,setGame]=useState(()=>createGame()),[selected,setSelected]=useState([]),[target,setTarget]=useState(""),[extraTarget,setExtraTarget]=useState(""),[error,setError]=useState(""),[rules,setRules]=useState(false);
 const turn=turnOf(game),side=game.phase==="draft"?game.drafting:game.phase==="react"?game.pending.defender:turn?.side;
 const ai=game.mode==="solo"&&side==="B",fleet=side?game.fleets[side]:null;
 const enemies=turn?aliveUnits(game.fleets[other(turn.side)]):[];
 const targetId=enemies.find(u=>u.id===target)?.id||enemies[0]?.id||"";
 const extraId=fleet?.units.find(u=>u.id===extraTarget&&u.hp>0)?.id||turn?.id;
 const dice=side?availableDice(game,side):[],picked=dice.filter(d=>selected.includes(d.id));
 const totals=Object.keys(DIE_SYMBOL).map(type=>DIE_SYMBOL[type]+picked.filter(d=>d.type===type).reduce((s,d)=>s+d.value,0)).join(" · ");
 useEffect(()=>{if(window.location.hash.includes("rules"))setRules(true);},[]);
 useEffect(()=>{if(!ai||rules)return;const timer=setTimeout(()=>{setGame(g=>aiStep(g));setSelected([]);setError("");},550);return ()=>clearTimeout(timer);},[game,ai,rules]);
 function update(next){if(next===game){setError("Не хватает выбранных кубов нужного типа или карта недоступна в этот момент.");return;}setGame(next);setSelected([]);setError("");}
 function toggle(id){setSelected(v=>v.includes(id)?v.filter(d=>d!==id):[...v,id]);}
 function reset(){setGame(createGame(seed,mode,defender));setSelected([]);setTarget("");setError("");}
 function play(card,field){if(game.phase==="draft")update(chooseCards(game,[card.id],field,field?selected:[]));else update(playReaction(game,side,card.id,field,field?selected:[],extraId));}
 const cards=fleet?.hand.filter(c=>game.phase==="draft"?c.timing==="tactic":game.phase==="react"?c.timing==="defense":c.timing==="activation"&&!fleet.extraUsed)||[];
 return <main className="ftRoot">
  <header className="ftTop"><div className="ftIntro"><a className="ftBack" href="/">← Основная игра</a><div className="ftOverline">SPACE COMBAT DRAFT · ДЕМО v0.4</div><h1>Инициативный бой флотов</h1><p>Три раунда. Каждый корабль ходит сам. Одна тактика на флот в раунд.</p></div>
   <div className="ftSettings"><label>Режим<select value={mode} onChange={e=>setMode(e.target.value)}><option value="solo">Против компьютера</option><option value="hotseat">Два игрока рядом</option></select></label><label>Обороняется<select value={defender} onChange={e=>setDefender(e.target.value)}><option value="B">Гегемония</option><option value="A">Лига Ориона</option></select></label><label>Seed<input value={seed} onChange={e=>setSeed(e.target.value)}/></label><button onClick={()=>setRules(v=>!v)}>Правила</button><button className="ftPrimary" onClick={reset}>Новый бой</button></div>
  </header>
  {rules&&<section className="ftPanel" id="demo-rules"><h2>Базовые правила демо</h2><ol className="ftWhySteps">{DEMO_FLOW.map(s=><li key={s.n}><b>{s.title}</b><span>{s.what}</span></li>)}</ol><button className="ftPrimary" onClick={()=>setRules(false)}>К бою</button></section>}
  <div className="ftScore"><div><small>Раунд</small><strong>{game.round} / 3</strong></div>{["A","B"].map(s=><div key={s}><small>{name(s)}{game.defender===s?" · оборона":" · атака"}</small><strong>★ {victoryPoints(game.fleets[s])} силы</strong><span>Щиты: {game.fleets[s].shield} · Кубы: {availableDice(game,s).length}</span></div>)}<div><small>Этап</small><strong>{game.phase==="draft"?"Тактика":game.phase==="react"?"Реакция":game.phase==="done"?"Итог":"Активация"}</strong></div></div>
  <InitiativeBattlefield game={game} turn={turn} targetId={targetId} canChooseTarget={game.phase==="activate"&&!ai} onTarget={setTarget}/>
  <div className="ftColumns"><div className="ftGameplay">
   {game.phase==="done"?<section className="ftPanel ftMainPanel"><small>ТРИ РАУНДА ЗАВЕРШЕНЫ</small><h2>Победитель — {name(game.winner)}</h2><div className="ftOutcomeScores">{["A","B"].map(s=><div key={s}><b>{name(s)}</b><strong>★ {victoryPoints(game.fleets[s])}</strong><span>Выжило: {aliveUnits(game.fleets[s]).length}</span></div>)}</div><p>{game.result.kind==="defender"?"Сила равна: преимущество у обороняющегося.":"Сравнивается только сила выживших кораблей, без остатка HP."}</p><button onClick={reset}>Сыграть ещё раз</button></section>:<section className="ftPanel ftMainPanel">
    <small>{name(side)}{ai?" · КОМПЬЮТЕР":""}</small>
    <h2>{game.phase==="draft"?"Одна тактика на этот раунд":game.phase==="react"?"Защитная реакция":UNIT_TYPES[turn.role].name+(turn.extra?" · вторая активация":" · собственная активация")}</h2>
    {game.phase==="draft"&&<p>Корабли уже бросили свои кубы. Сыграй одно из двух полей одной тактики или продолжи без неё. Все живые корабли получают ход.</p>}
    {game.phase==="react"&&<p>Входящий урон: <b>{game.pending.damage}</b>. Сыграй защитную карту или прими удар. Реакция не отнимает активацию.</p>}
    {ai?<p className="ftNotice">Компьютер выбирает действие…</p>:<>
     {game.phase==="activate"&&<><label className="ftTargetPicker">Цель<select aria-label="Цель атаки" value={targetId} onChange={e=>setTarget(e.target.value)}>{enemies.map(u=><option key={u.id} value={u.id}>{UNIT_TYPES[u.role].name} · {u.hp} HP</option>)}</select></label><div className="ftDualActions">{UNIT_TYPES[turn.role].abilities.map((a,i)=><button key={a.name} disabled={!canPay(picked,a.cost)||(a.effect!=="shield"&&!targetId)} onClick={()=>update(tryAction(game,{kind:"ability",ability:i,diceIds:selected,targetId}))}><small>{i?"СИЛЬНАЯ":"ДЕШЁВАЯ"} · {costText(a.cost)}</small><strong>{a.name}</strong><span>{a.text}</span></button>)}</div></>}
     <h3>Общий резерв флота · выбери кубы для оплаты</h3><p className="ftFine">Кубы кораблей показаны на их карточках и доступны всему флоту. Обычная способность истощает кубы до конца раунда; усиленная тактика сжигает выбранные кубы навсегда.</p>
     <div className="ftDicePicker">{dice.map(d=><button key={d.id} aria-pressed={selected.includes(d.id)} onClick={()=>toggle(d.id)} className={"ftDie ft-"+d.type+(selected.includes(d.id)?" ftPicked":"")} title={d.source?UNIT_TYPES[fleet.units.find(u=>u.id===d.source).role].name:"Куб тактики на этот раунд"}>{DIE_SYMBOL[d.type]}{d.value}<small>{d.source?UNIT_TYPES[fleet.units.find(u=>u.id===d.source).role].name:"Тактика"}</small></button>)}</div><div className="ftActions"><span>Выбрано: {totals}</span><button onClick={()=>setSelected([])}>Снять выбор</button></div>
     {game.phase==="activate"&&cards.length>0&&<label className="ftTargetPicker">Вторая активация для<select aria-label="Корабль для второй активации" value={extraId} onChange={e=>setExtraTarget(e.target.value)}>{aliveUnits(fleet).map(u=><option key={u.id} value={u.id}>{UNIT_TYPES[u.role].name}</option>)}</select></label>}
     {cards.length>0&&<><h3>{game.phase==="draft"?"Тактики из руки":"Карты реакции из руки"}</h3><div className="ftTactics">{cards.map(c=><article className="ftTactic" key={c.id}><h3>{c.name}</h3><small>{c.timing==="tactic"?"Весь флот · один розыгрыш в раунд":c.timing==="defense"?"Реакция на входящий урон":"Во время своего хода · одна дополнительная активация"}</small>{c.abilities.map((a,i)=><button key={a.name} disabled={i===1&&!canPay(picked,a.cost)} onClick={()=>play(c,i)}><small>{i?"УСИЛЕННАЯ · СЖЕЧЬ "+costText(a.cost):"БАЗОВАЯ · БЕСПЛАТНО"}</small><strong>{a.name}</strong><span>{a.text}</span></button>)}</article>)}</div></>}
     <div className="ftActions">{game.phase==="draft"?<button className="ftPrimary" onClick={()=>update(chooseCards(game,[]))}>Без тактики — к активациям</button>:game.phase==="react"?<button onClick={()=>update(resolveReaction(game))}>Принять удар</button>:<button onClick={()=>update(tryAction(game,{kind:"pass"}))}>Пропустить активацию</button>}</div>
    </>}
    {error&&<p role="alert" className="ftError">{error}</p>}
   </section>}
  </div><aside className="ftSidebar"><section className="ftPanel"><h2>Очередь кораблей</h2><div className="ftQueue ftQueueRtl" dir="rtl">{game.queue.slice(game.index).filter(q=>game.fleets[q.side].units.some(u=>u.id===q.id&&u.hp>0)).map((q,i)=><span className={"ftQueueChip"+(i===0?" ftQueueNow":"")} key={q.id+"-"+i}><b>{q.initiative}</b>{UNIT_TYPES[q.role].name}<small>{q.side}{q.extra?" · повтор":""}</small></span>)}</div><p className="ftFine">Каждый корабль — один ход в раунд. Только карта реакции даёт дополнительный ход.</p></section><section className="ftPanel"><h2>Журнал боя</h2><ol className="ftLog">{game.log.map((line,i)=><li key={i}>{line}</li>)}</ol></section></aside></div>
 </main>;
}
