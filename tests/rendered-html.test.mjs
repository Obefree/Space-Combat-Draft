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
  assert.match(html, /5 карт в боевой руке/);
  assert.match(html, /3 корабля на старте/);
  assert.match(html, /личные кубы на каждой карте/);
});

test("keeps the space combat rules encoded in source", async () => {
  const source = await readFile(
    new URL("../app/DiceDraftGame.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const OPENING_CARDS_PER_PLAYER = 3;/);
  assert.match(source, /const RESERVE_CARDS_PER_PLAYER = 2;/);
  assert.match(source, /const BATTLE_DECK_SIZE = OPENING_CARDS_PER_PLAYER \+ RESERVE_CARDS_PER_PLAYER;/);
  assert.doesNotMatch(source, /needsDie:\s*true/);
  assert.doesNotMatch(source, /selectedIds\.length !== 8/);
  assert.doesNotMatch(source, /Общий пул кубов/);
});
