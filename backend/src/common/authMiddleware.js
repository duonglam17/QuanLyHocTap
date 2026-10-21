/**
 * =============================================================================
 * AUTHENTICATION MIDDLEWARE (backend/src/common/authMiddleware.js)
 * =============================================================================
 * Middleware xác thực danh tính (Khung cơ sở).
 * Kiểm tra Authorization header: Bearer <token>.
 * Trong khung này, mô phỏng trích xuất người dùng và gán vào `req.user`.
 * =============================================================================
 */

const { UnauthorizedError } = require('./errors');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Thiếu hoặc sai định dạng Authorization header'));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new UnauthorizedError('Token xác thực không hợp lệ'));
  }

  // Khung mô phỏng giải mã token (Sẽ tích hợp jsonwebtoken ở Giai đoạn 3)
  // Trong khung này: Nếu token là "mock_admin", "mock_gv", "mock_sv" thì gán tương ứng
  if (token === 'mock_admin') {
    req.user = { id: 1, username: 'admin', role: 'ADMIN', tokenVersion: 1 };
  } else if (token === 'mock_gv') {
    req.user = { id: 2, username: 'gv_mai', role: 'GIANG_VIEN', tokenVersion: 1 };
  } else if (token === 'mock_sv') {
    req.user = { id: 4, username: 'sv_nam', role: 'SINH_VIEN', tokenVersion: 1 };
  } else {
    // Giá trị khung mặc định nếu là token bất kỳ khác
    req.user = { id: 999, username: 'anonymous_user', role: 'SINH_VIEN', tokenVersion: 1 };
  }

  next();
}

module.exports = authMiddleware;

