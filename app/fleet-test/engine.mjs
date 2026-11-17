// Space Combat Draft /fleet-test. User rules, 17 November 2026.
// Same scene, art, seeded dice and initiative axis; tactics never grant ordinary turns.
export const DIE_SYMBOL = { attack: "⚔", defense: "🛡", tech: "✦" };
const ability = (name, cost, text, effect, amount) => ({name, cost, text, effect, amount});
export function costText(cost) { return Object.entries(cost).map(([type,n]) => DIE_SYMBOL[type]+n+"+").join(" и "); }
export const UNIT_TYPES = {
 scout: {name:"Разведчик",initiative:8,glory:6,hp:4,dice:["tech","tech"],art:"/card-art/space/generated/swift_blade.png",abilities:[ability("Точный импульс",{tech:3},"2 урона", "hit",2),ability("Перенастройка",{tech:8},"Выбрать куб общего пула: сменить тип и установить значение 3", "tune",3)]},
 destroyer: {name:"Эсминец",initiative:5,glory:4,hp:6,dice:["attack","tech"],art:"/card-art/space/generated/huntress.png",abilities:[ability("Торпеда",{attack:3},"2 урона","hit",2),ability("Торпедный залп",{attack:8},"6 урона","hit",6)]},
 cruiser: {name:"Крейсер",initiative:3,glory:1,hp:8,dice:["attack","defense"],art:"/card-art/space/generated/mercenary_captain.png",abilities:[ability("Прикрывающий огонь",{attack:3},"1 урон и 2 личных щита кораблю","cover",1),ability("Тяжёлая батарея",{attack:8},"7 урона","hit",7)]},
 interceptor: {name:"Перехватчик",initiative:7,glory:5,hp:4,dice:["attack","defense"],art:"/card-art/space/generated/raider.png",abilities:[ability("Ракетный заход",{attack:3},"2 урона","hit",2),ability("Подавление",{attack:8},"3 урона; ещё не ходившая цель переносится в конец очереди раунда","delay",3)]},
 frigate: {name:"Фрегат",initiative:4,glory:4,hp:6,dice:["defense","tech"],art:"/card-art/space/generated/bodyguard.png",abilities:[ability("Защитный огонь",{defense:3},"1 урон и 2 личных щита кораблю","cover",1),ability("Защитный купол",{defense:8},"Выбранному своему кораблю 4 личных щита","shield",4)]},
 dreadnought: {name:"Дредноут",initiative:2,glory:2,hp:8,dice:["attack","defense"],art:"/card-art/space/generated/old_veteran.png",abilities:[ability("Тяжёлый выстрел",{attack:3},"3 урона","hit",3),ability("Осадный протокол",{attack:5,defense:5},"4 урона и 3 личных щита; отдельно ⚔5 и 🛡5","fortified",4)]},
};
export const CARD_TYPES = [
 {id:"assault",name:"Боевой натиск",timing:"tactic",abilities:[ability("Огневая поддержка",{},"Добавить 2 ⚔ всему флоту на этот раунд","attack",2),ability("Предельный натиск",{tech:3},"Сжечь выбранные ✦ навсегда; добавить 4 ⚔ на раунд","attack",4)]},
 {id:"reinforce",name:"Подкрепление",timing:"tactic",abilities:[ability("Резерв снабжения",{},"Добавить 1 ⚔ и 1 🛡 на раунд","mixed",2),ability("Экстренное снабжение",{tech:3},"Сжечь ✦ навсегда; добавить 2 ⚔ и 2 🛡","mixed",4)]},
 {id:"initiative",name:"Ускорение флота",timing:"tactic",abilities:[ability("Форсаж",{},"Всем живым кораблям +2 инициативы на раунд","initiative",2),ability("Перегрузка двигателей",{defense:3},"Сжечь 🛡 навсегда; всем +4 инициативы и добавить 2 ⚔","initiative",4)]},
 {id:"guard",name:"Защитная реакция",timing:"defense",abilities:[ability("Прикрытие",{},"Во время удара: поглотить 2 урона","block",2),ability("Аварийная завеса",{defense:3},"Сжечь 🛡 навсегда; поглотить 5 урона","block",5)]},
 {id:"again",name:"Вторая активация",timing:"activation",abilities:[ability("Перехват управления",{},"После текущего хода ещё раз активировать выбранный свой корабль","again",1),ability("Полная готовность",{tech:3},"Сжечь ✦ навсегда; вторая активация и 2 щита флоту","again",2)]},
];
// Extra demo tactics use the same fleet-wide effect rules and two alternative fields.
CARD_TYPES.push(
 {id:"screen",name:"Оборонительный строй",timing:"tactic",abilities:[ability("Защитный резерв",{},"Добавить 2 🛡 в общий пул на раунд","defense",2),ability("Глубокая оборона",{tech:3},"Сжечь ✦ навсегда; добавить 4 🛡 на раунд","defense",4)]},
 {id:"sensors",name:"Сенсорная сеть",timing:"tactic",abilities:[ability("Сканирование",{},"Добавить 2 ✦ в общий пул на раунд","tech",2),ability("Широкая сеть",{defense:3},"Сжечь 🛡 навсегда; добавить 4 ✦ на раунд","tech",4)]},
 {id:"crossfire",name:"Перекрёстный огонь",timing:"tactic",abilities:[ability("Поддержка батарей",{},"Добавить 1 ⚔ и 1 🛡 на раунд","mixed",2),ability("Усиленные батареи",{tech:3},"Сжечь ✦ навсегда; добавить 4 ⚔ на раунд","attack",4)]}
);
function shuffled(g,values){const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random(g)*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function newBattle(mode="solo",defender="B"){return createGame(globalThis.crypto.randomUUID(),mode,defender,"random");}
export const DEMO_FLOW = [
 {n:1,title:"Значки задают общий бросок",what:"В начале каждого раунда значки живых кораблей определяют бросок в общий пул игрока. Значения 1–3, как в основной игре."},
 {n:2,title:"Одна тактика на раунд",what:"Каждый флот выбирает одну тактику взакрытую или пропускает. Обе карты раскрываются и применяются после обоих выборов. Эффект действует на весь флот. Тактики не являются модулями и не назначаются кораблям."},
 {n:3,title:"Каждый корабль ходит сам",what:"Все живые корабли активируются по инициативе слева направо, даже без тактик. При равной инициативе первым ходит обороняющийся."},
 {n:4,title:"Две способности",what:"В свой ход выбери дешёвую способность (обычно сумма 3+ одного типа), сильную (8+ или отдельные суммы типов) либо пропусти. Одна способность завершает активацию."},
 {n:5,title:"Реакции и постоянная цена",what:"Защитная реакция и вторая активация играются в ходе раунда. Усиленное поле тактики может сжечь кубы навсегда. Обычная способность проверяет суммы общего пула и не расходует кубы."},
 {n:6,title:"Ровно три раунда",what:"После третьего раунда сравнивается сумма ★ силы выживших. При равенстве побеждает обороняющийся. Модули развития поля в этом демо не участвуют."},
];
const ORDER = {A:["scout","destroyer","cruiser"],B:["interceptor","frigate","dreadnought"]};
function hash(text) { let v=2166136261; for (const c of text) {v^=c.charCodeAt(0);v=Math.imul(v,16777619);} return v>>>0||1; }
function random(g) {g.rng=(g.rng+0x6d2b79f5)>>>0;let t=g.rng;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
function face(g) { return 1+Math.floor(random(g)*3); }
const clone=g=>structuredClone(g);
export const other=side=>side==="A"?"B":"A";
export const aliveUnits=f=>f.units.filter(u=>u.hp>0);
export const victoryPoints=f=>aliveUnits(f).reduce((s,u)=>s+u.glory,0);
export const turnOf=g=>g.phase==="activate"?g.queue[g.index]||null:null;
function msg(g,text) {g.log.unshift(text);g.log=g.log.slice(0,60);}
export function initiative(g,side,u) {return u.initiative+(u.roundInitiative||0)+g.fleets[side].initiativeBonus;}
function reroll(g) {
 for(const side of ["A","B"]) {
  const f=g.fleets[side];for(const u of f.units){u.shield=0;u.roundInitiative=0;} f.shield=0;f.initiativeBonus=0;f.extraUsed=false;
  // Ship dice have stable identities, so a burned die cannot reappear next round.
  f.dice=aliveUnits(f).flatMap(u=>UNIT_TYPES[u.role].dice.map((type,i)=>({id:u.id+"-d"+i,type,source:u.id,value:0,spent:false})))
   .filter(d=>!f.burned.includes(d.id)).map(d=>({...d,value:face(g)}));
 }
}
export function createGame(seed="battle-01",mode="solo",defender="B",scenario="fixed") {
 const g={seed,mode,scenario,tacticChoices:{},defender:defender==="A"?"A":"B",rng:hash(seed),round:1,phase:"draft",drafting:"A",queue:[],index:0,pending:null,winner:null,result:null,nextDie:0,log:[],fleets:{}};
 for(const side of ["A","B"]) {
  const combinations=[];const types=Object.keys(UNIT_TYPES);
  for(let a=0;a<types.length;a++)for(let b=a+1;b<types.length;b++)for(let c=b+1;c<types.length;c++){const roles=[types[a],types[b],types[c]];if(roles.reduce((n,r)=>n+UNIT_TYPES[r].glory,0)===11&&roles.reduce((n,r)=>n+UNIT_TYPES[r].hp,0)===18)combinations.push(roles);}
  const options=side==="B"?combinations.filter(roles=>roles.join()!==g.fleets.A.units.map(u=>u.role).join()):combinations;
  const roles=scenario==="random"?shuffled(g,options)[0]:ORDER[side];
  const tactics=scenario==="random"?shuffled(g,CARD_TYPES.filter(c=>c.timing==="tactic")).slice(0,5):CARD_TYPES.filter(c=>c.timing==="tactic").slice(0,5);
  const cards=[...tactics,...CARD_TYPES.filter(c=>c.timing!=="tactic")];
  g.fleets[side]={name:side==="A"?"Лига Ориона":"Гегемония",units:roles.map(role=>({id:side+"-"+role,role,hp:UNIT_TYPES[role].hp,maxHp:UNIT_TYPES[role].hp,initiative:UNIT_TYPES[role].initiative,glory:UNIT_TYPES[role].glory,shield:0})),dice:[],burned:[],shield:0,initiativeBonus:0,extraUsed:false,hand:cards.map(c=>({...structuredClone(c),id:side+"-"+c.id,type:c.id})),played:[]};
 }
 reroll(g);msg(g,"Раунд 1: корабли бросили свои кубы. Каждый флот может сыграть одну тактику.");return g;
}
export function availableDice(g,side) {return g.fleets[side].dice.filter(d=>!d.spent);}
export function canPay(dice,cost) {return Object.entries(cost).every(([type,n])=>dice.filter(d=>d.type===type).reduce((s,d)=>s+d.value,0)>=n);}
function payment(g,side,ids,cost) {
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length)return null;
 const available=availableDice(g,side);const selected=ids.map(id=>available.find(d=>d.id===id));
 if(selected.some(d=>!d)||!canPay(selected,cost))return null;
 // Reject accidental selection of other colours and free-effect burning.
 if(selected.some(d=>!Object.hasOwn(cost,d.type)))return null;
 return selected;
}
function spend(g,side,dice,burn=false) {for(const d of dice){const live=g.fleets[side].dice.find(x=>x.id===d.id);live.spent=true;if(burn&&!g.fleets[side].burned.includes(d.id))g.fleets[side].burned.push(d.id);}}
function bonusDice(g,side,type,n) {for(let i=0;i<n;i++)g.fleets[side].dice.push({id:"bonus-"+(++g.nextDie),type,value:face(g),spent:false,source:null});}
function useCard(g,side,card,field,ids) {
 const effect=card.abilities[field];if(!effect)return null;
 const dice=payment(g,side,ids,effect.cost);if(!dice)return null;
 spend(g,side,dice,true);g.fleets[side].hand=g.fleets[side].hand.filter(c=>c.id!==card.id);
 g.fleets[side].played.push({name:card.name,field,round:g.round});
 msg(g,g.fleets[side].name+": «"+card.name+" / "+effect.name+"»"+(dice.length?"; кубы сожжены навсегда":"")+".");return effect;
}
function queueShips(g) {
 g.queue=["A","B"].flatMap(side=>aliveUnits(g.fleets[side]).map(u=>({side,id:u.id,role:u.role,initiative:initiative(g,side,u),extra:false})));
 g.queue.sort((a,b)=>b.initiative-a.initiative||(a.side===b.side?a.id.localeCompare(b.id):a.side===g.defender?-1:1));g.index=0;g.phase="activate";
 msg(g,"Раунд "+g.round+": каждый живой корабль получает собственную активацию.");advance(g);
}
export function chooseCards(state,ids=[],field=0,diceIds=[]) {
 if(state.phase!=="draft"||!Array.isArray(ids)||ids.length>1||![0,1].includes(field))return state;
 const side=state.drafting,card=ids.length?state.fleets[side].hand.find(c=>c.id===ids[0]&&c.timing==="tactic"):null;
 if(ids.length&&(!card||!payment(state,side,diceIds,card.abilities[field].cost)))return state;
 const g=clone(state);g.tacticChoices[side]={cardId:card?.id||null,field,diceIds:[...diceIds]};
 if(side==="A"){g.drafting="B";return g;}
 // Both choices are locked before either side's hand, pool or log reveals a tactic.
 for(const player of ["A","B"]){
  const choice=g.tacticChoices[player];
  if(!choice.cardId){msg(g,g.fleets[player].name+": раскрывает пропуск тактики.");continue;}
  const played=g.fleets[player].hand.find(c=>c.id===choice.cardId);
  const effect=useCard(g,player,played,choice.field,choice.diceIds);
  if(!effect)return state;
  if(["attack","defense","tech"].includes(effect.effect))bonusDice(g,player,effect.effect,effect.amount);
  if(effect.effect==="mixed"){bonusDice(g,player,"attack",effect.amount/2);bonusDice(g,player,"defense",effect.amount/2);}
  if(effect.effect==="initiative"){g.fleets[player].initiativeBonus=effect.amount;if(choice.field===1)bonusDice(g,player,"attack",2);}
 }
 g.tacticChoices={};queueShips(g);return g;
}

function finish(g) {
 const a=vote(g,"A"),b=vote(g,"B");g.winner=a===b?g.defender:a>b?"A":"B";g.phase="done";g.pending=null;
 g.result={scoreA:a,scoreB:b,kind:a===b?"defender":"points",round:3};
 msg(g,"Три раунда завершены. Сила выживших "+a+":"+b+". Победитель: "+g.fleets[g.winner].name+(a===b?" (преимущество обороняющегося)":"")+".");
}
const vote=(g,side)=>victoryPoints(g.fleets[side]);
function advance(g) {
 while(g.index<g.queue.length) {const t=g.queue[g.index];if(g.fleets[t.side].units.some(u=>u.id===t.id&&u.hp>0)){g.phase="activate";return;}g.index++;}
 if(g.round>=3){finish(g);return;}
 g.round++;g.tacticChoices={};g.phase="draft";g.drafting="A";g.queue=[];g.index=0;reroll(g);
 msg(g,"Раунд "+g.round+": живые корабли заново бросили свои кубы. Сожжённые кубы не возвращаются.");
}
function next(g) {g.index++;advance(g);}
function damage(g,p) {const u=g.fleets[p.defender].units.find(u=>u.id===p.target&&u.hp>0);if(u){const n=Math.min(u.hp,p.damage);u.hp-=n;g.lastHit={name:UNIT_TYPES[u.role].name,damage:n,hp:u.hp,maxHp:u.maxHp};msg(g,UNIT_TYPES[u.role].name+": −"+n+" HP"+(u.hp<=0?", уничтожен":"")+".");}}
function attack(g,side,target,amount) {
 g.lastHit=null;const defender=other(side),f=g.fleets[defender],unit=f.units.find(u=>u.id===target);const personal=Math.min(unit.shield||0,amount);unit.shield=(unit.shield||0)-personal;const fleetBlock=Math.min(f.shield,amount-personal);f.shield-=fleetBlock;const blocked=personal+fleetBlock;
 const hit={attacker:side,defender,target,damage:amount-blocked};
 msg(g,"Атака: "+amount+" урона; личный щит поглотил "+personal+", щит флота "+fleetBlock+".");
 const reaction=f.hand.some(c=>c.timing==="defense");
 if(hit.damage>0&&reaction){msg(g,"Ожидается защитная реакция противника: "+hit.damage+" урона до реакции.");g.pending=hit;g.phase="react";}else{damage(g,hit);next(g);}
}
export function tryAction(state,action) {
 const turn=turnOf(state);if(!turn||!action)return state;
 if(action.kind==="pass"){const g=clone(state);msg(g,UNIT_TYPES[turn.role].name+" пропускает ход.");next(g);return g;}
 if(action.kind!=="ability"||![0,1].includes(action.ability))return state;
 const field=action.ability;
 const spec=UNIT_TYPES[turn.role].abilities[field];if(!canPay(availableDice(state,turn.side),spec.cost))return state;
 if((["hit","cover","delay","fortified"].includes(spec.effect))&&!aliveUnits(state.fleets[other(turn.side)]).some(u=>u.id===action.targetId))return state;
 const g=clone(state);msg(g,UNIT_TYPES[turn.role].name+": "+spec.name+" ("+costText(spec.cost)+").");
 const actor=g.fleets[turn.side].units.find(u=>u.id===turn.id);
 if(spec.effect==="tune"){
  const die=g.fleets[turn.side].dice.find(d=>d.id===action.dieId&&!d.spent);if(!die||!Object.hasOwn(DIE_SYMBOL,action.dieType))return state;
  die.type=action.dieType;die.value=3;msg(g,"Перенастройка общего пула: "+DIE_SYMBOL[die.type]+"3.");next(g);
 }else if(spec.effect==="shield"){
  const ally=aliveUnits(g.fleets[turn.side]).find(u=>u.id===(action.allyId||turn.id));if(!ally)return state;
  ally.shield=Math.min(7,(ally.shield||0)+spec.amount);msg(g,UNIT_TYPES[ally.role].name+": личные щиты "+ally.shield+".");next(g);
 }else {
  if(spec.effect==="cover")actor.shield=Math.min(7,(actor.shield||0)+2);
  if(spec.effect==="fortified")actor.shield=Math.min(7,(actor.shield||0)+3);
  if(spec.effect==="delay"){
   const idx=g.queue.findIndex((q,i)=>i>g.index&&q.id===action.targetId);if(idx>=0){const [delayed]=g.queue.splice(idx,1);const unit=g.fleets[other(turn.side)].units.find(u=>u.id===action.targetId);const lastInitiative=Math.min(delayed.initiative,...g.queue.slice(g.index+1).map(q=>q.initiative))-1;unit.roundInitiative=lastInitiative-unit.initiative-g.fleets[other(turn.side)].initiativeBonus;delayed.initiative=lastInitiative;g.queue.push(delayed);msg(g,"Подавление: цель перенесена в конец очереди раунда.");}
  }
  attack(g,turn.side,action.targetId,spec.amount);
 }
 return g;
}
export function playReaction(state,side,cardId,field=0,diceIds=[],targetId=null) {
 if(![0,1].includes(field)||!["A","B"].includes(side))return state;
 const card=state.fleets[side].hand.find(c=>c.id===cardId);if(!card)return state;
 if(card.timing==="defense") {
  if(state.phase!=="react"||state.pending?.defender!==side)return state;
  const g=clone(state),effect=useCard(g,side,card,field,diceIds);if(!effect)return state;
  const blocked=Math.min(g.pending.damage,effect.amount);g.pending.damage=Math.max(0,g.pending.damage-effect.amount);msg(g,"Защитная реакция поглотила "+blocked+" урона.");damage(g,g.pending);g.pending=null;next(g);return g;
 }
 if(card.timing==="activation") {
  if(state.phase!=="activate"||turnOf(state)?.side!==side||state.fleets[side].extraUsed)return state;
  const u=aliveUnits(state.fleets[side]).find(u=>u.id===targetId);if(!u)return state;
  const g=clone(state),effect=useCard(g,side,card,field,diceIds);if(!effect)return state;
  g.fleets[side].extraUsed=true;if(field===1)g.fleets[side].shield+=2;
  g.queue.splice(g.index+1,0,{side,id:u.id,role:u.role,initiative:initiative(g,side,u),extra:true});return g;
 }
 return state;
}
export function resolveReaction(state) {if(state.phase!=="react")return state;const g=clone(state);damage(g,g.pending);g.pending=null;next(g);return g;}
export function findPayment(dice,cost) {
 const selected=[];for(const [type,min] of Object.entries(cost)){let total=0;for(const d of dice.filter(d=>d.type===type).sort((a,b)=>b.value-a.value)){selected.push(d);total+=d.value;if(total>=min)break;}if(total<min)return null;}return selected;
}
export function aiDraftChoice(g,side=g.drafting) {
 // Evaluate only public board and the AI's own hand/pool, never the opponent's sealed choice.
 const fleet=g.fleets[side],dice=availableDice(g,side);
 const totals=Object.fromEntries(Object.keys(DIE_SYMBOL).map(type=>[type,dice.filter(d=>d.type===type).reduce((n,d)=>n+d.value,0)]));
 function score(card){const effect=card.abilities[0],estimated={...totals};
  if(["attack","defense","tech"].includes(effect.effect))estimated[effect.effect]+=effect.amount*2;
  if(effect.effect==="mixed"){estimated.attack+=effect.amount;estimated.defense+=effect.amount;}
  const readiness=aliveUnits(fleet).reduce((n,u)=>n+UNIT_TYPES[u.role].abilities.reduce((s,a,i)=>s+(Object.entries(a.cost).every(([type,value])=>estimated[type]>=value)?(i?4:2):0),0),0);
  return readiness+(effect.effect==="initiative"?1.5:effect.effect==="attack"?1:0);
 }
 return [...fleet.hand].filter(c=>c.timing==="tactic").sort((a,b)=>score(b)-score(a)).slice(0,1).map(c=>c.id);
}
export function aiActionChoice(g) {
 const t=turnOf(g);if(!t)return null;const enemies=aliveUnits(g.fleets[other(t.side)]).sort((a,b)=>a.hp-b.hp||b.glory-a.glory);if(!enemies.length)return {kind:"pass"};
 for(const field of [1,0]) {const a=UNIT_TYPES[t.role].abilities[field];const p=findPayment(availableDice(g,t.side),a.cost);if(p)return {kind:"ability",ability:field,diceIds:p.map(d=>d.id),targetId:enemies[0].id,allyId:t.id,dieId:availableDice(g,t.side).sort((a,b)=>a.value-b.value)[0]?.id,dieType:"attack"};}
 return {kind:"pass"};
}
export function aiStep(g) {
 if(g.phase==="draft")return chooseCards(g,aiDraftChoice(g));
 if(g.phase==="react") {const side=g.pending.defender,c=g.fleets[side].hand.find(c=>c.timing==="defense");return c?playReaction(g,side,c.id):resolveReaction(g);}
 if(g.phase==="activate") {
  const side=turnOf(g).side;const c=g.fleets[side].hand.find(c=>c.timing==="activation");
  if(c&&!g.fleets[side].extraUsed){const next=playReaction(g,side,c.id,0,[],turnOf(g).id);if(next!==g)return next;}
  return tryAction(g,aiActionChoice(g));
 }
 return g;
}
