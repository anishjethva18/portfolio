import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectDirectory = resolve(clientDirectory, '..');
const children = [];
let shuttingDown = false;

function stop(exitCode) {
  if (shuttingDown) return;

  shuttingDown = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
}

function start(label, args, cwd) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: label === 'API server'
      ? { ...process.env, PORTFOLIO_DEV_API_ONLY: 'true' }
      : process.env,
    stdio: 'inherit',
  });
  children.push(child);

  child.on('error', (error) => {
    console.error(`[dev] Could not start ${label}:`, error);
    stop(1);
  });
  child.on('close', (code, signal) => {
    if (!shuttingDown) {
      if (signal) console.error(`[dev] ${label} stopped after ${signal}.`);
      if (label === 'API server' && code === 0) return;
      stop(code ?? 1);
    }
  });

  return child;
}

async function waitForApi(child) {
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const healthUrl = `http://127.0.0.1:${port}/api/health`;
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (shuttingDown) {
      throw new Error('The API server stopped before it became ready.');
    }

    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const health = await response.json();
        if (health.service === 'Windows 11 OS Portfolio Server') return;
      }
    } catch {
      // The API is still starting or is not reachable yet.
    }

    if (child.exitCode !== null) {
      throw new Error('The API server stopped before it became ready.');
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`The API server did not become ready at ${healthUrl} within 120 seconds.`);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

async function run() {
  const apiServer = start('API server', [
    '-r',
    './server/loadEnv.cjs',
    '--import=./server/node_modules/tsx/dist/loader.mjs',
    'server/server.ts',
  ], projectDirectory);

  await waitForApi(apiServer);
  if (shuttingDown) return;

  console.log('[dev] API is ready; starting Vite on its normal development port.');
  start('Vite client', [
    './node_modules/vite/bin/vite.js',
    '--strictPort',
    ...process.argv.slice(2),
  ], clientDirectory);
}

run().catch((error) => {
  console.error('[dev] Could not start the development environment:', error.message);
  stop(1);
});
