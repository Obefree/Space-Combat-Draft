// Smoke/balance sample using the actual /fleet-test state transitions.
import {pathToFileURL} from 'node:url';
import {createGame,aiStep} from '../app/fleet-test/engine.mjs';
export function runBalance(count=250) {
 const result={games:count,A:0,B:0,rounds:0};
 for(let i=0;i<count;i++) {let g=createGame('balance-'+i),steps=0;while(g.phase!=='done'){if(steps++>100)throw new Error('Battle stalled: '+i);const next=aiStep(g);if(next===g)throw new Error('Illegal AI move: '+i);g=next;}result[g.winner]++;result.rounds+=g.round;}
 return result;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)console.log(JSON.stringify(runBalance(Number(process.argv[2])||250),null,2));
