/**
 * =============================================================================
 * CENTRALIZED APPLICATION ERRORS (backend/src/common/errors.js)
 * =============================================================================
 * Định nghĩa cấu trúc lỗi chuẩn hóa { code, message, details }.
 * =============================================================================
 */

class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Dữ liệu đầu vào không hợp lệ', details = null) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Chưa xác thực hoặc phiên đăng nhập không hợp lệ', details = null) {
    super(message, 'UNAUTHORIZED', 401, details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Bạn không có quyền thực hiện hành động này', details = null) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Tài nguyên yêu cầu không tồn tại', details = null) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Xung đột dữ liệu', details = null) {
    super(message, 'CONFLICT', 409, details);
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Quá nhiều yêu cầu, vui lòng thử lại sau', details = null) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError
};

