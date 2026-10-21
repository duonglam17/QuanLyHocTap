/**
 * =============================================================================
 * GLOBAL ERROR HANDLER MIDDLEWARE (backend/src/common/errorHandler.js)
 * =============================================================================
 * Bắt và chuẩn hóa toàn bộ lỗi trong hệ thống thành định dạng JSON:
 * {
 *   "code": "STRING_ERROR_CODE",
 *   "message": "Thông báo lỗi thân thiện",
 *   "details": null | object | array
 * }
 * =============================================================================
 */

const { AppError } = require('./errors');
const logger = require('./logger');
const config = require('./config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Đã có lỗi xảy ra phía máy chủ';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    // Lỗi JSON body parse sai cú pháp
    statusCode = 400;
    code = 'INVALID_JSON_BODY';
    message = 'Dữ liệu gửi lên sai định dạng JSON';
  } else {
    // Lỗi hệ thống không lường trước
    logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl}:`, err);
    if (!config.isProduction) {
      details = {
        name: err.name,
        stack: err.stack
      };
    }
  }

  res.status(statusCode).json({
    code,
    message,
    details
  });
}

module.exports = errorHandler;
