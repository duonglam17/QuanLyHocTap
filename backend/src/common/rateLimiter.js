/**
 * =============================================================================
 * RATE LIMITER MIDDLEWARE (backend/src/common/rateLimiter.js)
 * =============================================================================
 * Middleware giới hạn tần suất request theo IP (Khung cơ sở).
 * Sử dụng: rateLimiter({ windowMs: 60000, max: 100 })
 * =============================================================================
 */

const { TooManyRequestsError } = require('./errors');

function rateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 phút
  const max = options.max || 100; // Tối đa 100 request/phút
  const message = options.message || 'Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn';

  // Lưu trữ bộ nhớ tạm thời theo IP
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown-ip';
    const now = Date.now();

    const record = requests.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    requests.set(ip, record);

    // Gán thông tin header
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      return next(new TooManyRequestsError(message, {
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000)
      }));
    }

    next();
  };
}

module.exports = rateLimiter;

