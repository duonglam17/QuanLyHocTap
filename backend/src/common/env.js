/**
 * =============================================================================
 * ENVIRONMENT CONFIGURATION (backend/src/common/env.js)
 * =============================================================================
 * Đọc và chuẩn hóa cấu hình từ tệp .env và biến môi trường hệ thống.
 * =============================================================================
 */

const path = require('path');
const dotenv = require('dotenv');

// Nạp file .env từ thư mục gốc dự án hoặc backend
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // Fallback nạp local nếu có

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  TZ: process.env.TZ || 'Asia/Ho_Chi_Minh',

  // Database MySQL
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: process.env.DB_USER || 'lms_user',
  DB_PASSWORD: process.env.DB_PASSWORD || 'lms_password_123',
  DB_NAME: process.env.DB_NAME || 'lms_mini_db',
  DB_CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),

  // JWT & Security
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_key_change_in_production_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',

  // Storage
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:5173'],

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test'
};

module.exports = env;

