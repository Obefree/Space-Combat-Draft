import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,newBattle,aiDraftChoice,chooseCards,turnOf,other,tryAction,availableDice,UNIT_TYPES,CARD_TYPES,findPayment,canPay,playReaction,resolveReaction,aiStep,victoryPoints,aliveUnits} from '../app/fleet-test/engine.mjs';
const start=g=>chooseCards(chooseCards(g,[]),[]);
const die=(id,type,value,source=null)=>({id,type,value,source,spent:false});
function finishRound(g){const round=g.round;let n=0;while(g.phase!=='done'&&g.round===round){assert.ok(n++<100);g=g.phase==='react'?resolveReaction(g):tryAction(g,{kind:'pass'});}return g;}
test('ships roll their own printed dice before any card; no modules, no required tactics',()=>{const g=createGame();for(const side of ['A','B']){assert.equal(g.fleets[side].dice.length,6);for(const u of g.fleets[side].units){assert.deepEqual(g.fleets[side].dice.filter(d=>d.source===u.id).map(d=>d.type),UNIT_TYPES[u.role].dice);}assert.ok(g.fleets[side].dice.every(d=>d.value>=1&&d.value<=3));}const playing=start(g);assert.equal(playing.phase,'activate');assert.equal(playing.queue.length,6);assert.equal(new Set(playing.queue.map(q=>q.id)).size,6);assert.deepEqual(playing.queue.map(q=>q.initiative),[8,7,5,4,3,2]);});
test('three complete activation rounds without cards; defender wins equal surviving strength',()=>{let g=createGame();let activations=0;for(let round=1;round<=3;round++){g=start(g);assert.equal(g.round,round);while(g.phase==='activate'){activations++;g=tryAction(g,{kind:'pass'});}}assert.equal(activations,18);assert.equal(g.phase,'done');assert.equal(g.result.scoreA,11);assert.equal(g.result.scoreB,11);assert.equal(g.winner,'B');assert.equal(g.result.kind,'defender');let a=createGame('other','hotseat','A');for(let r=0;r<3;r++)a=finishRound(start(a));assert.equal(a.winner,'A');});
test('every ship has two usable abilities, with cheap single-colour 3 and strong 8 or split 5+5',()=>{for(const [role,spec] of Object.entries(UNIT_TYPES)){assert.equal(spec.abilities.length,2);assert.deepEqual(Object.values(spec.abilities[0].cost),[3]);assert.ok(Object.values(spec.abilities[1].cost).includes(8)||Object.values(spec.abilities[1].cost).every(n=>n===5));for(const field of [0,1]){let g=start(createGame());const side=g.fleets.A.units.some(u=>u.role===role)?'A':'B';const u=g.fleets[side].units.find(u=>u.role===role);g.queue=[{side,id:u.id,role,initiative:u.initiative}];g.index=0;const cost=spec.abilities[field].cost;g.fleets[side].dice=Object.entries(cost).flatMap(([type,min])=>Array.from({length:Math.ceil(min/3)},(_,i)=>die(type+i,type,Math.min(3,min-i*3))));g.fleets[side==='A'?'B':'A'].hand=[];const payment=findPayment(availableDice(g,side),cost);const next=tryAction(g,{kind:'ability',ability:field,diceIds:payment.map(d=>d.id),dieId:payment[0].id,dieType:"attack",targetId:g.fleets[side==='A'?'B':'A'].units[0].id});assert.notEqual(next,g,role+' ability '+field);}}});
test('colour thresholds are independent; an attack surplus cannot replace defense',()=>{assert.equal(canPay([die('a','attack',10)],{attack:5,defense:5}),false);assert.equal(canPay([die('a','attack',5),die('b','defense',5)],{attack:5,defense:5}),true);});
test('exactly one tactic per fleet per round; cards never assign commands or take away ship activations',()=>{const g=createGame(),card=g.fleets.A.hand.find(c=>c.type==='assault');const a=chooseCards(g,[card.id]);assert.equal(availableDice(a,'A').length,6);assert.equal(a.fleets.A.played.length,0);assert.equal(a.drafting,'B');assert.equal(chooseCards(g,[card.id,card.id]),g);const playing=chooseCards(a,[]);assert.equal(playing.queue.length,6);assert.equal(availableDice(playing,'A').length,8);assert.equal(chooseCards(playing,[]),playing);for(const c of CARD_TYPES)assert.equal(c.abilities.length,2);});
test('ordinary ability checks the whole shared pool without selection or spending; explicit burning persists',()=>{let g=start(createGame());const source=g.fleets.A.units[0].id;g.fleets.A.dice.filter(d=>d.source===source).forEach(d=>d.value=3);const ids=g.fleets.A.dice.filter(d=>d.source===source).slice(0,1).map(d=>d.id);g.fleets.B.hand=[];g=tryAction(g,{kind:'ability',ability:0,diceIds:ids,targetId:g.fleets.B.units[0].id});assert.equal(g.fleets.A.dice.find(d=>d.id===ids[0]).spent,false);g=finishRound(g);assert.equal(g.fleets.A.dice.find(d=>d.id===ids[0]).spent,false);
const card=g.fleets.A.hand.find(c=>c.type==='assault');const tech=g.fleets.A.dice.filter(d=>d.type==='tech');tech[0].value=3;g=chooseCards(g,[card.id],1,[tech[0].id]);assert.ok(!g.fleets.A.burned.includes(tech[0].id));g=chooseCards(g,[]);assert.ok(g.fleets.A.burned.includes(tech[0].id));g=finishRound(g);assert.equal(g.round,3);assert.ok(!g.fleets.A.dice.some(d=>d.id===tech[0].id));});
test('initiative tactic reorders all fleet ships and defender breaks equal initiative',()=>{const g=createGame(),c=g.fleets.B.hand.find(c=>c.type==='initiative');const p=chooseCards(chooseCards(g,[]),[c.id]);assert.equal(p.queue[0].side,'B');assert.equal(p.queue[0].initiative,9);let same=createGame();same.fleets.A.units.forEach(u=>u.initiative=5);same.fleets.B.units.forEach(u=>u.initiative=5);assert.equal(start(same).queue[0].side,'B');});
test('defensive reaction reduces incoming damage without using a ship turn; reuse is rejected',()=>{let g=start(createGame());const source=g.fleets.A.units[0].id;g.fleets.A.dice.filter(d=>d.source===source).forEach(d=>d.value=3);const d=g.fleets.A.dice.find(d=>d.source===source);const target=g.fleets.B.units[0];g=tryAction(g,{kind:'ability',ability:0,diceIds:[d.id],targetId:target.id});assert.equal(g.phase,'react');const card=g.fleets.B.hand.find(c=>c.timing==='defense');const r=playReaction(g,'B',card.id);assert.equal(r.fleets.B.units[0].hp,target.hp);assert.equal(r.index,1);assert.equal(playReaction(r,'B',card.id),r);});
test('second activation card inserts exactly one extra ship turn, no ordinary cards required',()=>{let g=start(createGame());const card=g.fleets.A.hand.find(c=>c.timing==='activation');const u=turnOf(g);g=playReaction(g,'A',card.id,0,[],u.id);assert.equal(g.queue.length,7);assert.equal(g.queue[1].id,u.id);assert.equal(g.queue[1].extra,true);g=tryAction(g,{kind:'pass'});assert.equal(turnOf(g).id,u.id);assert.equal(g.fleets.A.extraUsed,true);assert.equal(playReaction(g,'B',g.fleets.B.hand.find(c=>c.timing==='activation').id,0,[],g.fleets.B.units[0].id),g);});
test('destroyed ships lose future turns but already rolled dice stay in the shared pool',()=>{let g=createGame();g.fleets.A.units[0].hp=0;assert.equal(availableDice(g,'A').length,6);g=start(g);assert.equal(g.queue.length,5);assert.equal(victoryPoints(g.fleets.A),5);for(let i=0;i<3;i++){g=finishRound(g);if(g.phase!=='done')g=start(g);}assert.equal(g.phase,'done');assert.equal(g.winner,'B');});
test('deterministic live AI completes three rounds for 100 seeds without deadlock or illegal states',()=>{for(let seed=0;seed<100;seed++){let g=createGame('test-'+seed),n=0;while(g.phase!=='done'){assert.ok(n++<100,'seed '+seed);const next=aiStep(g);assert.notEqual(next,g,'stuck '+g.phase);g=next;for(const side of ['A','B']){assert.ok(g.fleets[side].units.every(u=>u.hp>=0));assert.equal(new Set(g.fleets[side].dice.map(d=>d.id)).size,g.fleets[side].dice.length);}}assert.equal(g.round,3);assert.ok(['A','B'].includes(g.winner));}});

