import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runBalance, simulateBattle } from "../scripts/fleet-balance.mjs";
import {
  CARD_TYPES, DEMO_FLOW, UNIT_TYPES, SPECIAL_PATTERNS, createGame, chooseCards, suggestedAssignments, placeCards, turnOf,
  tryAction, resolveReaction, aiDraftChoice, aiActionChoice, aiReactionChoice, fleetHp, victoryPoints, fleetLosses
} from "../app/fleet-test/engine.mjs";

function draftAndPlace(g) {
  for (const side of ["A", "B"]) {
    assert.equal(g.phase, "draft");
    assert.equal(g.drafting, side);
    const ids = side === "B" ? aiDraftChoice(g) :
      g.fleets[side].hand.slice(0, g.round === 1 ? 3 : 1).map(c => c.id);
    g = chooseCards(g, ids);
  }
  for (const side of ["A", "B"]) {
    assert.equal(g.phase, "place");
    assert.equal(g.placing, side);
    g = placeCards(g, suggestedAssignments(g, side));
  }
  assert.equal(g.phase, "activate");
  return g;
}

test("visual rules landing: card why-text, 7-step DEMO_FLOW, and play CTA", () => {
  assert.ok(CARD_TYPES.every(c => typeof c.why === "string" && c.why.length > 0));
  assert.equal(DEMO_FLOW.length, 7);
  DEMO_FLOW.forEach((step, i) => {
    assert.equal(step.n, i + 1);
    assert.ok(step.title && step.what && step.why);
  });
  const g = createGame("why-copy");
  assert.ok([...g.fleets.A.hand, ...g.fleets.B.hand].every(c => typeof c.why === "string" && c.why.length > 0));
  const page = readFileSync(new URL("../app/fleet-test/page.jsx", import.meta.url), "utf8");
  assert.ok(page.includes("demo-rules"));
  assert.ok(page.includes("Играть демо-бой"));
});

test("10-card factions: 5 pairs, 5 in hand; ships exist before card draw", () => {
  assert.equal(CARD_TYPES.length, 5);
  const g = createGame("deck-check");
  for (const side of ["A", "B"]) {
    assert.equal(g.fleets[side].hand.length, 5);
    assert.equal(g.fleets[side].units.length, 3);
    assert.equal(g.fleets[side].dice.length, 0);
  }
});

test("opening 3 cards + ship modules produce 10 dice and exactly 3 commands per side", () => {
  const g = draftAndPlace(createGame("first-round"));
  for (const side of ["A", "B"]) {
    assert.equal(g.fleets[side].dice.length, 10);
    assert.equal(g.fleets[side].activeCards.length, 3);
    const commands = g.queue.filter(q => q.side === side);
    assert.equal(commands.length, 3);
    assert.ok(commands.every(q => q.cardId && q.cardName));
  }
  for (let i = 1; i < g.queue.length; i++) {
    assert.ok(g.queue[i].wave > g.queue[i-1].wave ||
      g.queue[i].initiative <= g.queue[i-1].initiative);
  }
});

test("one ship cannot receive 3 command cards in one round", () => {
  let g = createGame("overload");
  g = chooseCards(g, g.fleets.A.hand.slice(0,3).map(c => c.id));
  g = chooseCards(g, g.fleets.B.hand.slice(0,3).map(c => c.id));
  assert.equal(g.phase, "place");
  const shipId = g.fleets.A.units[0].id;
  const illegal = Object.fromEntries(g.fleets.A.activeCards.map(c => [c.id,shipId]));
  assert.equal(placeCards(g, illegal), g);
});

test("passing an activation never spends dice", () => {
  const g = draftAndPlace(createGame("pass-test"));
  const turn = turnOf(g);
  const oldCount = g.fleets[turn.side].dice.length;
  const next = tryAction(g,{kind:"pass",diceIds:[]});
  assert.notEqual(g,next);
  assert.equal(next.fleets[turn.side].dice.length,oldCount);
  assert.notEqual(next.index,g.index);
});

