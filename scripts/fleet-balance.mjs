// Deterministic fleet combat balance harness. Runs the EXACT live fleet-test engine.
// No alternate rules engine and no new game/site. 
import { pathToFileURL } from "node:url";
import {
  createGame, chooseCards, suggestedAssignments, placeCards, turnOf,
  tryAction, resolveReaction, victoryPoints,
  aiDraftChoice, aiActionChoice, aiReactionChoice,
} from "../app/fleet-test/engine.mjs";

export const STRATEGIES = [
  { id:"finish", label:"Добивание раненых", A:"finish", B:"finish" },
  { id:"value", label:"Охота за победными очками", A:"value", B:"value" },
  { id:"threat", label:"Устранение угроз", A:"threat", B:"threat" },
  { id:"heavy", label:"Охота за тяжёлыми", A:"heavy", B:"heavy" },
  { id:"mixed-a", label:"Лига за очками / Гегемония за угрозами", A:"value", B:"threat" },
  { id:"mixed-b", label:"Лига за угрозами / Гегемония за очками", A:"threat", B:"value" },
];

export function simulateBattle(seed, aPolicy="finish", bPolicy="finish") {
  let game = createGame(seed, "solo"), operations=0, actions=0;
  while(game.phase!=="done" && operations++<120) {
    const before=game;
    if(game.phase==="draft") game=chooseCards(game,aiDraftChoice(game));
    else if(game.phase==="place") game=placeCards(game,suggestedAssignments(game,game.placing));
    else if(game.phase==="activate") {
      actions++;
      const actor=turnOf(game).side;
      game=tryAction(game,aiActionChoice(game, actor==="A"?aPolicy:bPolicy));
    }
    else if(game.phase==="react") game=resolveReaction(game,aiReactionChoice(game));
    if(game===before) throw Error("Invalid transition in "+seed+" phase="+game.phase);
  }
  if(game.phase!=="done") throw Error("Battle did not finish: "+seed);
  return { game, actions, operations };
}

export function runBalance({gamesPerStrategy=250,seedPrefix="fleet-balance-v1"}={}) {
  const out = {
    version:"fleet-initiative-survivor-glory",
    rules:"Survivors award points; zero HP awards zero points; complete annihilation ends immediately.",
    games:0, victoriesA:0, victoriesB:0, draws:0, killedA:0, killedB:0,
    totalWipesA:0, totalWipesB:0, mutualAnnihilations:0, emptyCasualtyGames:0,
    totalActions:0, finishedEarly:0,
    killedByType:{}, survivedByType:{}, perStrategy:[]
  };
  for(const strat of STRATEGIES) {
    const item = {strategy:strat.id,games:0,winA:0,winB:0,draw:0,killedA:0,killedB:0,wipeA:0,wipeB:0};
    for(let i=0;i<gamesPerStrategy;i++) {
      const {game,actions}=simulateBattle(seedPrefix+"-"+strat.id+"-"+i,strat.A,strat.B);
      const A=game.fleets.A, B=game.fleets.B;
      const lostA=A.units.filter(u=>u.hp===0).length,lostB=B.units.filter(u=>u.hp===0).length;
      if(victoryPoints(A)!==game.result.scoreA || victoryPoints(B)!==game.result.scoreB)
        throw Error("Winner score differs from surviving ships.");
      item.games++;out.games++;out.totalActions+=actions;
      if(game.winner==="A"){out.victoriesA++;item.winA++;}
      else if(game.winner==="B"){out.victoriesB++;item.winB++;}
      else {out.draws++;item.draw++;}
      out.killedA+=lostA;out.killedB+=lostB;item.killedA+=lostA;item.killedB+=lostB;
      if(lostA===3){out.totalWipesA++;item.wipeA++;}
      if(lostB===3){out.totalWipesB++;item.wipeB++;}
      if(lostA===3&&lostB===3)out.mutualAnnihilations++;
      if(lostA+lostB===0)out.emptyCasualtyGames++;
      if(game.round<3)out.finishedEarly++;
      for(const unit of [...A.units,...B.units]) {
        const collection = unit.hp===0 ? out.killedByType : out.survivedByType;
        collection[unit.role]=(collection[unit.role]||0)+1;
      }
    }
    out.perStrategy.push(item);
  }
  out.averageDeadPerGame=Number(((out.killedA+out.killedB)/out.games).toFixed(3));
  out.averageActionsPerGame=Number((out.totalActions/out.games).toFixed(2));
  return out;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const n=Number(process.argv[2]||250);
  if(!Number.isInteger(n)||n<1||n>10000)throw Error("Games per strategy must be 1..10000");
  const report=runBalance({gamesPerStrategy:n});
  console.log(JSON.stringify(report,null,2));
}
