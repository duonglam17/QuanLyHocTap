const config = require('./config');
const db = require('./db');
const logger = require('./logger');
const errors = require('./errors');
const errorHandler = require('./errorHandler');
const requireAuth = require('./authMiddleware');
const requireRole = require('./rbacMiddleware');
const rateLimit = require('./rateLimiter');
const validate = require('./validate');
const withTransaction = require('./withTransaction');
const clock = require('./clock');
const sanitizeText = require('./sanitizeText');
const storage = require('./storage');

module.exports = {
  config,
  db,
  logger,
  ...errors,
  errors,
  errorHandler,
  requireAuth,
  requireRole,
  rateLimit,
  validate,
  withTransaction,
  clock,
  sanitizeText,
  storage
};
