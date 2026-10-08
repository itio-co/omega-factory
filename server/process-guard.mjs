// Each command gets its own process group. Parent death closes stdin, so this
// guardian also cleans up descendants after an abrupt server exit.
import { spawn } from 'node:child_process';
const [command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { detached: true, stdio: ['ignore', 'inherit', 'inherit'] });
let stopping = false;
function signalGroup(signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (e) {
    if (e.code !== 'ESRCH') throw e;
  }
}
function stop(code = 1) {
  if (stopping) return;
  stopping = true;
  signalGroup('SIGTERM');
  setTimeout(() => {
    signalGroup('SIGKILL');
    process.exit(code);
  }, 250);
}
child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  stop();
});
child.on('exit', (code) => {
  if (stopping) return;
  // Completed commands may also leave background servers behind.
  signalGroup('SIGKILL');
  process.exit(code ?? 1);
});
process.stdin.resume();
process.stdin.on('end', () => stop());
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());