test('threshold uses the fleet total, not selected or source-ship dice, without changing the pool',()=>{let g=start(createGame());g.fleets.A.dice=[die('x','tech',2,'A-destroyer'),die('y','tech',1,'A-cruiser')];g.fleets.B.hand=[];const before=structuredClone(g.fleets.A.dice);const next=tryAction(g,{kind:'ability',ability:0,targetId:g.fleets.B.units[0].id});assert.notEqual(next,g);assert.deepEqual(next.fleets.A.dice,before);g.fleets.A.dice=[die('x','tech',2)];assert.equal(tryAction(g,{kind:'ability',ability:0,targetId:g.fleets.B.units[0].id}),g);});

test('new battles refresh seeds, scenarios, hands and dice; seed replay is exact',()=>{const games=Array.from({length:12},()=>newBattle());assert.equal(new Set(games.map(g=>g.seed)).size,12);for(const select of [g=>g.fleets.A.units.map(u=>u.role).join(),g=>g.fleets.A.hand.map(c=>c.type).join(),g=>g.fleets.A.dice.map(d=>d.value).join()])assert.ok(new Set(games.map(select)).size>1);for(const g of games){assert.deepEqual(createGame(g.seed,g.mode,g.defender,'random'),g);assert.equal(g.fleets.A.hand.filter(c=>c.timing==='tactic').length,5);assert.equal(g.fleets.B.units.length,3);}});
test('tactics are locked face down without revealing effects until both sides choose',()=>{const g=createGame(),cardA=g.fleets.A.hand.find(c=>c.type==='assault'),cardB=g.fleets.B.hand.find(c=>c.type==='initiative');const locked=chooseCards(g,[cardA.id]);assert.equal(locked.phase,'draft');assert.deepEqual(locked.fleets,g.fleets);assert.deepEqual(locked.log,g.log);const revealed=chooseCards(locked,[cardB.id]);assert.equal(revealed.phase,'activate');assert.equal(revealed.fleets.A.played.length,1);assert.equal(revealed.fleets.B.played.length,1);assert.equal(revealed.fleets.A.played[0].round,1);assert.equal(revealed.fleets.B.played[0].round,1);assert.equal(revealed.queue[0].side,'B');assert.deepEqual(revealed.tacticChoices,{});});
test('strong shot deals actual HP damage after a defensive card and reports absorption',()=>{let g=start(createGame());g.queue[0]={side:'A',id:'A-destroyer',role:'destroyer',initiative:5};g.fleets.A.dice=[die('a1','attack',3),die('a2','attack',3),die('a3','attack',3)];const target=g.fleets.B.units[0],hp=target.hp;const shot=tryAction(g,{kind:'ability',ability:1,targetId:target.id});assert.equal(shot.phase,'react');const guard=shot.fleets.B.hand.find(c=>c.timing==='defense');const resolved=playReaction(shot,'B',guard.id);assert.equal(resolved.fleets.B.units[0].hp,Math.max(0,hp-4));assert.equal(resolved.lastHit.reactionBlocked,2);assert.ok(resolved.log.some(s=>s.includes('реакция −2')));});
test('random scenarios complete all rounds with simultaneous reveals and live AI',()=>{for(let seed=0;seed<100;seed++){let g=createGame('scenario-'+seed,'solo','B','random'),n=0;while(g.phase!=='done'){assert.ok(n++<100);const next=aiStep(g);assert.notEqual(next,g);g=next;}assert.equal(g.round,3);}});

