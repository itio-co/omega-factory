import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import yaml from 'js-yaml';
import { WishStore } from './store.mjs';
import { createWishServer, clientAddress } from './http.mjs';

async function fixture(
  t,
  createStory = async (w) => ({
    id: `20261007120000_wish-${w.id}`,
    slug: `wish-${w.id}`,
    path: `omega-factory/202610/20261007120000_wish-${w.id}`,
  }),
  options = {},
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
      enabled: true,
      origins: ['http://localhost:5173'],
      ...options,
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
    url: (path) => `http://127.0.0.1:${server.address().port}${path}`,
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

test('an uncertain disk flush cannot let stale memory overwrite the renamed file', async (t) => {
  const { open } = await import('node:fs/promises');
  const f = await fixture(t);
  const directory = await open(tmpdir(), 'r');
  const prototype = Object.getPrototypeOf(directory),
    sync = prototype.sync;
  await directory.close();
  const mocked = t.mock.method(prototype, 'sync', async function () {
    if ((await this.stat()).isDirectory()) throw new Error('simulated directory flush failure');
    return sync.call(this);
  });
  const first = { requestId: randomUUID(), text: 'Survive ambiguous flush' };
  assert.equal((await f.post(first)).status, 503);
  mocked.mock.restore();
  assert.equal(
    (await f.post({ requestId: randomUUID(), text: 'Must wait for restart' })).status,
    503,
  );
  await f.restart();
  assert.equal((await f.post(first)).status, 200);
  assert.deepEqual(
    f.store.read().wishes.map((w) => w.id),
    [first.requestId],
  );
});

test('rejects NUL, C0, DEL and C1 control characters but keeps tab and newline', async (t) => {
  const f = await fixture(t);
  for (const bad of [
    'a\u0000b',
    'bell\u0007',
    'cr\r\n',
    '\u001b[31mred',
    'del\u007f',
    'nel\u0085',
    'csi\u009b2J',
  ]) {
    const response = await f.post({ requestId: randomUUID(), text: bad });
    assert.equal(response.status, 400, JSON.stringify(bad));
    assert.match(response.headers.get('content-type'), /application\/json/);
  }
  assert.equal(f.store.read().wishes.length, 0);
  const ok = { requestId: randomUUID(), text: 'tab\there\nnext line ไทย 🌱' };
  assert.equal((await f.post(ok)).status, 201);
  assert.equal(f.store.read().wishes[0].text, ok.text);
});

test('retries of an existing Wish count against the rate limit, so they cannot repeat Git work', async (t) => {
  let calls = 0;
  const f = await fixture(
    t,
    async () => {
      calls++;
      throw new Error('brain unavailable');
    },
    { rateLimit: 2 },
  );
  const b = { requestId: randomUUID(), text: 'Keep retrying' };
  assert.equal((await f.post(b)).status, 202);
  assert.equal((await f.post(b)).status, 202);
  const limited = await f.post(b);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  assert.equal(calls, 2);
});

test('clientAddress takes the trusted hop from the right of X-Forwarded-For and falls back safely', () => {
  const req = (xff) => ({
    socket: { remoteAddress: '10.244.0.7' },
    headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
  });
  assert.equal(clientAddress(req('203.0.113.5'), 0), '10.244.0.7');
  assert.equal(clientAddress(req('203.0.113.5')), '10.244.0.7');
  assert.equal(clientAddress(req('203.0.113.5'), 1), '203.0.113.5');
  // A client-supplied prefix never changes the key for one trusted hop.
  for (const spoof of ['1.1.1.1, ', 'evil, ', '198.51.100.1, 198.51.100.2, ', ', , '])
    assert.equal(clientAddress(req(`${spoof}203.0.113.5`), 1), '203.0.113.5');
  assert.equal(clientAddress(req('1.1.1.1, 2001:db8::1, 10.0.0.2'), 2), '2001:db8::1');
  for (const bad of [
    undefined,
    '',
    'not-an-ip',
    '203.0.113.5, ',
    '203.0.113.5:443',
    '[2001:db8::1]',
  ])
    assert.equal(clientAddress(req(bad), 1), '10.244.0.7', String(bad));
  assert.equal(clientAddress(req('203.0.113.5'), 2), '10.244.0.7'); // shorter than the trusted chain
});

test('behind one trusted proxy, a spoofed X-Forwarded-For prefix cannot escape the rate limit', async (t) => {
  const f = await fixture(t, undefined, { rateLimit: 1, trustProxy: 1 });
  const wish = () => ({ requestId: randomUUID(), text: 'One per client' });
  assert.equal((await f.post(wish(), { 'x-forwarded-for': '203.0.113.5' })).status, 201);
  for (const spoof of ['198.51.100.9, 203.0.113.5', 'anything, 1.2.3.4, 203.0.113.5'])
    assert.equal((await f.post(wish(), { 'x-forwarded-for': spoof })).status, 429);
  assert.equal((await f.post(wish(), { 'x-forwarded-for': '203.0.113.6' })).status, 201);
  // Without the header the socket address is the key (separate bucket).
  assert.equal((await f.post(wish())).status, 201);
  assert.equal((await f.post(wish())).status, 429);
});

test('the Wish route is off unless enabled (WISH_ENABLED=1) and stores nothing', async (t) => {
  const f = await fixture(t, undefined, { enabled: false });
  const b = { requestId: randomUUID(), text: 'Not yet' };
  const response = await f.post(b);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'Not found' });
  assert.equal((await fetch(f.url('/api/wishes'), { method: 'OPTIONS' })).status, 404);
  assert.equal((await fetch(f.url('/healthz'))).status, 200);
  assert.equal(f.store.read().wishes.length, 0);
  // The factory default is off as well.
  const store = { read: () => ({ wishes: [] }) };
  const server = createWishServer({ store, createStory: async () => {} });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  const port = server.address().port;
  assert.equal(
    (
      await fetch(`http://127.0.0.1:${port}/api/wishes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(b),
      })
    ).status,
    404,
  );
});
