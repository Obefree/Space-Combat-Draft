import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

function assertOrphanFree(source, names) {
  for (const name of names) {
    const definitions = source.match(new RegExp(`function\\s+${name}\\s*\\(`, "g")) ?? [];
    const calls = source.match(new RegExp(`\\b${name}\\s*\\(`, "g")) ?? [];
    assert.equal(definitions.length, 1, `${name} must have exactly one definition`);
    assert.ok(
      calls.length > definitions.length,
      `${name} is defined but the call chain never reaches it, or callers were left after the definition was deleted`,
    );
  }
}

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(path, "http://localhost/"), {
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
  assert.match(source, /function chargeActiveCreature\(state: GameState\): GameState/);
  assert.match(source, /function chooseChargeDice\(/);
  assert.match(source, /function resolveAbility\(/);
  assertOrphanFree(source, [
    "chargeActiveCreature",
    "chooseChargeDice",
    "confirmDeploymentSelection",
    "resolveAbility",
    "advanceActivation",
    "deployOneCreature",
    "addDiceToCreature",
    "findPayment",
  ]);
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

test("serves the fleet demo at its direct URL", async () => {
  const response = await render("/fleet-test");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Инициативный бой флотов/);
  assert.match(html, /Линия инициативы — слева направо/);
  assert.match(html, /ftBattlefieldTop/);
  assert.match(html, /ftBattlefieldBottom/);
  assert.match(html, /Одна тактика на этот раунд/);
  // Single-screen cockpit: battlefield, live dice and hand share one layout.
  assert.match(html, /class="ftCombatDesk"/);
  assert.match(html, /class="ftDiceDock"/);
  assert.match(html, /class="ftHandDock"/);
  assert.match(html, /class="ftTactics"/);
  assert.match(html, /Очередь и журнал боя/);
  assert.match(html, /Повторить seed/);
  assert.match(html, /Обе карты раскроются/);
  assert.match(html, /Даёт кубы в общий пул/);
  assert.match(html, /ДЕМО v0.4/);
  assert.equal((html.match(/ftAbilityField/g) || []).length, 12);
  assert.match(html, /Текущая рука противника/);
  assert.equal((html.match(/class="ftCardBack"/g) || []).length, 7);
  const opponentHand = html.slice(html.indexOf('Текущая рука противника'), html.indexOf('Сыгранные карты противника'));
  assert.doesNotMatch(opponentHand, /Боевой натиск|Подкрепление|Ускорение флота|Защитная реакция|Вторая активация|ftAbilityField/);
  assert.match(html, /Сыгранные карты противника/);
  assert.match(html, /Общий пул кубов противника/);
  // In a sealed draft no ship is active: none of its abilities should look selected/ready.
  assert.doesNotMatch(html, /class="ftAbilityField ftAbilityReady"/);
  assert.match(html, /ftPhaseGuide/);
  assert.match(html, /Ваш выбор · одна тактика/);
  assert.doesNotMatch(html, /Полный экран/);
  assert.doesNotMatch(html, /за выживание|назначь исполнителей|КОМАНДНЫЕ КАРТЫ/);
  assert.match(html, /href="\/"/);
  assert.match(html, /Противник ещё выбирает тактику взакрытую/);
  assert.doesNotMatch(html, /Противник выбрал карту взакрытую/);
});

test("fleet demo keeps one live executor and drops parallel leftovers", async () => {
  const engine = await readFile(new URL("../app/fleet-test/engine.mjs", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/fleet-test/page.jsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/fleet-test/fleet-test.css", import.meta.url), "utf8");
  const helper = await readFile(new URL("./rendered-html.test.mjs", import.meta.url), "utf8");

  assert.match(helper, /async function render\(path = "\/"\)/);
  assertOrphanFree(engine, [
    "tryAction",
    "chooseCards",
    "aiDraftChoice",
    "aiActionChoice",
    "findPayment",
    "playReaction",
    "resolveReaction",
  ]);
  assertOrphanFree(`${engine}\n${page}`, ["aiStep"]);
  assert.doesNotMatch(engine, /export const fleetHp/);
  assert.doesNotMatch(engine, /export const fleetLosses/);
  assert.doesNotMatch(engine, /kind==="special"/);
  assert.match(engine, /action\.kind!=="ability"/);
  assert.match(page, /tacticChoices\[side\]\.cardId/);
  assert.doesNotMatch(page, /ftQueueRtl/);
  assert.doesNotMatch(css, /ftQueueRtl/);
  assert.match(css, /\.ftBoardStage\{[^}]*overflow:hidden/);
});

