const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const defaultJwtSecret = 'local-development-secret-change-before-deployment';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  TZ: z.string().min(1).default('Asia/Ho_Chi_Minh'),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default('lms_user'),
  DB_PASSWORD: z.string().default('local-development-only'),
  DB_NAME: z.string().min(1).default('lms_mini_db'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(10).max(30).default(10),
  JWT_SECRET: z.string().min(32).default(defaultJwtSecret),
  JWT_EXPIRES_IN: z.string().min(1).default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1).default('7d'),
  UPLOAD_DIR: z.string().min(1).default(path.resolve(__dirname, '../../uploads')),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:5173')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }));
  throw new Error(`Cấu hình môi trường không hợp lệ: ${JSON.stringify(details)}`);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET === defaultJwtSecret) {
  throw new Error('JWT_SECRET phải được cấu hình riêng khi chạy production.');
}

const config = {
  ...parsed.data,
  UPLOAD_DIR: path.resolve(parsed.data.UPLOAD_DIR),
  CORS_ORIGIN: parsed.data.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test'
};

module.exports = Object.freeze(config);
