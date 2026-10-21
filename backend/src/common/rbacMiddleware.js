/**
 * =============================================================================
 * ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE (backend/src/common/rbacMiddleware.js)
 * =============================================================================
 * Middleware kiểm tra quyền truy cập theo vai trò (Khung cơ sở).
 * Sử dụng: rbacMiddleware(['ADMIN', 'GIANG_VIEN'])
 * =============================================================================
 */

const { ForbiddenError, UnauthorizedError } = require('./errors');

function rbacMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Yêu cầu xác thực danh tính trước khi kiểm tra quyền'));
    }

    if (!allowedRoles || allowedRoles.length === 0) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Vai trò [${req.user.role}] không có quyền truy cập endpoint này`,
          { requiredRoles: allowedRoles, currentRole: req.user.role }
        )
      );
    }

    next();
  };
}

module.exports = rbacMiddleware;

