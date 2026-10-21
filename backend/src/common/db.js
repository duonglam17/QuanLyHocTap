/**
 * =============================================================================
 * DATABASE CONNECTION POOL (backend/src/common/db.js)
 * =============================================================================
 * Quản lý Connection Pool kết nối MySQL 8.0 sử dụng mysql2/promise.
 * =============================================================================
 */

const config = require('./config');
const logger = require('./logger');

let pool = null;

function getPool() {
  if (!pool) {
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
      waitForConnections: true,
      connectionLimit: config.DB_CONNECTION_LIMIT,
      queueLimit: 0,
      timezone: '+07:00'
    });

    logger.info(
      `Đã khởi tạo MySQL Connection Pool tới [${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}]`
    );
  }
  return pool;
}

async function testConnection() {
  const [rows] = await getPool().query('SELECT 1 AS connected');
  return rows[0]?.connected === 1;
}

async function query(sql, params) {
  return getPool().query(sql, params);
}

async function closePool() {
  if (pool) {
    const currentPool = pool;
    pool = null;
    await currentPool.end();
  }
}

module.exports = {
  getPool,
  testConnection,
  query,
  closePool
};
