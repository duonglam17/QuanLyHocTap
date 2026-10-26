import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const directory = path.dirname(fileURLToPath(import.meta.url));
const e2eDirectory = path.resolve(directory, '..');
const repositoryRoot = path.resolve(e2eDirectory, '..');
dotenv.config({ path: path.join(e2eDirectory, '.env.e2e') });

const frontendDirectory = path.join(repositoryRoot, 'frontend');
const viteCli = path.join(frontendDirectory, 'node_modules', 'vite', 'bin', 'vite.js');
const port = process.env.E2E_FRONTEND_PORT || '5174';
const backendURL = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:5001';

const frontend = spawn(
  process.execPath,
  [viteCli, '--host', '127.0.0.1', '--port', port, '--strictPort'],
  {
    cwd: frontendDirectory,
    env: {
      ...process.env,
      VITE_API_BASE_URL: '/api',
      VITE_API_PROXY_TARGET: backendURL
    },
    stdio: 'inherit'
  }
);

const stopFrontend = () => {
  if (!frontend.killed) frontend.kill();
};
process.once('SIGINT', stopFrontend);
process.once('SIGTERM', stopFrontend);
frontend.once('error', (error) => {
  console.error(`[E2E] Could not start frontend: ${error.message}`);
  process.exitCode = 1;
});
frontend.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
