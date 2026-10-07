import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import yaml from 'js-yaml';
import { WishStore } from './store.mjs';
import { createWishServer } from './http.mjs';

async function fixture(
  t,
  createStory = async (w) => ({
    id: `20261007120000_wish-${w.id}`,
    slug: `wish-${w.id}`,
    path: `omega-factory/202610/20261007120000_wish-${w.id}`,
  }),
) {
  const dir = await mkdtemp(join(tmpdir(), 'wish-api-'));
  const file = join(dir, 'wishes.yaml');
  let store, server;
  async function start() {
    store = await WishStore.open(file);
    server = createWishServer({
      store,
      createStory,
      rateLimit: 100,
      origins: ['http://localhost:5173'],
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
  }
  async function stop() {
    await new Promise((r) => server.close(r));
    await store.close();
  }
  await start();
  t.after(async () => {
    await stop();
    await rm(dir, { recursive: true, force: true });
  });
  return {
    file,
    get store() {
      return store;
    },
    restart: async () => {
      await stop();
      await start();
    },
    post: (body, headers = {}) =>
      fetch(`http://127.0.0.1:${server.address().port}/api/wishes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
  };
}

test('persists Unicode and multiline wishes across restart; duplicate identity reuses the same story', async (t) => {
  let calls = 0;
  const f = await fixture(t, async (w) => {
    calls++;
    return {
      id: `20261007120000_wish-${w.id}`,
      slug: `wish-${w.id}`,
      path: `omega-factory/202610/20261007120000_wish-${w.id}`,
    };
  });
  const body = { requestId: randomUUID(), text: 'อยากได้ 🌱\n  More factories: yes # please\n' };
  const first = await f.post(body);
  assert.equal(first.status, 201);
  const result = await first.json();
  assert.equal(result.status, 'submitted');
  assert.equal(result.id, body.requestId);
  assert.match(result.story.id, /_wish-/);
  await f.restart();
  assert.equal((await f.post(body)).status, 200);
  assert.equal(calls, 1);
  const saved = yaml.load(await readFile(f.file, 'utf8'));
  assert.equal(saved.wishes.length, 1);
  assert.equal(saved.wishes[0].text, body.text);
});

test('serializes concurrent writes and retries without losing entries or duplicating stories', async (t) => {
  const f = await fixture(t);
  const bodies = Array.from({ length: 15 }, (_, i) => ({
    requestId: randomUUID(),
    text: `Wish ${i}`,
  }));
  const responses = await Promise.all([...bodies, ...bodies].map((b) => f.post(b)));
  assert.ok(responses.every((r) => [200, 201].includes(r.status)));
  assert.equal(yaml.load(await readFile(f.file, 'utf8')).wishes.length, 15);
});

test('saved but unlinked wishes return pending and reconcile on retry', async (t) => {
  let calls = 0;
  const f = await fixture(t, async (w) => {
    if (++calls === 1) throw new Error('private path and secret must not leak');
    return {
      id: `20261007120000_wish-${w.id}`,
      slug: `wish-${w.id}`,
      path: `omega-factory/202610/20261007120000_wish-${w.id}`,
    };
  });
  const b = { requestId: randomUUID(), text: 'Better conveyors' };
  const pending = await f.post(b);
  assert.equal(pending.status, 202);
  assert.equal((await pending.json()).story, null);
  await f.restart();
  assert.equal((await f.post(b)).status, 200);
  assert.equal(yaml.load(await readFile(f.file, 'utf8')).wishes.length, 1);
});

test('rejects invalid input, conflicting retries, large bodies and disallowed origins', async (t) => {
  const f = await fixture(t);
  const b = { requestId: randomUUID(), text: 'A wish' };
  assert.equal((await f.post(b)).status, 201);
  assert.equal((await f.post({ ...b, text: 'Changed' })).status, 409);
  for (const bad of [
    '{',
    null,
    { text: 'x' },
    { ...b, text: '  ' },
    { ...b, text: 'x'.repeat(4001) },
  ]) {
    assert.equal((await f.post(bad)).status, 400);
  }
  assert.equal((await f.post('x'.repeat(32769))).status, 413);
  assert.equal((await f.post(b, { origin: 'https://attacker.example' })).status, 403);
  assert.equal((await f.post(b, { 'content-type': 'text/plain' })).status, 415);
});

test('storage rejects a second live writer and corrupted YAML without discarding data', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'wish-store-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'wishes.yaml');
  const s = await WishStore.open(file);
  await assert.rejects(WishStore.open(file), /locked/);
  await s.close();
  await writeFile(file, 'version: 99\nwishes: broken\n');
  await assert.rejects(WishStore.open(file), /invalid|version/);
  assert.match(await readFile(file, 'utf8'), /99/);
});

test('UUID letter case cannot create another Wish or strand story confirmation', async (t) => {
  const f = await fixture(t);
  const id = '83f712a7-1b07-4f74-bb47-dd06b3c9b792';
  const first = await f.post({ requestId: id.toUpperCase(), text: 'One idea' });
  assert.equal(first.status, 201);
  assert.equal((await first.json()).id, id);
  assert.equal((await f.post({ requestId: id, text: 'One idea' })).status, 200);
  assert.equal(f.store.read().wishes.length, 1);
});