test('AI chooses its own tactics without reading opponent hand or sealed choice',()=>{const g=createGame('ai-choice','solo','B','random');g.drafting='B';const choice=aiDraftChoice(g);const changed=structuredClone(g);changed.fleets.A.hand=[];changed.tacticChoices.A={cardId:'unseen',field:1,diceIds:['unseen']};assert.deepEqual(aiDraftChoice(changed),choice);assert.equal(choice.length,1);assert.ok(g.fleets.B.hand.some(c=>c.id===choice[0]&&c.timing==='tactic'));});
test('human can only pass while AI selects, reveals, activates, reacts and fights autonomously',()=>{let attacks=0;for(let seed=0;seed<20;seed++){let g=createGame('solo-'+seed,'solo','B','random'),n=0;while(g.phase!=='done'){assert.ok(n++<100);if(g.phase==='draft'&&g.drafting==='A')g=chooseCards(g,[]);else if(g.phase==='activate'&&turnOf(g).side==='A')g=tryAction(g,{kind:'pass'});else if(g.phase==='react'&&g.pending.defender==='A')g=resolveReaction(g);else{const next=aiStep(g);assert.notEqual(next,g,'AI should advance its own turn');g=next;}}assert.equal(g.round,3);assert.ok(g.fleets.B.played.some(c=>CARD_TYPES.find(t=>t.name===c.name)?.timing==='tactic'));attacks+=g.fleets.A.units.reduce((sum,u)=>sum+u.maxHp-u.hp,0);}assert.ok(attacks>0,'AI must deal real damage');});

