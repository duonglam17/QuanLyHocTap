/**
 * =============================================================================
 * CENTRALIZED COMMON MODULE EXPORTS (backend/src/common/index.js)
 * =============================================================================
 */

const env = require('./env');
const db = require('./db');
const logger = require('./logger');
const errors = require('./errors');
const errorHandler = require('./errorHandler');
const authMiddleware = require('./authMiddleware');
const rbacMiddleware = require('./rbacMiddleware');
const rateLimiter = require('./rateLimiter');

module.exports = {
  env,
  db,
  logger,
  errors,
  errorHandler,
  authMiddleware,
  rbacMiddleware,
  rateLimiter
};

