const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');
const { UnauthorizedError } = require('./errors');

const validRoles = new Set(['ADMIN', 'GIANG_VIEN', 'SINH_VIEN']);

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Thiếu hoặc sai định dạng Authorization header'));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new UnauthorizedError('Token xác thực không hợp lệ'));
  }

  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Token xác thực không hợp lệ hoặc đã hết hạn'));
    }
    return next(error);
  }

  const id = payload?.user_id ?? payload?.id;
  if (
    !payload ||
    typeof payload !== 'object' ||
    !id ||
    !validRoles.has(payload.role) ||
    !Number.isInteger(payload.token_version)
  ) {
    return next(new UnauthorizedError('Token xác thực không hợp lệ'));
  }

  try {
    const [users] = await db.query(
      'SELECT status, token_version FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [id]
    );
    const user = users[0];
    if (!user || user.status !== 'ACTIVE' || payload.token_version !== user.token_version) {
      return next(
        new UnauthorizedError('Tài khoản không hoạt động hoặc phiên đăng nhập không hợp lệ')
      );
    }
  } catch (error) {
    return next(error);
  }

  req.user = { id, role: payload.role };
  return next();
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