test('random lineups start with equal strength, HP and six dice; strong abilities are scarce',()=>{let strong=0,ships=0;for(let i=0;i<1000;i++){const g=createGame('balance-'+i,'solo','B','random');assert.equal(victoryPoints(g.fleets.A),11);assert.equal(victoryPoints(g.fleets.B),11);for(const side of ['A','B']){assert.equal(g.fleets[side].units.reduce((n,u)=>n+u.hp,0),18);assert.equal(availableDice(g,side).length,6);assert.equal(g.fleets[side].hand.length,7);for(const u of g.fleets[side].units){ships++;if(canPay(availableDice(g,side),UNIT_TYPES[u.role].abilities[1].cost))strong++;}}}assert.ok(strong/ships<0.2,'fewer than 20% of strong abilities available before tactics');});
test('active personal shield protects the chosen ally and expires next round',()=>{let g=start(createGame());g.queue=[{side:'B',id:'B-frigate',role:'frigate',initiative:4},{side:'A',id:'A-destroyer',role:'destroyer',initiative:5}];g.index=0;g.fleets.B.dice=[die('shield1','defense',3),die('shield2','defense',3),die('shield3','defense',3)];const target=g.fleets.B.units[0];g=tryAction(g,{kind:'ability',ability:1,allyId:target.id});assert.equal(g.fleets.B.units[0].shield,4);g.fleets.A.dice=[die('attack1','attack',3)];g.fleets.B.hand=[];const hp=target.hp;g=tryAction(g,{kind:'ability',ability:0,targetId:target.id});assert.equal(g.fleets.B.units[0].hp,hp);assert.equal(g.round,2);assert.equal(g.fleets.B.units[0].shield,0);});
test('recalibration changes chosen shared-pool die; suppression moves remaining enemy activation to end',()=>{let g=start(createGame());g.fleets.A.dice=[die('t1','tech',3),die('t2','tech',3),die('t3','tech',3),die('edit','defense',1)];const tuned=tryAction(g,{kind:'ability',ability:1,dieId:'edit',dieType:'attack'});assert.notEqual(tuned,g);assert.equal(tuned.fleets.A.dice.find(d=>d.id==='edit').type,'attack');assert.equal(tuned.fleets.A.dice.find(d=>d.id==='edit').value,3);g=start(createGame());g.index=1;g.fleets.B.dice=[die('a1','attack',3),die('a2','attack',3),die('a3','attack',3)];g.fleets.A.hand=[];const target=g.fleets.A.units.find(u=>u.role==='destroyer');const delayed=tryAction(g,{kind:'ability',ability:1,targetId:target.id});assert.equal(delayed.queue.at(-1).id,target.id);assert.equal(delayed.queue.length,g.queue.length);});

