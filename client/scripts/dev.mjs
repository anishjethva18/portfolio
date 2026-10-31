import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectDirectory = resolve(clientDirectory, '..');
const serverRequire = createRequire(resolve(projectDirectory, 'server', 'package.json'));
const { parse: parseDotenv } = serverRequire('dotenv');
const serverEnvPath = resolve(projectDirectory, 'server', '.env');
let serverEnvironment = {};
try {
  serverEnvironment = parseDotenv(readFileSync(serverEnvPath));
} catch (error) {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
    throw error;
  }
}
const viteArguments = process.argv.slice(2);
const explicitVitePortIndex = viteArguments.indexOf('--port');
const explicitVitePort = explicitVitePortIndex >= 0
  ? viteArguments[explicitVitePortIndex + 1]
  : viteArguments.find((argument) => argument.startsWith('--port='))?.slice('--port='.length);
const vitePort = /^\d+$/.test(explicitVitePort || '') ? explicitVitePort : '5173';
const apiPort = Number.parseInt(process.env.PORT || serverEnvironment.PORT || '3000', 10);
const apiProxyTarget = process.env.API_PROXY_TARGET
  || serverEnvironment.API_PROXY_TARGET
  || `http://127.0.0.1:${apiPort}`;
const children = [];
let shuttingDown = false;
let shutdownPromise;
let interruptCount = 0;
let secondInterruptTimer;
const shutdownGracePeriodMs = 12_000;

function requestApiShutdown(child) {
  if (!child || child.exitCode !== null || !child.connected) return;

  child.send({ type: 'shutdown' }, (error) => {
    if (error) console.error('[dev] Could not request graceful API shutdown:', error);
  });
}

function terminateChildren() {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    try {
      child.kill();
    } catch (error) {
      console.error(`[dev] Could not terminate ${child.label}:`, error);
    }
  }
}

function waitForChildren() {
  return Promise.all(children.map((child) => {
    if (child.exitCode !== null) return Promise.resolve();
    return new Promise((resolve) => child.once('close', resolve));
  }));
}

async function stop(exitCode, reason) {
  if (shutdownPromise) return shutdownPromise;

  shuttingDown = true;
  process.exitCode = exitCode;
  console.log(`[dev] Stopping development processes after ${reason}.`);

  const apiServer = children.find((child) => child.label === 'API server');
  requestApiShutdown(apiServer);

  shutdownPromise = (async () => {
    let graceTimer;
    const childrenClosed = waitForChildren();
    const graceExpired = new Promise((resolve) => {
      graceTimer = setTimeout(resolve, shutdownGracePeriodMs);
    });

    await Promise.race([childrenClosed, graceExpired]);
    clearTimeout(graceTimer);

    if (children.some((child) => child.exitCode === null)) {
      console.error('[dev] Shutdown timed out; terminating remaining development child processes.');
      terminateChildren();
      await Promise.race([
        childrenClosed,
        new Promise((resolve) => setTimeout(resolve, 3_000)),
      ]);
    }

    const remaining = children.filter((child) => child.exitCode === null);
    if (remaining.length) {
      console.error(`[dev] Child processes did not exit: ${remaining.map((child) => child.label).join(', ')}.`);
      process.exitCode = 1;
    }
    if (secondInterruptTimer) clearTimeout(secondInterruptTimer);
  })();

  return shutdownPromise;
}

function start(label, args, cwd) {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: label === 'API server' ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit',
    env: label === 'API server'
      ? {
          ...process.env,
          PORTFOLIO_DEV_API_ONLY: 'true',
          PORTFOLIO_VITE_PORT: vitePort,
        }
      : { ...process.env, API_PROXY_TARGET: apiProxyTarget },
  });
  child.label = label;
  children.push(child);

  child.on('error', (error) => {
    console.error(`[dev] Could not start ${label}:`, error);
    void stop(1, `${label} spawn failure`);
  });
  child.on('close', (code, signal) => {
    if (!shuttingDown) {
      if (signal) console.error(`[dev] ${label} stopped after ${signal}.`);
      else console.error(`[dev] ${label} exited unexpectedly with code ${code}.`);
      void stop(code ?? 1, `${label} exited unexpectedly`);
    }
  });

  return child;
}

async function waitForApi(child) {
  const healthUrl = `http://127.0.0.1:${apiPort}/api/health`;
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

process.on('SIGINT', () => {
  interruptCount += 1;
  if (interruptCount === 1) {
    void stop(0, 'Ctrl+C');
    return;
  }

  console.error('[dev] Second Ctrl+C received; allowing cleanup briefly before terminating remaining child processes.');
  requestApiShutdown(children.find((child) => child.label === 'API server'));
  if (!secondInterruptTimer) {
    secondInterruptTimer = setTimeout(() => {
      terminateChildren();
    }, 5_000);
  }
});
process.on('SIGTERM', () => {
  void stop(0, 'SIGTERM');
});

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
    ...viteArguments,
  ], clientDirectory);
}

run().catch((error) => {
  console.error('[dev] Could not start the development environment:', error.message);
  void stop(1, 'startup failure');
});
