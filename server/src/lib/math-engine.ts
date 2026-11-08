import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { logger } from './logger';

export const MATH_ORIGIN = 'http://127.0.0.1:8091';
let child: ChildProcess | undefined;
let stopping = false;

export async function startMathEngine() {
  // This module is bundled into server/dist/index.mjs. Resolve relative to
  // that bundle, since pnpm starts development in the package dir while
  // production may start at the repository root.
  const executable = path.resolve(import.meta.dirname, '../../math-engine/dist/lambda-math');
  child = spawn(executable, ['8091', '+RTS', '-N2'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let launchError: Error | undefined;
  child.on('error', (error) => { launchError = error; });
  child.stdout?.on('data', (data: Buffer) => logger.info({ math: data.toString().trim() }, 'Haskell engine'));
  child.stderr?.on('data', (data: Buffer) => logger.info({ math: data.toString().trim() }, 'Haskell engine'));
  child.on('exit', (code, signal) => {
    if (!stopping) {
      logger.error({ code, signal }, 'Haskell engine exited; stopping API rather than serving fake mathematics');
      process.exitCode = 1;
      process.kill(process.pid, 'SIGTERM');
    }
  });
  for (let tries = 0; tries < 40; tries++) {
    if (launchError) throw launchError;
    try {
      const result = await fetch(`${MATH_ORIGIN}/math/health`, { signal: AbortSignal.timeout(300) });
      if (result.ok) return;
    } catch { /* Child may still be binding its socket. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  stopMathEngine();
  throw new Error('Haskell mathematics server did not become ready');
}

export function stopMathEngine() {
  stopping = true;
  child?.kill('SIGTERM');
}
