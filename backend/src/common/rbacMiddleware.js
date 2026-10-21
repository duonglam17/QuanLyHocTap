const { ForbiddenError, UnauthorizedError } = require('./errors');

const validRoles = new Set(['ADMIN', 'GIANG_VIEN', 'SINH_VIEN']);

function requireRole(...roles) {
  if (roles.length === 1 && Array.isArray(roles[0])) {
    roles = roles[0];
  }
  if (roles.some((role) => !validRoles.has(role))) {
    throw new TypeError('Vai trò phải là ADMIN, GIANG_VIEN hoặc SINH_VIEN.');
  }

  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Yêu cầu xác thực danh tính trước khi kiểm tra quyền'));
    }

    if (roles.length === 0 || roles.includes(req.user.role)) {
      return next();
    }

    return next(
      new ForbiddenError(`Vai trò [${req.user.role}] không có quyền truy cập endpoint này`, {
        requiredRoles: roles,
        currentRole: req.user.role
      })
    );
  };
}

module.exports = requireRole;
module.exports.requireRole = requireRole;