test("a fired attack consumes die and shield can absorb the hit", () => {
  let g = draftAndPlace(createGame("attack-test"));
  const turn = turnOf(g);
  const fleet = g.fleets[turn.side];
  const enemy = g.fleets[turn.side === "A" ? "B" : "A"];
  const attack = fleet.dice.find(d => d.type === "attack");
  assert.ok(attack);
  const target = enemy.units[0].id;
  const before = fleet.dice.length;
  g = tryAction(g,{kind:"fire",diceIds:[attack.id],targetId:target});
  assert.equal(g.fleets[turn.side].dice.length,before - 1);
  assert.equal(g.fleets[turn.side].dice.some(d => d.id===attack.id),false);
  if (g.phase === "react") {
    const r = g.pending;
    const defense = g.fleets[r.defender].dice.find(d => d.type==="defense");
    g = resolveReaction(g,defense ? defense.id : null);
  }
  assert.notEqual(g.phase,"react");
});

test("all turns finish, stored dice and card placements survive rounds", () => {
  for (let seed=0;seed<40;seed++) {
    let g = createGame("full-"+seed), steps=0, firstRoundCards={};
    while(g.phase!=="done" && steps++<100) {
      if(g.phase==="draft") {
        const round = g.round;
        for (const side of ["A","B"]) {
          const ids = g.drafting === "B" ? aiDraftChoice(g) :
            g.fleets.A.hand.slice(0,round===1?3:1).map(c=>c.id);
          g=chooseCards(g,ids);
        }
        for (const side of ["A","B"]) {
          const before = firstRoundCards[side] || [];
          const map = suggestedAssignments(g,side);
          assert.ok(before.every(c => g.fleets[side].activeCards.some(d => d.id===c)));
          firstRoundCards[side]=g.fleets[side].activeCards.map(c=>c.id);
          g=placeCards(g,map);
        }
      } else if(g.phase==="react") {
        const defender=g.pending.defender, defense=g.fleets[defender].dice.find(d=>d.type==="defense");
        g=resolveReaction(g,defender==="B"?aiReactionChoice(g):
          defense && g.pending.damage>=2 ? defense.id : null);
      } else {
        const turn=turnOf(g), fleet=g.fleets[turn.side], target=g.fleets[turn.side==="A"?"B":"A"].units.find(u=>u.hp>0);
        if(turn.side==="B") g=tryAction(g,aiActionChoice(g));
        else {
          const die=fleet.dice.find(d=>d.type==="attack");
          g=tryAction(g,die && target ? {kind:"fire",diceIds:[die.id],targetId:target.id}
            : {kind:"pass",diceIds:[]});
        }
      }
    }
    assert.equal(g.phase,"done","seed "+seed);
    assert.ok(steps<100);
    assert.ok(fleetHp(g.fleets.A)>=0 && fleetHp(g.fleets.B)>=0);
  }
});


test("glory rewards fragile ships, not high-health ships; equal possible starting totals", () => {
  const g = createGame("points");
  const weights = Object.fromEntries(
    [...g.fleets.A.units,...g.fleets.B.units].map(u=>[u.role,u.glory])
  );
  assert.deepEqual(weights, {
    scout:6,destroyer:4,cruiser:1,
    interceptor:5,frigate:4,dreadnought:2,
  });
  assert.equal(victoryPoints(g.fleets.A),11);
  assert.equal(victoryPoints(g.fleets.B),11);
  assert.ok(g.fleets.A.units.find(u=>u.role==="cruiser").glory <
    g.fleets.A.units.find(u=>u.role==="scout").glory);
});

