const jwt = require('jsonwebtoken');
const config = require('./config');
const { UnauthorizedError } = require('./errors');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Thiếu hoặc sai định dạng Authorization header'));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new UnauthorizedError('Token xác thực không hợp lệ'));
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const userId = payload?.user_id ?? payload?.id;
    if (!payload || typeof payload !== 'object' || !userId || !payload.role) {
      return next(new UnauthorizedError('Token xác thực không hợp lệ'));
    }

    req.user = {
      id: userId,
      role: payload.role,
      tokenVersion: payload.token_version
    };
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Token xác thực không hợp lệ hoặc đã hết hạn'));
    }
    return next(error);
  }
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
