import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {createGame,chooseCards,turnOf,tryAction,availableDice,UNIT_TYPES,CARD_TYPES,findPayment,canPay,playReaction,resolveReaction,aiStep,aiActionChoice,aiDraftChoice,victoryPoints,aliveUnits,other} from '../app/fleet-test/engine.mjs';
const start=g=>chooseCards(chooseCards(g,[]),[]);
const die=(id,type,value,source=null)=>({id,type,value,source,spent:false});
function finishRound(g){const round=g.round;let n=0;while(g.phase!=='done'&&g.round===round){assert.ok(n++<100);g=g.phase==='react'?resolveReaction(g):tryAction(g,{kind:'pass'});}return g;}
test('ships roll their own printed dice before any card; no modules, no required tactics',()=>{const g=createGame();for(const side of ['A','B']){assert.equal(g.fleets[side].dice.length,9);for(const u of g.fleets[side].units){assert.deepEqual(g.fleets[side].dice.filter(d=>d.source===u.id).map(d=>d.type),UNIT_TYPES[u.role].dice);}assert.ok(g.fleets[side].dice.every(d=>d.value>=1&&d.value<=3));}const playing=start(g);assert.equal(playing.phase,'activate');assert.equal(playing.queue.length,6);assert.equal(new Set(playing.queue.map(q=>q.id)).size,6);assert.deepEqual(playing.queue.map(q=>q.initiative),[8,7,5,4,3,2]);});
test('three complete activation rounds without cards; defender wins equal surviving strength',()=>{let g=createGame();let activations=0;for(let round=1;round<=3;round++){g=start(g);assert.equal(g.round,round);while(g.phase==='activate'){activations++;g=tryAction(g,{kind:'pass'});}}assert.equal(activations,18);assert.equal(g.phase,'done');assert.equal(g.result.scoreA,11);assert.equal(g.result.scoreB,11);assert.equal(g.winner,'B');assert.equal(g.result.kind,'defender');let a=createGame('other','hotseat','A');for(let r=0;r<3;r++)a=finishRound(start(a));assert.equal(a.winner,'A');});
test('every ship has two usable abilities, with cheap single-colour 3 and strong 8 or split 5+5',()=>{for(const [role,spec] of Object.entries(UNIT_TYPES)){assert.equal(spec.abilities.length,2);assert.deepEqual(Object.values(spec.abilities[0].cost),[3]);assert.ok(Object.values(spec.abilities[1].cost).includes(8)||Object.values(spec.abilities[1].cost).every(n=>n===5));for(const field of [0,1]){let g=start(createGame());const side=g.fleets.A.units.some(u=>u.role===role)?'A':'B';const u=g.fleets[side].units.find(u=>u.role===role);g.queue=[{side,id:u.id,role,initiative:u.initiative}];g.index=0;const cost=spec.abilities[field].cost;g.fleets[side].dice=Object.entries(cost).flatMap(([type,min])=>Array.from({length:Math.ceil(min/3)},(_,i)=>die(type+i,type,Math.min(3,min-i*3))));g.fleets[side==='A'?'B':'A'].hand=[];const payment=findPayment(availableDice(g,side),cost);const next=tryAction(g,{kind:'ability',ability:field,diceIds:payment.map(d=>d.id),targetId:g.fleets[side==='A'?'B':'A'].units[0].id});assert.notEqual(next,g,role+' ability '+field);}}});
test('colour thresholds are independent; an attack surplus cannot replace defense',()=>{assert.equal(canPay([die('a','attack',10)],{attack:5,defense:5}),false);assert.equal(canPay([die('a','attack',5),die('b','defense',5)],{attack:5,defense:5}),true);});
test('exactly one tactic per fleet per round; cards never assign commands or take away ship activations',()=>{const g=createGame(),card=g.fleets.A.hand.find(c=>c.type==='assault');const a=chooseCards(g,[card.id]);assert.equal(availableDice(a,'A').length,11);assert.equal(a.drafting,'B');assert.equal(chooseCards(g,[card.id,card.id]),g);const playing=chooseCards(a,[]);assert.equal(playing.queue.length,6);assert.equal(chooseCards(playing,[]),playing);for(const c of CARD_TYPES)assert.equal(c.abilities.length,2);});
test('ordinary ability exhausts dice but rerolls them next round; permanent card burning persists',()=>{let g=start(createGame());const source=g.fleets.A.units[0].id;g.fleets.A.dice.filter(d=>d.source===source).forEach(d=>d.value=3);const ids=g.fleets.A.dice.filter(d=>d.source===source).slice(0,1).map(d=>d.id);g.fleets.B.hand=[];g=tryAction(g,{kind:'ability',ability:0,diceIds:ids,targetId:g.fleets.B.units[0].id});assert.equal(g.fleets.A.dice.find(d=>d.id===ids[0]).spent,true);g=finishRound(g);assert.equal(g.fleets.A.dice.find(d=>d.id===ids[0]).spent,false);
const card=g.fleets.A.hand.find(c=>c.type==='assault');const tech=g.fleets.A.dice.filter(d=>d.type==='tech');tech[0].value=3;g=chooseCards(g,[card.id],1,[tech[0].id]);assert.ok(g.fleets.A.burned.includes(tech[0].id));g=chooseCards(g,[]);g=finishRound(g);assert.equal(g.round,3);assert.ok(!g.fleets.A.dice.some(d=>d.id===tech[0].id));});
test('initiative tactic reorders all fleet ships and defender breaks equal initiative',()=>{const g=createGame(),c=g.fleets.B.hand.find(c=>c.type==='initiative');const p=chooseCards(chooseCards(g,[]),[c.id]);assert.equal(p.queue[0].side,'B');assert.equal(p.queue[0].initiative,9);let same=createGame();same.fleets.A.units.forEach(u=>u.initiative=5);same.fleets.B.units.forEach(u=>u.initiative=5);assert.equal(start(same).queue[0].side,'B');});
test('defensive reaction reduces incoming damage without using a ship turn; reuse is rejected',()=>{let g=start(createGame());const source=g.fleets.A.units[0].id;g.fleets.A.dice.filter(d=>d.source===source).forEach(d=>d.value=3);const d=g.fleets.A.dice.find(d=>d.source===source);const target=g.fleets.B.units[0];g=tryAction(g,{kind:'ability',ability:0,diceIds:[d.id],targetId:target.id});assert.equal(g.phase,'react');const card=g.fleets.B.hand.find(c=>c.timing==='defense');const r=playReaction(g,'B',card.id);assert.equal(r.fleets.B.units[0].hp,target.hp);assert.equal(r.index,1);assert.equal(playReaction(r,'B',card.id),r);});
test('second activation card inserts exactly one extra ship turn, no ordinary cards required',()=>{let g=start(createGame());const card=g.fleets.A.hand.find(c=>c.timing==='activation');const u=turnOf(g);g=playReaction(g,'A',card.id,0,[],u.id);assert.equal(g.queue.length,7);assert.equal(g.queue[1].id,u.id);assert.equal(g.queue[1].extra,true);g=tryAction(g,{kind:'pass'});assert.equal(turnOf(g).id,u.id);assert.equal(g.fleets.A.extraUsed,true);assert.equal(playReaction(g,'B',g.fleets.B.hand.find(c=>c.timing==='activation').id,0,[],g.fleets.B.units[0].id),g);});
test('destroyed ships lose future activations and their dice; score uses survivors not HP',()=>{let g=createGame();g.fleets.A.units[0].hp=0;assert.equal(availableDice(g,'A').length,6);g=start(g);assert.equal(g.queue.length,5);assert.equal(victoryPoints(g.fleets.A),5);for(let i=0;i<3;i++){g=finishRound(g);if(g.phase!=='done')g=start(g);}assert.equal(g.phase,'done');assert.equal(g.winner,'B');});
test('deterministic live AI completes three rounds for 100 seeds without deadlock or illegal states',()=>{for(let seed=0;seed<100;seed++){let g=createGame('test-'+seed),n=0;while(g.phase!=='done'){assert.ok(n++<100,'seed '+seed);const next=aiStep(g);assert.notEqual(next,g,'stuck '+g.phase);g=next;for(const side of ['A','B']){assert.ok(g.fleets[side].units.every(u=>u.hp>=0));assert.equal(new Set(g.fleets[side].dice.map(d=>d.id)).size,g.fleets[side].dice.length);}}assert.equal(g.round,3);assert.ok(['A','B'].includes(g.winner));}});
test('engine has one live combat chain and no leftover HP-score or special-ability aliases', async () => {
  const source = await readFile(new URL('../app/fleet-test/engine.mjs', import.meta.url), 'utf8');
  const harness = await readFile(new URL('../scripts/fleet-balance.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfleetHp\b|\bfleetLosses\b|SHIP_SPECIALS|cheapestSpecial|aiReactionChoice|kind==="special"/);
  assert.doesNotMatch(harness, /function (pick|choose|ai)/);
  assert.equal((source.match(/export function\s+aiStep\s*\(/g) || []).length, 1);
  assert.match(harness, /\baiStep\(/);
  for (const name of ['tryAction','chooseCards','playReaction','resolveReaction','findPayment','aiActionChoice','aiDraftChoice']) {
    const definitions = source.match(new RegExp(`export function\\s+${name}\\s*\\(`, 'g')) ?? [];
    const calls = source.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) ?? [];
    assert.equal(definitions.length, 1, `${name} must have exactly one definition`);
    assert.ok(calls.length > definitions.length, `${name} is defined but never reached`);
  }
});
test('tryAction rejects the old special alias and unknown kinds; only ability+index fires', () => {
  let g = start(createGame());
  const turn = turnOf(g);
  const spec = UNIT_TYPES[turn.role].abilities[1];
  g.fleets[turn.side].dice = Object.entries(spec.cost).flatMap(([type, min], i) => [die(type + i, type, min)]);
  g.fleets[other(turn.side)].hand = [];
  const paid = findPayment(availableDice(g, turn.side), spec.cost).map(d => d.id);
  const targetId = g.fleets[other(turn.side)].units[0].id;
  assert.equal(tryAction(g, {kind:'special', diceIds:paid, targetId}), g);
  assert.equal(tryAction(g, {kind:'ability', diceIds:paid, targetId}), g);
  assert.equal(tryAction(g, {kind:'hit', ability:1, diceIds:paid, targetId}), g);
  const live = tryAction(g, {kind:'ability', ability:1, diceIds:paid, targetId});
  assert.notEqual(live, g);
});
test('AI choosers feed the live chooseCards/tryAction chain and never emit kind special', () => {
  let g = createGame('ai-chain');
  assert.deepEqual(aiDraftChoice(g), [g.fleets.A.hand.find(c => c.timing === 'tactic').id]);
  g = start(g);
  let n = 0;
  while (g.phase !== 'done') {
    assert.ok(n++ < 100);
    if (g.phase === 'activate') {
      const choice = aiActionChoice(g);
      assert.ok(choice.kind === 'pass' || (choice.kind === 'ability' && [0, 1].includes(choice.ability)));
    }
    const next = aiStep(g);
    assert.notEqual(next, g);
    g = next;
  }
  assert.ok(['A', 'B'].includes(g.winner));
});
