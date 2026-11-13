import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const cards=JSON.parse(readFileSync(new URL("../data/ships.v0.2-experimental.json",import.meta.url),"utf8")).cards;
const ALLOWED=new Set(["damage","heal","self_damage","gain_die","steal_enemy_die","decrease_target_die","heal_two_allies","damage_all_enemies","return_target_die_to_pool","increase_target_ally_die"]);
const options=["attack","defense","magic"].flatMap(type=>[1,2,3].map(value=>({type,value})));
function legal(dice,cost) {
 for(let m=1;m<(1<<dice.length);m++){
  const d=dice.filter((_,i)=>m&(1<<i));
  if(cost.exact_dice&&d.length!==cost.exact_dice)continue;
  if(d.reduce((sum,x)=>sum+x.value,0)<(cost.threshold||0))continue;
  if(Object.entries(cost.requirements||{}).some(([type,n])=>(type==="any"?d.length:d.filter(x=>x.type===type).length)<n))continue;
  if(cost.same_values&&new Set(d.map(x=>x.value)).size!==1)continue;
  if(cost.different_values&&new Set(d.map(x=>x.value)).size!==d.length)continue;
  return true;
 }return false;
}
function combinations(n){const r=[];for(let j=0;j<9**n;j++){let p=j,d=[];for(let i=0;i<n;i++){d.push(options[p%9]);p=Math.floor(p/9);}r.push(d);}return r;}
test("six unique cards with two supported abilities",()=>{
 assert.equal(cards.length,6);assert.equal(new Set(cards.map(c=>c.id)).size,6);
 for(const card of cards){assert.equal(card.abilities.length,2);assert.ok(card.health>0);assert.ok(card.dice.every(d=>["attack","defense","magic"].includes(d)));for(const a of card.abilities)for(const e of a.effects)assert.ok(ALLOWED.has(e.type),e.type);}
});
test("all abilities payable from at most three random dice",()=>{
 for(const card of cards)for(const a of card.abilities)assert.ok(combinations(3).some(d=>legal(d,a.cost)),card.id+"/"+a.id);
});
test("every card has a usable one-die opener",()=>{
 for(const card of cards)assert.ok(combinations(1).some(d=>legal(d,card.abilities[0].cost)),card.id);
});
