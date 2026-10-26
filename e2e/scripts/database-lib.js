import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createRequire } from 'node:module';

const directory = path.dirname(fileURLToPath(import.meta.url));
const e2eDirectory = path.resolve(directory, '..');
const repositoryRoot = path.resolve(e2eDirectory, '..');
dotenv.config({ path: path.join(e2eDirectory, '.env.e2e') });

function assertE2EDatabase() {
  const databaseName = process.env.DB_NAME || 'lms_e2e';
  if (databaseName !== 'lms_e2e') {
    throw new Error(
      `Refusing to alter database "${databaseName}". E2E database must be exactly "lms_e2e".`
    );
  }
  return databaseName;
}

function runDatabaseScript(scriptName) {
  const result = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, 'database', scriptName)],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        DB_NAME: process.env.DB_NAME || 'lms_e2e',
        DB_USER: process.env.DB_USER || process.env.DB_ADMIN_USER || 'root',
        DB_PASSWORD: process.env.DB_PASSWORD ?? process.env.DB_ADMIN_PASSWORD ?? ''
      },
      stdio: 'inherit'
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${scriptName} exited with status ${result.status ?? 'unknown'}.`);
  }
}

async function resetE2EDatabase() {
  const databaseName = assertE2EDatabase();
  const backendRequire = createRequire(path.join(repositoryRoot, 'backend', 'package.json'));
  const mysql = backendRequire('mysql2/promise');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_ADMIN_USER || process.env.DB_USER || 'root',
    password: process.env.DB_ADMIN_PASSWORD ?? process.env.DB_PASSWORD ?? '',
    multipleStatements: false
  });

  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await connection.query(
      `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[E2E DB] Recreated isolated database "${databaseName}".`);
  } finally {
    await connection.end();
  }

  runDatabaseScript('migrate.js');
  runDatabaseScript('seed.js');
}

export async function resetDatabase() {
  return resetE2EDatabase();
}

export async function runDatabaseAction(action) {
  assertE2EDatabase();
  if (action === 'reset') return resetE2EDatabase();
  if (action === 'migrate') return runDatabaseScript('migrate.js');
  if (action === 'seed') return runDatabaseScript('seed.js');
  throw new Error('Usage: node scripts/database.js <reset|migrate|seed>');
}
