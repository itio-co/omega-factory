import { spawn } from 'node:child_process';

/** Kernel-owned local lock; a server crash closes stdin and releases it. Never unlink the lock file. */
export async function lockFile(file, { wait = false } = {}) {
  const child = spawn(
    'flock',
    [
      ...(wait ? ['--wait', '300'] : ['--nonblock']),
      file,
      process.execPath,
      '--input-type=module',
      '-e',
      'process.stdout.write("locked\\n"); process.stdin.resume();',
    ],
    { stdio: ['pipe', 'pipe', 'ignore'] },
  );
  const exited = new Promise((resolve) => child.once('exit', resolve));
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', () => reject(new Error('Wish storage locked or flock unavailable')));
    child.stdout.once('data', () => resolve());
  });
  return async () => {
    child.stdin.end();
    await exited;
  };
}
