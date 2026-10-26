import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(directory, '.env.e2e') });

if (process.env.DB_NAME && process.env.DB_NAME !== 'lms_e2e') {
  throw new Error(`E2E must use DB_NAME=lms_e2e; refusing "${process.env.DB_NAME}".`);
}
process.env.DB_NAME = 'lms_e2e';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5174';
const backendURL = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:5001';
const backendPort = Number(process.env.PORT || 5001);
const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 5174);
const generatedDirectory = path.join(directory, '.generated');
const optionalFirefox = process.env.E2E_FIREFOX === '1';

const projects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], browserName: 'chromium' }
  }
];

if (optionalFirefox) {
  projects.push({
    name: 'firefox',
    use: { ...devices['Desktop Firefox'], browserName: 'firefox' }
  });
}

export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(generatedDirectory, 'report'), open: 'never' }]
  ],
  outputDir: path.join(generatedDirectory, 'results'),
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects,
  webServer: [
    {
      command: 'node scripts/start-backend.js',
      cwd: directory,
      url: `${backendURL}/api/health`,
      reuseExistingServer: process.env.E2E_REUSE_SERVERS === '1' && !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: String(backendPort),
        DB_NAME: process.env.DB_NAME || 'lms_e2e'
      }
    },
    {
      command: 'node scripts/start-frontend.js',
      cwd: directory,
      url: `${baseURL}/login`,
      reuseExistingServer: process.env.E2E_REUSE_SERVERS === '1' && !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        E2E_FRONTEND_PORT: String(frontendPort),
        E2E_BACKEND_URL: backendURL
      }
    }
  ]
});