test('unknown action kinds including the old special alias do not fire an ability',()=>{let g=start(createGame());g.fleets.A.dice.forEach(d=>d.value=3);g.fleets.B.hand=[];const hp=g.fleets.B.units[0].hp;assert.equal(tryAction(g,{kind:'special',targetId:g.fleets.B.units[0].id}),g);assert.equal(tryAction(g,{kind:'ability',targetId:g.fleets.B.units[0].id}),g);const hit=tryAction(g,{kind:'ability',ability:0,targetId:g.fleets.B.units[0].id});assert.notEqual(hit,g);assert.ok(hit.phase==='react'||hit.fleets.B.units[0].hp<hp);});
test('a locked pass stores cardId null so the opponent banner is not a hidden card',()=>{const passed=chooseCards(createGame(),[]);assert.equal(passed.phase,'draft');assert.equal(passed.tacticChoices.A.cardId,null);const card=createGame().fleets.A.hand.find(c=>c.timing==='tactic');const sealed=chooseCards(createGame(),[card.id]);assert.equal(sealed.tacticChoices.A.cardId,card.id);});


test('damage resolves reaction before shields; a strong guard preserves unused personal shield',()=>{
 let g=start(createGame());
 g.queue=[{side:'A',id:'A-destroyer',role:'destroyer',initiative:5},{side:'B',id:'B-frigate',role:'frigate',initiative:4}];
 g.fleets.A.dice=[die('a1','attack',3),die('a2','attack',3),die('a3','attack',3)];
 g.fleets.B.dice=[die('b1','defense',3)];g.fleets.B.units[0].shield=4;
 const original=structuredClone(g.fleets.B.units[0]);
 const pending=tryAction(g,{kind:'ability',ability:1,targetId:original.id});
 assert.equal(pending.phase,'react');
 assert.equal(pending.pending.damage,6,'pending holds the original incoming damage');
 assert.equal(pending.fleets.B.units[0].shield,4,'shield is not consumed before a reaction');
 assert.equal(pending.fleets.B.units[0].hp,original.hp);
 const guard=pending.fleets.B.hand.find(c=>c.timing==='defense');
 const resolved=playReaction(pending,'B',guard.id,1,['b1']);
 assert.equal(resolved.fleets.B.units[0].hp,original.hp);
 assert.equal(resolved.fleets.B.units[0].shield,3,'reaction blocks 5, only 1 shield used');
 assert.deepEqual([resolved.lastHit.incoming,resolved.lastHit.reactionBlocked,resolved.lastHit.personalBlocked,resolved.lastHit.fleetBlocked,resolved.lastHit.damage],[6,5,1,0,0]);
 assert.equal(resolved.lastHit.attacker,'A');assert.equal(resolved.lastHit.defender,'B');
 assert.ok(resolved.log.some(line=>line.includes('Лига Ориона → Гегемония')&&line.includes('HP −0')));
 assert.equal(resolveReaction(resolved),resolved,'resolved hit cannot be applied twice');
});

test('all attacks are enemy-only, for either side, even if player supplies a friendly target ID',()=>{
 for(const side of ['A','B']){
  let g=start(createGame());
  const role=side==='A'?'destroyer':'dreadnought';
  const actor=g.fleets[side].units.find(u=>u.role===role);
  g.queue=[{side,id:actor.id,role,initiative:actor.initiative},{side:other(side),id:g.fleets[other(side)].units[0].id,role:g.fleets[other(side)].units[0].role,initiative:1}];
  g.index=0;g.fleets[side].dice=[die('shot','attack',3)];
  const friendly=g.fleets[side].units.find(u=>u.hp>0);
  assert.equal(tryAction(g,{kind:'ability',ability:0,targetId:friendly.id}),g,'no action or self-hit on friendly ID');
  assert.equal(g.fleets[side].units.find(u=>u.id===friendly.id).hp,friendly.hp);
  const enemy=g.fleets[other(side)].units[0];
  g.fleets[other(side)].hand=[];
  const shot=tryAction(g,{kind:'ability',ability:0,targetId:enemy.id});
  assert.notEqual(shot,g);
  assert.deepEqual(shot.fleets[side].units.map(u=>u.hp),g.fleets[side].units.map(u=>u.hp),'attacking fleet never loses HP');
  assert.equal(shot.fleets[other(side)].units[0].hp,enemy.hp-(side==='A'?2:3));
  assert.equal(shot.lastHit.defender,other(side));
  assert.equal(shot.lastHit.target,enemy.id);
 }
});

