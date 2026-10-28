const { Router } = require('express');
const { rateLimit, requireAuth } = require('../../../common');

function createAuthRouter({ authController }) {
  if (!authController) {
    throw new TypeError('createAuthRouter yêu cầu AuthController.');
  }
  const router = Router();
  const isE2E = process.env.DB_NAME === 'lms_e2e' || Boolean(process.env.E2E_BACKEND_URL);
  const loginRateLimitMax = Number(process.env.RATE_LIMIT_LOGIN_MAX) || (isE2E ? 100 : 5);

  router.post(
    '/login',
    rateLimit('m1-auth-login', { windowMs: 60_000, max: loginRateLimitMax }),
    authController.login.bind(authController)
  );
  router.post('/refresh', authController.refresh.bind(authController));
  router.post('/logout', requireAuth, authController.logout.bind(authController));

  return router;
}

module.exports = { createAuthRouter };
