const { Router } = require('express');
const { rateLimit, requireAuth } = require('../../../common');

function createAuthRouter({ authController }) {
  if (!authController) {
    throw new TypeError('createAuthRouter yêu cầu AuthController.');
  }
  const router = Router();

  router.post(
    '/login',
    rateLimit('m1-auth-login', { windowMs: 60_000, max: 5 }),
    authController.login.bind(authController)
  );
  router.post('/refresh', authController.refresh.bind(authController));
  router.post('/logout', requireAuth, authController.logout.bind(authController));

  return router;
}

module.exports = { createAuthRouter };