test('personal and fleet shields absorb only leftover incoming damage; HP and shield stay bounded',()=>{
 let g=start(createGame());
 g.queue=[{side:'A',id:'A-destroyer',role:'destroyer',initiative:5},{side:'B',id:'B-frigate',role:'frigate',initiative:4}];
 g.fleets.A.dice=[die('a1','attack',3),die('a2','attack',3),die('a3','attack',3)];
 g.fleets.B.hand=[];g.fleets.B.units[0].shield=2;g.fleets.B.shield=3;
 const before=g.fleets.B.units[0].hp;
 const next=tryAction(g,{kind:'ability',ability:1,targetId:g.fleets.B.units[0].id});
 assert.equal(next.fleets.B.units[0].hp,before-1);
 assert.deepEqual([next.lastHit.incoming,next.lastHit.reactionBlocked,next.lastHit.personalBlocked,next.lastHit.fleetBlocked,next.lastHit.damage],[6,0,2,3,1]);
 assert.equal(next.fleets.B.units[0].shield,0);assert.equal(next.fleets.B.shield,0);
 assert.ok(next.fleets.B.units.every(u=>u.hp>=0&&u.hp<=u.maxHp));
});

test('a fully shielded hit does not require a reaction or reduce HP',()=>{
 let g=start(createGame());
 g.queue=[{side:'A',id:'A-scout',role:'scout',initiative:8},{side:'B',id:'B-frigate',role:'frigate',initiative:4}];
 g.fleets.A.dice=[die('tech','tech',3)];
 const unit=g.fleets.B.units[0];unit.shield=3;
 const next=tryAction(g,{kind:'ability',ability:0,targetId:unit.id});
 assert.notEqual(next.phase,'react');
 assert.equal(next.fleets.B.units[0].hp,unit.hp);
 assert.equal(next.fleets.B.units[0].shield,1);
 assert.equal(next.lastHit.damage,0);
 assert.equal(next.lastHit.personalBlocked,2);
});


test('solo: player shot only threatens enemy HP, AI defense resolves without human card input',()=>{
 let g=start(createGame('solo-player-shot','solo','B'));
 const attacker=g.fleets.A.units[0],target=g.fleets.B.units[0];
 g.queue=[{side:'A',id:attacker.id,role:attacker.role,initiative:8},{side:'B',id:g.fleets.B.units[0].id,role:g.fleets.B.units[0].role,initiative:7}];
 g.index=0;g.phase='activate';
 const cost=UNIT_TYPES[attacker.role].abilities[0].cost;
 g.fleets.A.dice=Object.entries(cost).map(([type,value])=>die('attack-source',type,value));
 const ownBefore=g.fleets.A.units.map(u=>u.hp),enemyBefore=target.hp;
 const shot=tryAction(g,{kind:'ability',ability:0,targetId:target.id});
 assert.notEqual(shot,g);
 assert.equal(shot.phase,'react');
 assert.equal(shot.pending.attacker,'A');
 assert.equal(shot.pending.defender,'B');
 assert.equal(shot.pending.target,target.id);
 assert.deepEqual(shot.fleets.A.units.map(u=>u.hp),ownBefore);
 const resolved=aiStep(shot);
 assert.notEqual(resolved,shot);
 assert.equal(resolved.pending,null);
 assert.deepEqual(resolved.fleets.A.units.map(u=>u.hp),ownBefore);
 assert.equal(resolved.lastHit.attacker,'A');
 assert.equal(resolved.lastHit.defender,'B');
 assert.equal(resolved.lastHit.target,target.id);
 assert.ok(resolved.fleets.B.units[0].hp<=enemyBefore);
 assert.notEqual(resolved.phase,'react');
});
test('solo: AI offensive shot queues a HUMAN defensive reaction on own target only',()=>{
 let g=start(createGame('solo-ai-shot','solo','B'));
 const attacker=g.fleets.B.units[0],target=g.fleets.A.units[0];
 g.queue=[{side:'B',id:attacker.id,role:attacker.role,initiative:8}];
 g.index=0;g.phase='activate';
 const cost=UNIT_TYPES[attacker.role].abilities[0].cost;
 g.fleets.B.dice=Object.entries(cost).map(([type,value])=>die('b-source',type,value));
 const enemyBefore=g.fleets.B.units.map(u=>u.hp);
 const shot=tryAction(g,{kind:'ability',ability:0,targetId:target.id});
 assert.equal(shot.phase,'react');
 assert.equal(shot.pending.attacker,'B');
 assert.equal(shot.pending.defender,'A');
 assert.equal(shot.pending.target,target.id);
 assert.deepEqual(shot.fleets.B.units.map(u=>u.hp),enemyBefore);
 const resolved=resolveReaction(shot);
 assert.notEqual(resolved,shot);
 // The round may end immediately after the attack, clearing lastHit; history survives.
 assert.equal(resolved.hitHistory[0].attacker,'B');
 assert.equal(resolved.hitHistory[0].defender,'A');
 assert.equal(resolved.hitHistory[0].target,target.id);
 assert.deepEqual(resolved.fleets.B.units.map(u=>u.hp),enemyBefore);
});


