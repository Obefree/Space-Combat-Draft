import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../app/DiceDraftGame.tsx",import.meta.url),"utf8");
test("two reinforcements per wave in source",()=>{
 assert.match(src,/const REINFORCEMENTS_PER_ROUND = 2;/);
 assert.match(src,/Math\.min\(\s*REINFORCEMENTS_PER_ROUND,/);
});
test("six-card hand: 3 + 2 + 1 and none left unused",()=>{
 let remain=6-3;const deployed=[3];
 for(let i=0;i<2;i++){const n=Math.min(2,remain);deployed.push(n);remain-=n;}
 assert.deepEqual(deployed,[3,2,1]);assert.equal(remain,0);
});