test("the winner uses ONLY points from living ships, never remaining HP", () => {
  let g = draftAndPlace(createGame("hp-is-not-victory"));
  // A fleet is nearly destroyed but still has all three surviving ships.
  for(const u of g.fleets.A.units)u.hp=1;
  for(let n=0;n<80&&g.phase!=="done";n++){
    if(g.phase==="draft"){
      const side=g.drafting;
      g=chooseCards(g,g.fleets[side].hand.slice(0,1).map(c=>c.id));
    }else if(g.phase==="place")g=placeCards(g,suggestedAssignments(g,g.placing));
    else if(g.phase==="activate")g=tryAction(g,{kind:"pass",diceIds:[]});
    else throw Error("unexpected phase "+g.phase);
  }
  assert.equal(g.phase,"done");
  assert.equal(g.result.kind,"draw");
  assert.equal(g.winner,"draw");
  assert.equal(g.result.scoreA,11);
  assert.equal(g.result.scoreB,11);
  assert.notEqual(fleetHp(g.fleets.A),fleetHp(g.fleets.B));
});

test("destroying the final enemy ship ends battle immediately as annihilation", () => {
  let g = draftAndPlace(createGame("total-loss"));
  const first=turnOf(g);
  const enemySide=first.side==="A"?"B":"A";
  const enemy=g.fleets[enemySide];
  enemy.units[0].hp=1;
  enemy.units[1].hp=0;
  enemy.units[2].hp=0;
  enemy.shield=0;
  enemy.dice=[];
  const attack=g.fleets[first.side].dice.find(d=>d.type==="attack");
  assert.ok(attack);
  g=tryAction(g,{kind:"fire",diceIds:[attack.id],targetId:enemy.units[0].id});
  assert.equal(g.phase,"done");
  assert.equal(g.result.kind,"annihilation");
  assert.equal(g.result["lost"+enemySide],3);
  assert.equal(g.result["score"+enemySide],0);
  assert.equal(g.winner,first.side);
});

test("mutual annihilation has a distinct result, should simultaneous losses be possible", () => {
  let g=draftAndPlace(createGame("mutual-loss-boundary"));
  for(const side of ["A","B"])for(const ship of g.fleets[side].units)ship.hp=0;
  g=tryAction(g,{kind:"pass",diceIds:[]});
  assert.equal(g.phase,"done");
  assert.equal(g.result.kind,"mutual-annihilation");
  assert.equal(g.result.scoreA,0);
  assert.equal(g.result.scoreB,0);
  assert.equal(g.winner,"draw");
});

test("balance harness finishes a mix of strategies and records casualties", () => {
  const report=runBalance({gamesPerStrategy:10,seedPrefix:"smoke"});
  assert.equal(report.games,60);
  assert.equal(report.victoriesA+report.victoriesB+report.draws,60);
  assert.ok(report.victoriesA>0&&report.victoriesB>0);
  assert.ok(report.averageDeadPerGame>0);
  assert.equal(report.perStrategy.length,6);
});

