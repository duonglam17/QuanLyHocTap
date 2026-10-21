/**
 * =============================================================================
 * CENTRALIZED LOGGER (backend/src/common/logger.js)
 * =============================================================================
 * Logger chuẩn hóa có định dạng thời gian và cấp độ log.
 * =============================================================================
 */

const config = require('./config');

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLevel = config.isProduction ? LogLevel.INFO : LogLevel.DEBUG;

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

const logger = {
  debug(message, meta) {
    if (currentLevel <= LogLevel.DEBUG) {
      console.debug(formatMessage('DEBUG', message, meta));
    }
  },

  info(message, meta) {
    if (currentLevel <= LogLevel.INFO) {
      console.info(formatMessage('INFO', message, meta));
    }
  },

  warn(message, meta) {
    if (currentLevel <= LogLevel.WARN) {
      console.warn(formatMessage('WARN', message, meta));
    }
  },

  error(message, errorOrMeta) {
    if (currentLevel <= LogLevel.ERROR) {
      if (errorOrMeta instanceof Error) {
        console.error(
          formatMessage('ERROR', message, {
            message: errorOrMeta.message,
            stack: errorOrMeta.stack
          })
        );
      } else {
        console.error(formatMessage('ERROR', message, errorOrMeta));
      }
    }
  }
};

module.exports = logger;
