const { rateLimit: expressRateLimit } = require('express-rate-limit');
const { TooManyRequestsError } = require('./errors');

function rateLimit(options = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const limit = options.limit ?? options.max ?? 100;
  const message = options.message ?? 'Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn';

  return expressRateLimit({
    ...options,
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res, next) {
      next(
        new TooManyRequestsError(message, {
          retryAfterSeconds: Math.max(
            0,
            Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
          )
        })
      );
    }
  });
}

module.exports = rateLimit;
module.exports.rateLimit = rateLimit;
