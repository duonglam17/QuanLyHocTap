import { runDatabaseAction } from './database-lib.js';

runDatabaseAction(process.argv[2]).catch((error) => {
  console.error(`[E2E DB] ${error.message}`);
  process.exitCode = 1;
});
