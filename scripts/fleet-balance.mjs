// Reproducible sample using the exact live random-scenario rules and AI.
import {pathToFileURL} from 'node:url';
import {createGame,aiStep,availableDice,canPay,UNIT_TYPES,victoryPoints} from '../app/fleet-test/engine.mjs';
export function runBalance(count=250) {
 const result={games:count,A:0,B:0,rounds:0,unequalStarts:0,averageStartingDice:0,cheapReadyPercent:0,strongReadyPercent:0};let dice=0,cheap=0,strong=0,ships=0;
 for(let i=0;i<count;i++) {let g=createGame('balance-'+i,'solo','B','random'),steps=0;
  if(victoryPoints(g.fleets.A)!==victoryPoints(g.fleets.B))result.unequalStarts++;
  for(const side of ['A','B']){const pool=availableDice(g,side);dice+=pool.length;for(const unit of g.fleets[side].units){ships++;if(canPay(pool,UNIT_TYPES[unit.role].abilities[0].cost))cheap++;if(canPay(pool,UNIT_TYPES[unit.role].abilities[1].cost))strong++;}}
  while(g.phase!=='done'){if(steps++>100)throw new Error('Battle stalled: '+i);const next=aiStep(g);if(next===g)throw new Error('Illegal AI move: '+i);g=next;}result[g.winner]++;result.rounds+=g.round;
 }
 result.averageStartingDice=dice/(2*count);result.cheapReadyPercent=100*cheap/ships;result.strongReadyPercent=100*strong/ships;return result;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)console.log(JSON.stringify(runBalance(Number(process.argv[2])||250),null,2));
