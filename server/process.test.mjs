import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { run } from './kido.mjs';

const childScript = (file) =>
  `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(`setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(file)},'orphan'),700)`)}],{stdio:'ignore'});process.stdout.write('ready\\n');setInterval(()=>{},1000);`;

async function ready(child) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    await once(child.stdout, 'data', { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

test('command termination kills descendants before another validation can start', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'wish-process-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'orphan');
  const pending = run(process.execPath, ['-e', childScript(file)], { timeout: 20000 });
  const rejected = assert.rejects(pending);
  await ready(pending.child);
  // execFile uses this same signal when its timeout expires; readiness avoids
  // confusing a slow process start under suite load with successful cleanup.
  pending.child.kill('SIGTERM');
  await rejected;
  await delay(900);
  await assert.rejects(access(file), { code: 'ENOENT' });
});

test('server process death terminates the command process group', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'wish-process-crash-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const marker = join(dir, 'orphan');
  const parent = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import {run} from ${JSON.stringify(new URL('./kido.mjs', import.meta.url).href)};const p=run(process.execPath,['-e',${JSON.stringify(childScript(marker))}]);p.child.stdout.pipe(process.stdout);await p;`,
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );
  t.after(() => parent.kill('SIGKILL'));
  await ready(parent);
  parent.kill('SIGKILL');
  await delay(1000);
  await assert.rejects(access(marker), { code: 'ENOENT' });
});
