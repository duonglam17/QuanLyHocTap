const { ForbiddenError, UnauthorizedError } = require('./errors');

function requireRole(allowedRoles = []) {
  if (!Array.isArray(allowedRoles) || allowedRoles.some((role) => typeof role !== 'string')) {
    throw new TypeError('allowedRoles phải là mảng các tên vai trò.');
  }

  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Yêu cầu xác thực danh tính trước khi kiểm tra quyền'));
    }

    if (allowedRoles.length === 0 || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return next(
      new ForbiddenError(`Vai trò [${req.user.role}] không có quyền truy cập endpoint này`, {
        requiredRoles: allowedRoles,
        currentRole: req.user.role
      })
    );
  };
}

module.exports = requireRole;
module.exports.requireRole = requireRole;
