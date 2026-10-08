import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { WishStore } from './store.mjs';
import { createWishServer } from './http.mjs';
import { kidoStoryCreator } from './kido.mjs';

const root = resolve(process.env.WISH_PROJECT_ROOT || '.');
const brains = resolve(process.env.WISH_BRAINS || join(root, '.kido/brains'));
const project = process.env.WISH_PROJECT || 'omega-factory';
const skill = resolve(process.env.WISH_KIDO_ROOT || join(homedir(), '.codex/skills/kido'));
const port = Number(process.env.WISH_PORT || 8787);
const rateLimit = Number(process.env.WISH_RATE_LIMIT || 10);
if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535 ||
  !Number.isInteger(rateLimit) ||
  rateLimit < 1
)
  throw new Error('Invalid Wish server port or rate limit');
// Validate the opt-in configuration before acquiring the storage lock.
let stages;
if (process.env.WISH_WORKER_ENABLED === '1') {
  const { claudeStages } = await import('./claude.mjs');
  stages = claudeStages({ root, brains, project, skill });
}
const createStory = kidoStoryCreator({
  root,
  brains,
  project,
  script: join(skill, 'scripts/kido-brain.py'),
});
const store = await WishStore.open(process.env.WISH_STORE || join(root, 'var/wishes.yaml'));
const server = createWishServer({
  store,
  createStory,
  rateLimit,
  origins: (process.env.WISH_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  onError: (error) => console.error('Wish operation failed:', error.message),
});
let worker;
if (process.env.WISH_WORKER_ENABLED === '1') {
  const { WishWorker } = await import('./worker.mjs');
  worker = new WishWorker({ store, stages });
  worker.onError = (error) => console.error('Wish worker failed:', error);
  worker.start();
}
server.listen(port, process.env.WISH_HOST || '127.0.0.1', () =>
  console.log(`Wish API listening on ${process.env.WISH_HOST || '127.0.0.1'}:${port}`),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await new Promise((r) => server.close(r));
  await server.drain();
  await worker?.stop();
  await store.close();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
server.on('error', async (error) => {
  console.error(error.message);
  await stop();
  process.exitCode = 1;
});