test('successive resolved hits stay attributed to the right fleets even when next action is AI',()=>{
 let g=start(createGame('hit-history','solo','B'));
 g.queue=[
  {side:'A',id:'A-scout',role:'scout',initiative:8},
  {side:'B',id:'B-interceptor',role:'interceptor',initiative:7},
  {side:'A',id:'A-destroyer',role:'destroyer',initiative:5},
 ];
 g.index=0;g.phase='activate';
 g.fleets.A.dice=[die('a','tech',3)];
 g.fleets.B.dice=[die('b','attack',3)];
 const bId=g.fleets.B.units.find(u=>u.role==='interceptor').id;
 const aId=g.fleets.A.units.find(u=>u.role==='scout').id;
 g=tryAction(g,{kind:'ability',ability:0,targetId:bId});
 assert.equal(g.pending?.defender,'B');
 g=aiStep(g);
 assert.equal(g.lastHit?.defender,'B');
 assert.equal(g.hitHistory.length,1);
 assert.equal(g.hitHistory[0].attacker,'A');
 assert.equal(g.hitHistory[0].target,bId);
 g=tryAction(g,{kind:'ability',ability:0,targetId:aId});
 assert.equal(g.pending?.defender,'A');
 assert.equal(g.hitHistory[0].target,bId,'prior player shot remains visible while AI attacks');
 g=resolveReaction(g);
 assert.equal(g.hitHistory.length,2);
 assert.equal(g.hitHistory[0].attacker,'B');
 assert.equal(g.hitHistory[0].defender,'A');
 assert.equal(g.hitHistory[0].target,aId);
 assert.equal(g.hitHistory[1].attacker,'A');
 assert.equal(g.hitHistory[1].defender,'B');
 assert.equal(g.hitHistory[1].target,bId);
});


