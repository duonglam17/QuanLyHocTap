import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { resetDatabase } from './database-lib.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const e2eDirectory = path.resolve(directory, '..');
const repositoryRoot = path.resolve(e2eDirectory, '..');
dotenv.config({ path: path.join(e2eDirectory, '.env.e2e') });

async function start() {
  if (process.env.E2E_RESET_DB === '1') {
    await resetDatabase();
  }

  const backend = spawn(
    process.execPath,
    [path.join(repositoryRoot, 'backend', 'src', 'server.js')],
    {
      cwd: path.join(repositoryRoot, 'backend'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DB_NAME: process.env.DB_NAME || 'lms_e2e',
        PORT: process.env.PORT || '5001'
      },
      stdio: 'inherit'
    }
  );

  const stopBackend = () => {
    if (!backend.killed) backend.kill();
  };
  process.once('SIGINT', stopBackend);
  process.once('SIGTERM', stopBackend);
  backend.once('error', (error) => {
    console.error(`[E2E] Could not start backend: ${error.message}`);
    process.exitCode = 1;
  });
  backend.once('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

start().catch((error) => {
  console.error(`[E2E] Backend startup failed: ${error.message}`);
  process.exitCode = 1;
});
