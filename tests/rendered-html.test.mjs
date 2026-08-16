import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Space Combat Draft shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Space Combat Draft — боевой прототип<\/title>/);
  assert.match(html, /Космическая боевая система/);
  assert.match(html, /10 карт в колоде/);
  assert.match(html, /случайно берутся 6 в руку/);
  assert.match(html, /3 корабля на старт/);
  assert.match(html, /2 раунда подкреплений по 1/);
  assert.match(html, /общий пул своего игрока/);
  assert.match(html, /\/card-art\/space\/space-card-cover-v1\.png/);
});

test("keeps the space combat rules encoded in source", async () => {
  const source = await readFile(
    new URL("../app/DiceDraftGame.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const PLAYER_DECK_SIZE = 10;/);
  assert.match(source, /const OPENING_CARDS_PER_PLAYER = 3;/);
  assert.match(source, /const REINFORCEMENT_ROUNDS = 2;/);
  assert.match(source, /const REINFORCEMENTS_PER_ROUND = 1;/);
  assert.match(source, /const BATTLE_HAND_SIZE = 6;/);
  assert.match(source, /const SPACE_CARD_COVER_ART = "\/card-art\/space\/space-card-cover-v1\.png";/);
  assert.match(source, /const SYMMETRIC_DECK_CARD_IDS = \[/);
  assert.match(source, /function makeRandomBattle\(cards: CardData\[\], seedText: string\): GameState/);
  assert.match(source, /hand: deckA\.slice\(0, BATTLE_HAND_SIZE\)/);
  assert.match(source, /hand: deckB\.slice\(0, BATTLE_HAND_SIZE\)/);
  assert.match(source, /function confirmDeploymentSelection\(state: GameState\): GameState/);
  assert.match(source, /phase: "deploy_select"/);
  assert.match(source, /function HandsOverview/);
  assert.match(source, /function CardInspectModal/);
  assert.match(source, /pools: Record<PlayerId, Die\[]>;/);
  assert.match(source, /deployOneCreature\(nextState, playerId, card, pools\)/);
  assert.doesNotMatch(source, /needsDie:\s*true/);
  assert.doesNotMatch(source, /type Phase = "loading" \| "draft"/);
  assert.doesNotMatch(source, /deck_select/);
  assert.doesNotMatch(source, /selectedIds\.length !== 8/);
  assert.doesNotMatch(source, /личные кубы на каждой карте/);
});
