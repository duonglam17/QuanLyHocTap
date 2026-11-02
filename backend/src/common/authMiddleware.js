const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');
const { UnauthorizedError, PasswordChangeRequiredError } = require('./errors');

const validRoles = new Set(['ADMIN', 'GIANG_VIEN', 'SINH_VIEN']);

async function requirePasswordChanged(req, res, next) {
  if (!req.user || !req.user.id) {
    return next();
  }

  const originalUrl = (req.originalUrl || req.url || '').split('?')[0];
  const method = req.method.toUpperCase();

  // Bỏ qua các endpoint ngoại lệ:
  // 1. Đăng xuất: POST /api/auth/logout
  // 2. Lấy thông tin phiên hiện tại: GET /api/users/me
  // 3. Endpoint đổi mật khẩu: PUT /api/users/me/password
  const isLogout = method === 'POST' && originalUrl.endsWith('/auth/logout');
  const isGetMe =
    method === 'GET' &&
    (originalUrl.endsWith('/users/me') || originalUrl.endsWith('/auth/me'));
  const isChangePassword =
    method === 'PUT' && originalUrl.endsWith('/users/me/password');

  if (isLogout || isGetMe || isChangePassword) {
    return next();
  }

  try {
    let mustChange = req.user.mustChangePassword;
    if (mustChange === undefined) {
      const [rows] = await db.query(
        'SELECT must_change_password FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
        [req.user.id]
      );
      mustChange = Boolean(rows[0]?.must_change_password);
      req.user.mustChangePassword = mustChange;
    }

    if (mustChange) {
      return next(new PasswordChangeRequiredError());
    }
  } catch (error) {
    return next(error);
  }

  return next();
}

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

  let user;
  try {
    const [users] = await db.query(
      'SELECT must_change_password, status, token_version FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [id]
    );
    user = users[0];
    if (!user || user.status !== 'ACTIVE' || payload.token_version !== user.token_version) {
      return next(
        new UnauthorizedError('Tài khoản không hoạt động hoặc phiên đăng nhập không hợp lệ')
      );
    }
  } catch (error) {
    return next(error);
  }

  req.user = {
    id,
    role: payload.role,
    mustChangePassword: Boolean(user.must_change_password)
  };

  return requirePasswordChanged(req, res, next);
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requirePasswordChanged = requirePasswordChanged;
