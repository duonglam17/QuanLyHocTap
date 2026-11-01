const path = require('node:path');

const mysqlPath = require.resolve('mysql2/promise', {
  paths: [path.resolve(process.cwd(), 'backend')]
});

const mysql = require(mysqlPath);
const originalCreateConnection = mysql.createConnection;

mysql.createConnection = function (config, ...args) {
  if (
    config &&
    config.database === 'lms_e2e' &&
    config.user === 'root' &&
    process.env.E2E_ALLOW_EMPTY_DB_PASSWORD === '1'
  ) {
    config = { ...config, password: '' };
  }

  return originalCreateConnection.call(this, config, ...args);
};