test("demo battlefield uses the classic two-sided initiative axis from RIGHT to LEFT", () => {
  const ui = readFileSync(new URL("../app/fleet-test/page.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/fleet-test/fleet-test.css", import.meta.url), "utf8");
  assert.match(ui, /function InitiativeBattlefield\(/);
  assert.match(ui, /ftBattlefieldTop/);
  assert.match(ui, /ftBattlefieldBottom/);
  assert.match(ui, /lineup\.map\(/);
  assert.match(ui, /b\.unit\.initiative - a\.unit\.initiative/);
  assert.match(ui, /ftBattlefieldScroller" dir="rtl"/);
  assert.match(css, /\.ftBattlefieldLine\s*\{[^}]*direction:rtl/s);
  assert.match(css, /\.ftBattlefieldScroller\s*\{[^}]*overflow-x:auto/s);
});

test("all ships display the full special ability and activation status on battlefield cards", () => {
  const ui = readFileSync(new URL("../app/fleet-test/page.jsx", import.meta.url), "utf8");
  assert.match(ui, /data\.cost\.split\("→"\)/);
  assert.match(ui, /ftShipSpecialHead/);
  assert.match(ui, /\{data\.ability\}/);
  assert.match(ui, /\{payment\}/);
  assert.match(ui, /\{effect \|\| data\.cost\}/);
  assert.match(ui, /specialSpent \? "Уже применена"/);
  for (const ship of Object.values(UNIT_TYPES)) {
    assert.ok(ship.ability.length>0);
    assert.ok(ship.cost.includes("→"));
  }
});

test("ship cards are only targetable on opponent's side while old game stays untouched", () => {
  const ui = readFileSync(new URL("../app/fleet-test/page.jsx", import.meta.url), "utf8");
  assert.match(ui, /turn\?\.side !== side/);
  assert.match(ui, /onTarget\(unit\.id\)/);
});

test("one live AI covers every ship special instead of a Hegemony-only stub", () => {
  assert.deepEqual(Object.keys(SPECIAL_PATTERNS).sort(), Object.keys(UNIT_TYPES).sort());
  const engine = readFileSync(new URL("../app/fleet-test/engine.mjs", import.meta.url), "utf8");
  const harness = readFileSync(new URL("../scripts/fleet-balance.mjs", import.meta.url), "utf8");
  assert.equal(engine.includes("if (!turn || turn.side !== \"B\") return null;"), false);
  assert.equal(engine.includes("const cards = g.fleets.B.hand;"), false);
  assert.match(harness, /aiDraftChoice\(game,game\.drafting\)/);
  assert.match(harness, /aiActionChoice\(game,/);
  assert.match(harness, /aiReactionChoice\(game\)/);
  assert.equal(harness.includes("function chooseAction"), false);
  assert.equal(harness.includes("function combinations"), false);
});

test("AI uses League scout special, not only Hegemony interceptor/frigate/dreadnought", () => {
  const g = draftAndPlace(createGame("scout-special"));
  const scout = g.fleets.A.units.find(u => u.role === "scout");
  g.queue = [{ side: "A", id: scout.id, role: "scout", initiative: 8, wave: 1, cardId: "cmd", cardName: "Наведение" }];
  g.index = 0;
  g.phase = "activate";
  g.specialUsed = { A: [], B: [] };
  g.fleets.A.dice = [
    { id: "tech-special", type: "tech", value: 2 },
    { id: "attack-boost", type: "attack", value: 1 },
  ];
  const action = aiActionChoice(g);
  assert.equal(action.kind, "special");
  assert.deepEqual(action.diceIds, ["tech-special"]);
  const next = tryAction(g, action);
  assert.notEqual(next, g);
  assert.equal(next.fleets.A.dice.some(d => d.id === "tech-special"), false);
  assert.equal(next.fleets.A.dice.find(d => d.id === "attack-boost").value, 3);
});

test("AI reaction spends a shield on a 1-damage hit that would kill the ship", () => {
  const g = draftAndPlace(createGame("lethal-react"));
  const unit = g.fleets.A.units[0];
  unit.hp = 1;
  g.phase = "react";
  g.pending = { attacker: "B", defender: "A", target: unit.id, damage: 1, original: 1 };
  g.fleets.A.dice = [{ id: "shield-1", type: "defense", value: 1 }, ...g.fleets.A.dice.filter(d => d.type !== "defense")];
  assert.equal(aiReactionChoice(g), "shield-1");
  const next = resolveReaction(g, aiReactionChoice(g));
  assert.equal(next.fleets.A.units.find(u => u.id === unit.id).hp, 1);
  assert.equal(next.fleets.A.dice.some(d => d.id === "shield-1"), false);
});

test("shared AI finishes a full draft-place-activate-react-next-round chain for both sides", () => {
  const { game, actions } = simulateBattle("chain-both-sides-01", "finish", "value");
  assert.equal(game.phase, "done");
  assert.ok(actions > 4);
  assert.ok(["A", "B", "draw"].includes(game.winner));
  assert.equal(victoryPoints(game.fleets.A), game.result.scoreA);
  assert.equal(victoryPoints(game.fleets.B), game.result.scoreB);
});
