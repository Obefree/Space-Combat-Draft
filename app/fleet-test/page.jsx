"use client";
import { useEffect, useRef, useState } from "react";
import { CARD_TYPES, DIE_SYMBOL, UNIT_TYPES, DEMO_FLOW, createGame, newBattle, chooseCards, availableDice, costText, canPay, turnOf, other, aliveUnits, victoryPoints, initiative, tryAction, playReaction, resolveReaction, aiStep } from "./engine.mjs";
import "./fleet-test.css";
function name(side) {return side === "A" ? "Лига Ориона" : "Гегемония";}
function AbilityFields({abilities,pool,canUse=false,onUse,armed=null}) {return <div className="ftDualAbilities">{abilities.map((a,i)=>{const ready=pool!==undefined&&canPay(pool,a.cost),Tag=canUse?"button":"div";return <Tag className={"ftAbilityField"+(ready?" ftAbilityReady":"")+(canUse&&armed===i?" ftAbilityArmed":"")} key={a.name} {...(canUse?{type:"button",disabled:!ready,"aria-pressed":armed===i,onClick:()=>onUse(i)}:{})}><small>{i===0?"БАЗОВАЯ":"УСИЛЕННАЯ"} · {costText(a.cost)||"Без оплаты"}</small><strong>{a.name}</strong><span>{a.text}</span>{pool!==undefined&&<em>{canUse&&armed===i?"Выбери цель ↑":ready?canUse?"Нажми, чтобы применить":"Доступна по пулу":"Недостаточно суммы в пуле"}</em>}</Tag>;})}</div>;}
const DIE_ORDER = ["attack", "defense", "tech"];
const DIE_NAMES = {attack:"Атака",defense:"Защита",tech:"Технологии"};
function sortedDice(dice) {return [...dice].sort((a,b)=>DIE_ORDER.indexOf(a.type)-DIE_ORDER.indexOf(b.type)||b.value-a.value||a.id.localeCompare(b.id));}
function DieFace({type,value}) {return <span className="ftDieFace"><i>{DIE_SYMBOL[type]}</i><b>{value}</b></span>;}
function Ship({unit,side,current,target,queued,acted,pool,onClick,canTarget,onInspect,canUse,onUse,armed,displayInitiative}) {
 const data=UNIT_TYPES[unit.role];

 return <article onClick={canTarget&&unit.hp>0?onClick:undefined} aria-label={data.name+", инициатива "+unit.initiative} className={"ftShip ftShipTeam"+side+(unit.hp<=0?" ftDead":"")+(current?" ftCurrent":"")+(target?" ftTarget":"")+(canTarget&&armed!==null?" ftAimTarget":"")}>
  <button type="button" className="ftShipImage" onClick={e=>{e.stopPropagation();if(canTarget&&unit.hp>0)onClick();else onInspect(unit);}} aria-label={data.name+(canTarget?", выбрать целью":", открыть карточку")}><img src={data.art} alt="" loading="lazy"/><div className="ftShipStats"><span>⚡ {displayInitiative}</span><span>★ {unit.glory}</span></div><div className="ftShipPortraitTitle"><b>{data.name}</b><small>{name(side)}</small></div><div className="ftPortraitHp"><i style={{width:100*unit.hp/unit.maxHp+"%"}}/><span>{unit.hp}/{unit.maxHp} HP · 🛡{unit.shield||0}</span></div></button>
  <div className="ftShipText">
   <div className="ftShipDice" aria-label="Даёт кубы в общий пул">{DIE_ORDER.filter(type=>data.dice.includes(type)).map(type=><span className={"ftPoolContribution ft-"+type} key={type} title={DIE_NAMES[type]+": бросить в общий пул"}>{DIE_SYMBOL[type]} ×{data.dice.filter(t=>t===type).length}</span>)}</div>

   <AbilityFields abilities={data.abilities} pool={unit.hp>0?pool:[]} canUse={canUse} onUse={onUse} armed={armed}/>
  </div>
  <div className="ftShipStatus">{unit.hp<=0?"Уничтожен":current?"СЕЙЧАС ХОД":queued?"Ожидает активации":acted?"Ход завершён":"Собственная активация"}</div>
 </article>;
}
function InitiativeBattlefield({game,turn,targetId,canChooseTarget,onTarget,viewSide,onAbility,armedAbility}) {
 const scrollerRef=useRef(null);
 const [autoFit,setAutoFit]=useState(true),[manualScale,setManualScale]=useState(.65),[fitScale,setFitScale]=useState(.65),[inspected,setInspected]=useState(null);
 const dialogRef=useRef(null);
 useEffect(()=>{if(inspected&&dialogRef.current&&!dialogRef.current.open)dialogRef.current.showModal();},[inspected]);
 const lineup=["A","B"].flatMap(side=>game.fleets[side].units.map(unit=>({side,unit}))).sort((a,b)=>initiative(game,b.side,b.unit)-initiative(game,a.side,a.unit)||a.unit.id.localeCompare(b.unit.id));
 const boardWidth=lineup.length*224-10,boardHeight=836;
 useEffect(()=>{
  function measure(){if(!scrollerRef.current)return;const width=scrollerRef.current.clientWidth-4;const height=Math.max(180,window.innerHeight-300);setFitScale(Math.max(.12,Math.min(1,width/boardWidth,height/boardHeight)));}
  measure();const observer=new ResizeObserver(measure);observer.observe(scrollerRef.current);window.addEventListener("resize",measure);
  return ()=>{observer.disconnect();window.removeEventListener("resize",measure);};
 },[boardWidth]);
 const scale=autoFit?fitScale:manualScale;
 function renderShip({side,unit}) {return <Ship unit={unit} side={side} displayInitiative={initiative(game,side,unit)} current={turn?.id===unit.id} target={targetId===unit.id&&turn?.side!==side} queued={game.queue.slice(game.index).some(q=>q.id===unit.id)} pool={availableDice(game,side)} canUse={canChooseTarget&&turn?.id===unit.id} onUse={onAbility} armed={armedAbility} acted={!game.queue.slice(game.index).some(q=>q.id===unit.id)&&game.phase!=="draft"} canTarget={canChooseTarget&&turn?.side!==side} onClick={()=>onTarget(unit.id)} onInspect={setInspected}/>;}
 return <section className="ftPanel ftBattlefield" aria-label="Поле боя: очередь слева направо" data-player-side={viewSide}>
  <div className="ftPanelHead"><div><small>ПРОТИВНИК СВЕРХУ · ВАШ ФЛОТ СНИЗУ</small><h2>Линия инициативы — слева направо</h2></div><div className="ftScaleTools"><button aria-pressed={autoFit} onClick={()=>setAutoFit(true)}>Вписать в экран</button><label>Масштаб <input aria-label="Масштаб поля боя" type="range" min="12" max="125" step="1" value={Math.round(scale*100)} onChange={e=>{setAutoFit(false);setManualScale(Number(e.target.value)/100);}}/><output>{Math.round(scale*100)}%</output></label></div></div>
  {armedAbility!==null&&<div className="ftOnShipHint" role="status"><b>Выбери цель — крупные кнопки ниже или корабль на поле</b><div className="ftQuickTargets">{aliveUnits(game.fleets[other(turn.side)]).map(u=><button type="button" key={u.id} onClick={()=>onTarget(u.id)}><img src={UNIT_TYPES[u.role].art} alt=""/><span><strong>{UNIT_TYPES[u.role].name}</strong><small>{u.hp}/{u.maxHp} HP · 🛡 {u.shield||0}</small><b>Атаковать →</b></span></button>)}</div><button onClick={()=>onAbility(armedAbility)}>Отменить способность</button></div>}
  {game.pending&&<p className="ftDamageNotice" role="status">Атака по цели: ожидается защитная реакция. Урон до реакции: {game.pending.damage}.</p>}
  {game.lastHit&&<p className="ftDamageNotice" role="status">Последний удар — {game.lastHit.name}: −{game.lastHit.damage} HP. Осталось {game.lastHit.hp}/{game.lastHit.maxHp} HP.{game.lastHit.damage===0?" Защита полностью поглотила удар.":""}</p>}
  <div className="ftBattlefieldMeta"><span>↑ Противник · {name(other(viewSide))}</span><strong>Высокая инициатива слева → ход направо</strong><span>↓ Ваш флот · {name(viewSide)}</span></div>
  <div ref={scrollerRef} className="ftBattlefieldScroller" dir="ltr" role="region" tabIndex={0} aria-label="Поле боя с изменяемым масштабом">
   <div className="ftBoardStage" style={{width:boardWidth*scale,height:boardHeight*scale}}><div className="ftBattlefieldLine" style={{width:boardWidth,transform:"scale("+scale+")"}}>
    {lineup.map(entry=><div className="ftBattlefieldColumn" key={entry.unit.id}>
     <div className={"ftBattlefieldSlot ftBattlefieldTop"+(entry.side!==viewSide?" ftFilled":"")} data-side={entry.side!==viewSide?entry.side:undefined}>{entry.side!==viewSide?renderShip(entry):null}</div>
     <div className={"ftBattlefieldAxis"+(turn?.id===entry.unit.id?" ftAxisActive":"")}><span>⚡ {initiative(game,entry.side,entry.unit)}</span><strong>{turn?.id===entry.unit.id?"СЕЙЧАС ХОД":"ИНИЦИАТИВА"}</strong></div>
     <div className={"ftBattlefieldSlot ftBattlefieldBottom"+(entry.side===viewSide?" ftFilled":"")} data-side={entry.side===viewSide?entry.side:undefined}>{entry.side===viewSide?renderShip(entry):null}</div>
    </div>)}
   </div></div>
  </div>
  {inspected&&<dialog ref={dialogRef} className="ftInspectDialog" onClose={()=>setInspected(null)} aria-label={"Карточка: "+UNIT_TYPES[inspected.role].name}><form method="dialog"><button autoFocus aria-label="Закрыть карточку">Закрыть ×</button></form><img src={UNIT_TYPES[inspected.role].art} alt=""/><h2>{UNIT_TYPES[inspected.role].name}</h2><p>⚡ {inspected.initiative} · ★ {inspected.glory} · {inspected.hp}/{inspected.maxHp} HP</p><AbilityFields abilities={UNIT_TYPES[inspected.role].abilities} pool={availableDice(game,game.fleets.A.units.some(u=>u.id===inspected.id)?"A":"B")} canUse={canChooseTarget&&turn?.id===inspected.id} armed={armedAbility} onUse={field=>{dialogRef.current?.close();setInspected(null);onAbility(field);}}/></dialog>}
  {canChooseTarget&&<p className="ftBattlefieldHint">Нажми подсвеченную способность активного корабля. Для атаки затем выбери корабль противника сверху. Кубы не нужно перетаскивать или распределять.</p>}
 </section>;
}
function OpponentOverview({game,side}) {
 const fleet=game.fleets[side],pool=sortedDice(availableDice(game,side));
 return <section className="ftPanel ftOpponentOverview" aria-label="Рука, сыгранные карты и общий пул противника">
  <div className="ftPanelHead"><h2>{name(side)} · противник</h2><small>Рука скрыта · сыгранные карты открываются</small></div>
  <div className="ftOpponentDice" aria-label="Общий пул кубов противника">{DIE_ORDER.map(type=>{const group=pool.filter(d=>d.type===type);return <div className={"ftOpponentDiceType ft-"+type} key={type}><b>{DIE_NAMES[type]} · Σ {group.reduce((s,d)=>s+d.value,0)}</b><div className="ftDicePicker">{group.map(d=><span className={"ftCube ft-"+type} key={d.id}><DieFace type={type} value={d.value}/></span>)}{!group.length&&<small>Нет кубов</small>}</div></div>;})}</div>
  {game.phase==="draft"&&<p className="ftSecretChoice">{!game.tacticChoices[side]?"Противник ещё выбирает тактику взакрытую.":game.tacticChoices[side].cardId?"Противник выбрал карту взакрытую. Раскрытие после обоих выборов.":"Противник подтвердил пропуск взакрытую. Раскрытие после обоих выборов."}</p>}
  <h3>Текущая рука противника · {fleet.hand.length} скрытых карт</h3><div className="ftOpponentHand" aria-label={"Скрытая рука: "+fleet.hand.length+" карт"}>{Array.from({length:fleet.hand.length},(_,i)=><div className="ftCardBack" aria-label="Закрытая карта противника" key={i}><span aria-hidden="true">✦</span><b>Карта скрыта</b></div>)}{!fleet.hand.length&&<p>Карт в руке нет.</p>}</div>
  <h3>Сыгранные карты противника · {fleet.played.length}</h3><div className="ftPlayedRow">{fleet.played.map((c,i)=>{const a=CARD_TYPES.find(t=>t.name===c.name)?.abilities[c.field];return <article key={i}><small>Раунд {c.round} · {c.field?"Усиленная":"Базовая"}</small><b>{c.name} — {a?.name}</b><span>{a?.text}</span></article>;})}{!fleet.played.length&&<p>Пока ничего не сыграно.</p>}</div>
 </section>;
}
export default function FleetTestPage() {
 const [seed,setSeed]=useState("battle-01"),[mode,setMode]=useState("solo"),[defender,setDefender]=useState("B");
 const [game,setGame]=useState(()=>createGame()),[selected,setSelected]=useState([]),[target,setTarget]=useState(""),[extraTarget,setExtraTarget]=useState(""),[error,setError]=useState(""),[rules,setRules]=useState(false),[armedAbility,setArmedAbility]=useState(null),[utility,setUtility]=useState(null),[tuneDie,setTuneDie]=useState(""),[tuneType,setTuneType]=useState("attack"),[shieldAlly,setShieldAlly]=useState("");
 const turn=turnOf(game),side=game.phase==="draft"?game.drafting:game.phase==="react"?game.pending.defender:turn?.side;
 const ai=game.mode==="solo"&&side==="B",fleet=side?game.fleets[side]:null;
 const enemies=turn?aliveUnits(game.fleets[other(turn.side)]):[];
 const targetId=enemies.find(u=>u.id===target)?.id||enemies[0]?.id||"";
 const extraId=fleet?.units.find(u=>u.id===extraTarget&&u.hp>0)?.id||turn?.id;
 const dice=side?sortedDice(availableDice(game,side)):[],picked=dice.filter(d=>selected.includes(d.id));
 const viewSide=game.mode==="solo"?"A":side||"A";
 const totals=Object.keys(DIE_SYMBOL).map(type=>DIE_SYMBOL[type]+picked.filter(d=>d.type===type).reduce((s,d)=>s+d.value,0)).join(" · ");
 useEffect(()=>{if(window.location.hash.includes("rules"))setRules(true);},[]);
 useEffect(()=>{if(!ai||rules)return;const timer=setTimeout(()=>{setGame(g=>aiStep(g));setSelected([]);setError("");},550);return ()=>clearTimeout(timer);},[game,ai,rules]);
 function update(next){if(next===game){setError("Не хватает выбранных кубов нужного типа или карта недоступна в этот момент.");return;}setGame(next);setSelected([]);setUtility(null);setArmedAbility(null);setError("");}
 function toggle(id){setSelected(v=>v.includes(id)?v.filter(d=>d!==id):[...v,id]);}
 function reset(repeat=false){const next=repeat?createGame(seed,mode,defender,game.scenario):newBattle(mode,defender);setSeed(next.seed);setGame(next);setUtility(null);setArmedAbility(null);setSelected([]);setTarget("");setExtraTarget("");setError("");}
 function activateOnShip(field){if(!turn||ai)return;const ability=UNIT_TYPES[turn.role].abilities[field];if(!canPay(dice,ability.cost))return;if(["shield","tune"].includes(ability.effect)){setArmedAbility(null);setUtility(field);setTuneDie(dice[0]?.id||"");setShieldAlly(turn.id);}else{setUtility(null);setArmedAbility(v=>v===field?null:field);setError("");}}
 function selectShipTarget(id){setTarget(id);if(armedAbility!==null)update(tryAction(game,{kind:"ability",ability:armedAbility,targetId:id}));}
 function play(card,field){if(game.phase==="draft")update(chooseCards(game,[card.id],field,field?selected:[]));else update(playReaction(game,side,card.id,field,field?selected:[],extraId));}
 const cards=fleet?.hand.filter(c=>game.phase==="draft"?c.timing==="tactic":game.phase==="react"?c.timing==="defense":c.timing==="activation"&&!fleet.extraUsed)||[];
 return <main className="ftRoot">
  <header className="ftTop"><div className="ftIntro"><a className="ftBack" href="/">← Основная игра</a><div className="ftOverline">SPACE COMBAT DRAFT · ДЕМО v0.4</div><h1>Инициативный бой флотов</h1><p>Три раунда. Каждый корабль ходит сам. Одна тактика на флот в раунд.</p></div>
   <div className="ftSettings"><label>Режим<select value={mode} onChange={e=>setMode(e.target.value)}><option value="solo">Против компьютера</option><option value="hotseat">Два игрока рядом</option></select></label><label>Обороняется<select value={defender} onChange={e=>setDefender(e.target.value)}><option value="B">Гегемония</option><option value="A">Лига Ориона</option></select></label><label>Seed<input value={seed} onChange={e=>setSeed(e.target.value)}/></label><button onClick={()=>setRules(v=>!v)}>Правила</button><button onClick={()=>reset(true)}>Повторить seed</button><button className="ftPrimary" onClick={()=>reset()}>Новый бой</button></div>
  </header>
  {rules&&<section className="ftPanel" id="demo-rules"><h2>Базовые правила демо</h2><ol className="ftWhySteps">{DEMO_FLOW.map(s=><li key={s.n}><b>{s.title}</b><span>{s.what}</span></li>)}</ol><button className="ftPrimary" onClick={()=>setRules(false)}>К бою</button></section>}
  <div className="ftScore"><div><small>Раунд</small><strong>{game.round} / 3</strong></div>{["A","B"].map(s=><div key={s}><small>{name(s)}{game.defender===s?" · оборона":" · атака"}</small><strong>★ {victoryPoints(game.fleets[s])} силы</strong><span>Щиты: {game.fleets[s].shield} · Кубы: {availableDice(game,s).length}</span></div>)}<div><small>Этап</small><strong>{game.phase==="draft"?"Тактика":game.phase==="react"?"Реакция":game.phase==="done"?"Итог":"Активация"}</strong></div></div>
  <OpponentOverview game={game} side={other(viewSide)}/>
  {utility!==null&&turn&&!ai&&<section className="ftPanel ftUtilityPanel" role="region" aria-label="Настройка способности"><h2>{UNIT_TYPES[turn.role].abilities[utility].name}</h2>{UNIT_TYPES[turn.role].abilities[utility].effect==="tune"?<><label>Куб общего пула<select value={tuneDie} onChange={e=>setTuneDie(e.target.value)}>{dice.map(d=><option key={d.id} value={d.id}>{DIE_SYMBOL[d.type]}{d.value}</option>)}</select></label><label>Новый тип (значение станет 3)<select value={tuneType} onChange={e=>setTuneType(e.target.value)}>{DIE_ORDER.map(type=><option key={type} value={type}>{DIE_NAMES[type]}</option>)}</select></label></>:<label>Кому дать личный щит<select value={shieldAlly} onChange={e=>setShieldAlly(e.target.value)}>{aliveUnits(fleet).map(u=><option key={u.id} value={u.id}>{UNIT_TYPES[u.role].name} · 🛡{u.shield||0}</option>)}</select></label>}<button className="ftPrimary" onClick={()=>update(tryAction(game,{kind:"ability",ability:utility,dieId:tuneDie,dieType:tuneType,allyId:shieldAlly}))}>Применить эффект</button><button onClick={()=>setUtility(null)}>Отмена</button></section>}
  <InitiativeBattlefield game={game} turn={turn} targetId={targetId} canChooseTarget={game.phase==="activate"&&!ai} onTarget={selectShipTarget} viewSide={viewSide} onAbility={activateOnShip} armedAbility={armedAbility}/>
  <div className="ftColumns"><div className="ftGameplay">
   {game.phase==="done"?<section className="ftPanel ftMainPanel"><small>ТРИ РАУНДА ЗАВЕРШЕНЫ</small><h2>Победитель — {name(game.winner)}</h2><div className="ftOutcomeScores">{["A","B"].map(s=><div key={s}><b>{name(s)}</b><strong>★ {victoryPoints(game.fleets[s])}</strong><span>Выжило: {aliveUnits(game.fleets[s]).length}</span></div>)}</div><p>{game.result.kind==="defender"?"Сила равна: преимущество у обороняющегося.":"Сравнивается только сила выживших кораблей, без остатка HP."}</p><button onClick={()=>reset()}>Сыграть ещё раз</button></section>:<section className="ftPanel ftMainPanel">
    <small>{name(side)}{ai?" · КОМПЬЮТЕР":""}</small>
    <h2>{game.phase==="draft"?"Одна тактика на этот раунд":game.phase==="react"?"Защитная реакция":UNIT_TYPES[turn.role].name+(turn.extra?" · вторая активация":" · собственная активация")}</h2>
    {game.phase==="draft"&&<p>Выбери одну тактику взакрытую или пропусти. Обе карты раскроются и применятся только после выбора второго игрока. Все живые корабли получают ход.</p>}
    {game.phase==="react"&&<p>Входящий урон: <b>{game.pending.damage}</b>. Сыграй защитную карту или прими удар. Реакция не отнимает активацию.</p>}
    {ai?<p className="ftNotice">Компьютер выбирает действие…</p>:<>
     {game.phase==="activate"&&<div className="ftOnShipHint" role="status"><b>{armedAbility!==null?"Выбери цель на верхнем ряду": "Способности — прямо на активном корабле"}</b><span>{armedAbility!==null?UNIT_TYPES[turn.role].abilities[armedAbility].name+": нажми корабль противника для применения.":"Зелёным выделены способности, для которых хватает суммы общего пула. Нажми нужную способность на карточке корабля."}</span>{armedAbility!==null&&<><label className="ftTargetPicker">Цель<select aria-label="Цель урона" value={targetId} onChange={e=>setTarget(e.target.value)}>{enemies.map(u=><option key={u.id} value={u.id}>{UNIT_TYPES[u.role].name} · {u.hp} HP</option>)}</select></label><button className="ftPrimary" disabled={!targetId} onClick={()=>selectShipTarget(targetId)}>Атаковать выбранную цель</button><button onClick={()=>setArmedAbility(null)}>Отменить выбор способности</button></>}</div>}
     <h3>Общий пул флота</h3><p className="ftFine">Значки на кораблях задают бросок в этот общий пул. Способности доступны по суммам типов во всём пуле, без выбора и траты кубов. Выделяй кубы только для карты с явной ценой «сжечь».</p>
     <div className="ftDiceGroups">{DIE_ORDER.map(type=>{const group=dice.filter(d=>d.type===type);return <section className={"ftDiceGroup ft-"+type} key={type} aria-label={DIE_NAMES[type]+": кубы по убыванию"}><div className="ftDiceGroupHead"><strong>{DIE_SYMBOL[type]} {DIE_NAMES[type]}</strong><small>{group.length} куб. · Σ {group.reduce((n,d)=>n+d.value,0)}</small></div><div className="ftDicePicker">{group.length?group.map(d=><button key={d.id} aria-label={DIE_NAMES[type]+" "+d.value} aria-pressed={selected.includes(d.id)} onClick={()=>toggle(d.id)} className={"ftCube ft-"+d.type+(selected.includes(d.id)?" ftPicked":"")} title={d.source?UNIT_TYPES[fleet.units.find(u=>u.id===d.source).role].name:"Куб тактики на этот раунд"}><DieFace type={d.type} value={d.value}/></button>):<span className="ftEmptyDice">Нет кубов</span>}</div></section>;})}</div><div className="ftActions"><span>Для сжигания выбрано: {totals}</span><button onClick={()=>setSelected([])}>Снять выбор</button></div>
     {game.phase==="activate"&&cards.length>0&&<label className="ftTargetPicker">Вторая активация для<select aria-label="Корабль для второй активации" value={extraId} onChange={e=>setExtraTarget(e.target.value)}>{aliveUnits(fleet).map(u=><option key={u.id} value={u.id}>{UNIT_TYPES[u.role].name}</option>)}</select></label>}
     {cards.length>0&&<><h3>{game.phase==="draft"?"Тактики из руки":"Карты реакции из руки"}</h3><div className="ftTactics">{cards.map(c=><article className="ftTactic" key={c.id}><h3>{c.name}</h3><small>{c.timing==="tactic"?"Весь флот · один розыгрыш в раунд":c.timing==="defense"?"Реакция на входящий урон":"Во время своего хода · одна дополнительная активация"}</small>{c.abilities.map((a,i)=><button key={a.name} disabled={i===1&&!canPay(picked,a.cost)} onClick={()=>play(c,i)}><small>{i?"УСИЛЕННАЯ · СЖЕЧЬ "+costText(a.cost):"БАЗОВАЯ · БЕСПЛАТНО"}</small><strong>{a.name}</strong><span>{a.text}</span></button>)}</article>)}</div></>}
     <div className="ftActions">{game.phase==="draft"?<button className="ftPrimary" onClick={()=>update(chooseCards(game,[]))}>Подтвердить пропуск взакрытую</button>:game.phase==="react"?<button onClick={()=>update(resolveReaction(game))}>Принять удар</button>:<button onClick={()=>update(tryAction(game,{kind:"pass"}))}>Пропустить активацию</button>}</div>
    </>}
    {error&&<p role="alert" className="ftError">{error}</p>}
   </section>}
  </div><aside className="ftSidebar"><section className="ftPanel"><h2>Очередь кораблей</h2><div className="ftQueue" dir="ltr">{game.queue.slice(game.index).filter(q=>game.fleets[q.side].units.some(u=>u.id===q.id&&u.hp>0)).map((q,i)=><span className={"ftQueueChip"+(i===0?" ftQueueNow":"")} key={q.id+"-"+i}><b>{q.initiative}</b>{UNIT_TYPES[q.role].name}<small>{q.side}{q.extra?" · повтор":""}</small></span>)}</div><p className="ftFine">Каждый корабль — один ход в раунд. Только карта реакции даёт дополнительный ход.</p></section><section className="ftPanel"><h2>Журнал боя</h2><ol className="ftLog">{game.log.map((line,i)=><li key={i}>{line}</li>)}</ol></section></aside></div>
 </main>;
}