test('AI tactic chooses exactly one of two alternative effects and adds only its printed dice',()=>{
 let g=chooseCards(createGame('one-ai-tactic','solo','B'),[]);
 g.fleets.B.hand=g.fleets.B.hand.filter(c=>c.type==='assault'||c.timing!=='tactic');
 const before=g.fleets.B.dice.length;
 const chosen=aiStep(g);
 assert.equal(chosen.phase,'activate');
 assert.equal(chosen.fleets.B.played.length,1);
 assert.equal(chosen.fleets.B.played[0].name,'Боевой натиск');
 assert.equal(chosen.fleets.B.played[0].field,0);
 assert.equal(chosen.fleets.B.dice.length,before+2,'base +2 attack dice, NOT stronger +4');
 assert.equal(chosen.fleets.B.burned.length,0,'alternative strong ability was NOT activated');
 assert.equal(chosen.log.filter(s=>s.includes('карта «Боевой натиск»')).length,1);
});
test('AI extra activation is one separate card, then exactly one ship ability on each turn',()=>{
 let g=start(createGame('ai-extra-turn','solo'));
 const ship=g.fleets.B.units.find(u=>u.role==='interceptor');
 g.queue=[{side:'B',id:ship.id,role:ship.role,initiative:7},{side:'A',id:g.fleets.A.units[0].id,role:g.fleets.A.units[0].role,initiative:8}];
 g.index=0;g.phase='activate';g.fleets.B.dice=[die('a1','attack',3)];
 const hp=g.fleets.A.units.map(u=>u.hp);
 const afterCard=aiStep(g);
 assert.equal(afterCard.fleets.B.played.filter(c=>c.name==='Вторая активация').length,1);
 assert.equal(afterCard.fleets.B.played.find(c=>c.name==='Вторая активация').field,0);
 assert.deepEqual(afterCard.fleets.A.units.map(u=>u.hp),hp,'playing a turn card does NOT also fire ship ability');
 assert.equal(afterCard.queue.filter(q=>q.extra).length,1);
 const afterFirst=aiStep(afterCard);
 assert.equal(afterFirst.log.filter(s=>s.includes('применяет ОДНУ способность')).length,1);
 assert.equal(afterFirst.fleets.B.played.filter(c=>c.name==='Вторая активация').length,1,'card cannot be reused');
 let afterDefense=afterFirst.phase==='react'?resolveReaction(afterFirst):afterFirst;
 assert.equal(turnOf(afterDefense)?.side,'B');
 assert.equal(turnOf(afterDefense)?.extra,true);
 const afterSecond=aiStep(afterDefense);
 assert.equal(afterSecond.log.filter(s=>s.includes('применяет ОДНУ способность')).length,2,'two separate ship activations');
 assert.equal(afterSecond.fleets.B.played.filter(c=>c.name==='Вторая активация').length,1);
});
test('real personal shields exactly absorb a 2-damage AI shot; defense dice do not become shields',()=>{
 let g=start(createGame('shield-versus-dice','solo'));
 const ship=g.fleets.B.units.find(u=>u.role==='interceptor');
 const target=g.fleets.A.units.find(u=>u.role==='scout');
 g.queue=[{side:'B',id:ship.id,role:ship.role,initiative:7},{side:'A',id:target.id,role:target.role,initiative:8}];
 g.index=0;g.phase='activate';g.fleets.B.dice=[die('gun','attack',3)];
 g.fleets.B.hand=g.fleets.B.hand.filter(c=>c.timing!=='activation');
 const startHp=target.hp;
 target.shield=2;
 let shot=tryAction(g,{kind:'ability',ability:0,targetId:target.id});
 assert.equal(shot.hitHistory[0].incoming,2);
 assert.equal(shot.hitHistory[0].personalBlocked,2);
 assert.equal(shot.hitHistory[0].damage,0);
 assert.equal(shot.fleets.A.units.find(u=>u.id===target.id).hp,startHp);
 assert.equal(shot.fleets.A.units.find(u=>u.id===target.id).shield,0);
 const noRealShield=start(createGame('defense-dice-are-not-shield'));
 const scout=noRealShield.fleets.A.units[0];
 scout.shield=0;
 noRealShield.fleets.A.dice=[die('d','defense',3)];
 noRealShield.queue=[{side:'B',id:noRealShield.fleets.B.units.find(u=>u.role==='interceptor').id,role:'interceptor',initiative:7},{side:'A',id:scout.id,role:scout.role,initiative:8}];
 noRealShield.index=0;noRealShield.phase='activate';noRealShield.fleets.B.dice=[die('gun','attack',3)];noRealShield.fleets.A.hand=[];
 let hit=tryAction(noRealShield,{kind:'ability',ability:0,targetId:scout.id});
 assert.equal(hit.hitHistory[0].personalBlocked,0);
 assert.equal(hit.hitHistory[0].damage,2);
});
test('an AI ship never triggers both ability fields in the same activation when both affordable',()=>{
 let g=start(createGame('ai-strong-only','solo'));
 const b=g.fleets.B.units.find(u=>u.role==='interceptor'),a=g.fleets.A.units.find(u=>u.role==='scout');
 g.queue=[{side:'B',id:b.id,role:b.role,initiative:7},{side:'A',id:a.id,role:a.role,initiative:8}];
 g.index=0;g.phase='activate';g.fleets.B.dice=[die('g1','attack',3),die('g2','attack',3),die('g3','attack',3)];
 g.fleets.B.hand=g.fleets.B.hand.filter(c=>c.timing!=='activation');
 const shot=aiStep(g);
 assert.equal(shot.log.filter(s=>s.includes('применяет ОДНУ способность')).length,1);
 assert.match(shot.log.join('\n'),/«Подавление»/);
 assert.doesNotMatch(shot.log.join('\n'),/«Ракетный заход»/);
 assert.equal(shot.pending?.damage,3);
});
