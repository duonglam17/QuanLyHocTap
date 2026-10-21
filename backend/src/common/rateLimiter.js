const { rateLimit: expressRateLimit, ipKeyGenerator } = require('express-rate-limit');
const { TooManyRequestsError } = require('./errors');

const limiters = new Map();

function rateLimit(name, { windowMs = 60_000, max = 100 } = {}) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('Tên rate limit phải là chuỗi không rỗng.');
  }
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
    throw new TypeError('windowMs phải là số nguyên dương.');
  }
  if (!Number.isSafeInteger(max) || max <= 0) {
    throw new TypeError('max phải là số nguyên dương.');
  }

  const existing = limiters.get(name);
  if (existing) {
    if (existing.windowMs !== windowMs || existing.max !== max) {
      throw new Error(`Rate limit "${name}" đã được cấu hình khác.`);
    }
    return existing.middleware;
  }

  const middleware = expressRateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator(req) {
      return req.user?.id ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip)}`;
    },
    handler(req, res, next) {
      return next(
        new TooManyRequestsError('Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn', {
          retryAfterSeconds: Math.max(
            0,
            Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
          )
        })
      );
    }
  });
  limiters.set(name, { windowMs, max, middleware });
  return middleware;
}

module.exports = rateLimit;
module.exports.rateLimit = rateLimit;
