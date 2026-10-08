import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { WishStore } from './store.mjs';
import { WishWorker } from './worker.mjs';

async function setup(t, count = 2) {
  const dir = await mkdtemp(join(tmpdir(), 'wish-worker-'));
  const store = await WishStore.open(join(dir, 'wishes.yaml'));
  t.after(async () => {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  });
  await store.mutate((db) => {
    for (let i = 0; i < count; i++) {
      const id = randomUUID(),
        now = new Date().toISOString();
      db.wishes.push({
        id,
        text: `Wish ${i}`,
        status: 'submitted',
        story: {
          id: `20261007120000_wish-${id}`,
          slug: `wish-${id}`,
          path: `omega-factory/202610/20261007120000_wish-${id}`,
        },
        createdAt: now,
        updatedAt: now,
        worker: { status: 'queued' },
      });
    }
  });
  const events = [],
    sha = 'a'.repeat(40);
  const stages = {
    dispatch: async (w, op) => {
      events.push([w.id, 'dispatch']);
      return { sessionUrl: 'https://claude.ai/code/test', operationId: op };
    },
    develop: async (w) => {
      events.push([w.id, 'develop']);
      return { commit: sha };
    },
    validate: async (w) => {
      events.push([w.id, 'validate']);
      return { commit: sha, checks: ['check', 'test', 'test:e2e', 'build'] };
    },
    deploy: async (w) => {
      events.push([w.id, 'deploy']);
      return { commit: sha, environment: 'dev', receipt: 'deployed' };
    },
    recover: async () => null,
  };
  return { store, stages, events, sha };
}

test('runs one existing story through validation and dev deployment before the next', async (t) => {
  const { store, stages, events } = await setup(t);
  const worker = new WishWorker({ store, stages });
  for (let i = 0; i < 8; i++) await worker.tick();
  const wishes = store.read().wishes;
  assert.deepEqual(
    events.map((e) => e[1]),
    ['dispatch', 'develop', 'validate', 'deploy', 'dispatch', 'develop', 'validate', 'deploy'],
  );
  assert.ok(events.slice(0, 4).every((e) => e[0] === wishes[0].id));
  assert.ok(
    wishes.every(
      (w) => w.worker.status === 'deployed' && w.worker.receipts.deploy.environment === 'dev',
    ),
  );
  assert.equal(await worker.tick(), false);
});

test('waits for development and prevents overlapping ticks', async (t) => {
  const { store, stages, events } = await setup(t);
  stages.develop = async () => null;
  const worker = new WishWorker({ store, stages });
  await Promise.all([worker.tick(), worker.tick(), worker.tick()]);
  for (let i = 0; i < 3; i++) await worker.tick();
  assert.equal(events.length, 1);
  assert.equal(store.read().wishes[1].worker.status, 'queued');
});

test('failed validation never deploys and records the failed stage before continuing', async (t) => {
  const { store, stages, events } = await setup(t);
  stages.validate = async () => {
    throw new Error('Tests failed');
  };
  const worker = new WishWorker({ store, stages });
  for (let i = 0; i < 4; i++) await worker.tick();
  assert.equal(store.read().wishes[0].worker.status, 'failed');
  assert.equal(store.read().wishes[0].worker.error.stage, 'validate');
  assert.equal(events.filter((e) => e[1] === 'deploy').length, 0);
  assert.equal(events.at(-1)[0], store.read().wishes[1].id);
});

test('expired ambiguous deployment is never replayed; an existing receipt recovers it', async (t) => {
  const { store, stages, events, sha } = await setup(t, 1);
  const worker = new WishWorker({ store, stages });
  for (let i = 0; i < 3; i++) await worker.tick();
  await store.mutate((db) => {
    Object.assign(db.wishes[0].worker, {
      stage: 'deploy',
      inFlight: true,
      owner: 'dead-worker',
      leaseUntil: '2000-01-01T00:00:00.000Z',
      operationId: 'previous-deploy',
    });
  });
  await new WishWorker({ store, stages }).tick();
  assert.equal(store.read().wishes[0].worker.status, 'attention');
  assert.equal(events.filter((e) => e[1] === 'deploy').length, 0);
  stages.recover = async () => ({ commit: sha, environment: 'dev', receipt: 'existing receipt' });
  await new WishWorker({ store, stages }).tick();
  assert.equal(store.read().wishes[0].worker.status, 'deployed');
  assert.equal(events.filter((e) => e[1] === 'deploy').length, 0);
});

test('does not steal fresh leases and rejects receipts for a different commit or production', async (t) => {
  const { store, stages } = await setup(t, 1);
  const worker = new WishWorker({ store, stages });
  await worker.tick();
  await store.mutate((db) => {
    db.wishes[0].worker.owner = 'other';
    db.wishes[0].worker.leaseUntil = '2099-01-01T00:00:00.000Z';
  });
  assert.equal(await new WishWorker({ store, stages }).tick(), false);
  await store.mutate((db) => {
    db.wishes[0].worker.leaseUntil = '2000-01-01T00:00:00.000Z';
  });
  const resumed = new WishWorker({ store, stages });
  await resumed.tick();
  await resumed.tick();
  stages.deploy = async () => ({
    commit: 'b'.repeat(40),
    environment: 'production',
    receipt: 'wrong',
  });
  await resumed.tick();
  assert.equal(store.read().wishes[0].worker.status, 'attention');
});

test('simultaneous worker instances cannot dispatch the same Wish', async (t) => {
  const { store, stages, events } = await setup(t, 1);
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const dispatch = stages.dispatch;
  stages.dispatch = async (...args) => {
    await gate;
    return dispatch(...args);
  };
  const a = new WishWorker({ store, stages }),
    b = new WishWorker({ store, stages });
  const running = Promise.all([a.tick(), b.tick()]);
  setTimeout(release, 100);
  await running;
  assert.equal(events.filter((e) => e[1] === 'dispatch').length, 1);
});

test('records a definite deployment failure and never repeats it automatically', async (t) => {
  const { store, stages, events } = await setup(t);
  stages.deploy = async () => {
    const error = new Error('Deployment exited nonzero with a receipt');
    error.definite = true;
    throw error;
  };
  const worker = new WishWorker({ store, stages });
  for (let i = 0; i < 5; i++) await worker.tick();
  const rows = store.read().wishes;
  assert.equal(rows[0].worker.status, 'failed');
  assert.equal(rows[0].worker.error.stage, 'deploy');
  assert.equal(rows[0].worker.inFlight, false);
  assert.equal(events.at(-1)[0], rows[1].id);
  assert.equal(events.filter((e) => e[0] === rows[0].id && e[1] === 'dispatch').length, 1);
});

test('temporary brain polling failure keeps the existing remote Wish ahead of the queue', async (t) => {
  const { store, stages, events } = await setup(t);
  stages.develop = async () => {
    throw new Error('Temporary fetch failure');
  };
  const worker = new WishWorker({ store, stages });
  for (let i = 0; i < 4; i++) await worker.tick();
  assert.equal(store.read().wishes[0].worker.status, 'running');
  assert.equal(store.read().wishes[1].worker.status, 'queued');
  assert.equal(events.filter((e) => e[1] === 'dispatch').length, 1);
});
