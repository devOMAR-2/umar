// Development: Sass watcher + static server in one process. Zero dependencies.
// Usage: npm run dev   (PORT env var overrides the default 5173)
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, start } from './serve.mjs';

const isWin = process.platform === 'win32';
const sassBin = join(ROOT, 'node_modules', '.bin', isWin ? 'sass.cmd' : 'sass');

const sass = spawn(isWin ? `"${sassBin}"` : sassBin, ['--watch', 'scss/main.scss', 'css/main.css'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: isWin,
});

sass.on('error', (err) => {
  console.error(`Could not start Sass (${err.message}). Did you run "npm install"?`);
  shutdown(1);
});
sass.on('exit', (code, signal) => {
  if (!shuttingDown) {
    console.error(`Sass exited (${signal ?? code}).`);
    shutdown(code ?? 1);
  }
});

const server = start();

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  if (sass.exitCode === null && !sass.killed) {
    if (isWin) {
      // With shell:true the child is cmd.exe; kill the whole tree.
      spawn('taskkill', ['/pid', String(sass.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      sass.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(code), 200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
