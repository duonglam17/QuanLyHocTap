/**
 * =============================================================================
 * DATABASE CONNECTION POOL (backend/src/common/db.js)
 * =============================================================================
 * Quản lý Connection Pool kết nối MySQL 8.0 sử dụng mysql2/promise.
 * =============================================================================
 */

const env = require('./env');
const logger = require('./logger');

let pool = null;

function getPool() {
  if (!pool) {
    let mysql;
    try {
      mysql = require('mysql2/promise');
    } catch {
      logger.warn('Gói mysql2 chưa được cài đặt. Khởi tạo pool ở chế độ giả lập.');
      return null;
    }

    pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      waitForConnections: true,
      connectionLimit: env.DB_CONNECTION_LIMIT,
      queueLimit: 0,
      multipleStatements: true,
      timezone: '+07:00'
    });

    logger.info(`Đã khởi tạo MySQL Connection Pool tới [${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}]`);
  }
  return pool;
}

async function testConnection() {
  try {
    const p = getPool();
    if (!p) return false;
    const [rows] = await p.query('SELECT 1 as connected');
    return rows && rows[0] && rows[0].connected === 1;
  } catch (err) {
    logger.error('Lỗi kiểm tra kết nối CSDL:', err);
    return false;
  }
}

async function query(sql, params) {
  const p = getPool();
  if (!p) {
    throw new Error('Database connection pool is not available.');
  }
  return p.query(sql, params);
}

module.exports = {
  getPool,
  testConnection,
  query
};

