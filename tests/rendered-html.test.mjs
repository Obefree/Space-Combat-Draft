import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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
  assert.match(html, /<h1>Space Combat Draft<\/h1>/);
  assert.match(html, /10 карт в колоде/);
  assert.match(html, /случайно берутся 6 в руку/);
  assert.match(html, /3 корабля на старт/);
  assert.match(html, /2 раунда подкреплений по 1/);
  assert.match(html, /резерв игрока/);
  assert.match(html, /активный корабль заряжается ими на свою карту/);
  assert.match(html, /корабль завершает активацию до следующего раунда/);
  assert.match(html, /галерея карт/);
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
  assert.match(source, /const SPACE_CARD_ART_BY_ID: Partial<Record<string, string>> = {/);
  assert.match(source, /type SpaceCardTheme = Partial/);
  assert.match(source, /const SPACE_CARD_THEME_BY_ID: Record<string, SpaceCardTheme>/);
  assert.match(source, /const SYMMETRIC_DECK_CARD_IDS = \[/);
  assert.match(source, /function makeRandomBattle\(cards: CardData\[\], seedText: string\): GameState/);
  assert.match(source, /hand: deckA\.slice\(0, BATTLE_HAND_SIZE\)/);
  assert.match(source, /hand: deckB\.slice\(0, BATTLE_HAND_SIZE\)/);
  assert.match(source, /function confirmDeploymentSelection\(state: GameState\): GameState/);
  assert.match(source, /function chooseChargeDice\(/);
  assert.match(source, /function chargeActiveCreature\(/);
  assert.equal([...source.matchAll(/return chargeActiveCreature\(/g)].length, 3);
  assert.match(source, /confirmDeploymentSelection[\s\S]*return chargeActiveCreature\(/);
  assert.match(source, /startNextRoundOrDeployment[\s\S]*return chargeActiveCreature\(/);
  assert.match(source, /advanceActivation[\s\S]*return chargeActiveCreature\(/);
  assert.match(source, /function resolveAbility\(/);
  assert.match(source, /findPayment\(actor\.attached, ability\.cost\)/);
  assert.match(source, /creature\.attached, ability\.cost/);
  assert.match(source, /function ChargeRack/);
  assert.match(source, /phase: "deploy_select"/);
  assert.match(source, /function HandsOverview/);
  assert.match(source, /function CardInspectModal/);
  assert.match(source, /function CardGalleryModal/);
  assert.match(source, /pools: Record<PlayerId, Die\[]>;/);
  assert.match(source, /deployOneCreature\(nextState, playerId, card, pools\)/);
  assert.match(source, /return advanceActivation\(resolvedState\);/);
  assert.doesNotMatch(source, /needsDie:\s*true/);
  assert.doesNotMatch(source, /type Phase = "loading" \| "draft"/);
  assert.doesNotMatch(source, /deck_select/);
  assert.doesNotMatch(source, /selectedIds\.length !== 8/);
  assert.doesNotMatch(source, /личные кубы на каждой карте/);
});

test("uses space-themed names and abilities instead of legacy card flavor", async () => {
  const source = await readFile(
    new URL("../app/DiceDraftGame.tsx", import.meta.url),
    "utf8",
  );

  for (const text of [
    "Перехватчик «Клинок»",
    "Корсар-похититель",
    "Снайперский фрегат",
    "Командный крейсер",
    "Бастион-накопитель",
    "Эскорт перехвата",
    "Ремонтный крейсер",
    "Реакторная лаборатория",
    "Фазовый нарушитель",
    "Осадный дредноут",
    "Разгон контура",
    "Грабёж конвоя",
    "Осадный протокол",
    "Аварийный щит",
    "Импульс реактора",
    "Короткий залп",
  ]) {
    assert.match(source, new RegExp(text));
  }

  assert.match(source, /steal_enemy_die/);
  assert.match(source, /gain_die/);
  assert.match(source, /damage_all_enemies/);
  assert.match(source, /const themedCards = cards\.map\(applySpaceTheme\);/);
  assert.doesNotMatch(source, /id: `\$\{card\.id\}__light`/);
  assert.doesNotMatch(source, /Простая защита/);
  assert.doesNotMatch(source, /Простая искра/);
  assert.doesNotMatch(source, /Простой удар/);
});

test("has generated space art for each symmetric battle card", async () => {
  const cardIds = [
    "swift_blade",
    "raider",
    "huntress",
    "mercenary_captain",
    "bastion",
    "bodyguard",
    "paladin",
    "alchemist",
    "transmuter",
    "old_veteran",
  ];
  const source = await readFile(
    new URL("../app/DiceDraftGame.tsx", import.meta.url),
    "utf8",
  );

  for (const cardId of cardIds) {
    assert.match(source, new RegExp(`${cardId}: "/card-art/space/generated/${cardId}\\.png"`));
    await access(new URL(`../public/card-art/space/generated/${cardId}.png`, import.meta.url));
  }
});
