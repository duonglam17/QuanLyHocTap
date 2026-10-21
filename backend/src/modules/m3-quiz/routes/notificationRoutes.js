const express = require('express');
const { z } = require('zod');
const common = require('../../../common');
const createNotificationController = require('../controllers/notificationController');

const paginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
  })
});
const notificationParamsSchema = z.object({
  notificationId: z.string().regex(/^[1-9]\d*$/)
});

function createNotificationRoutes(service) {
  const router = express.Router();
  const controller = createNotificationController(service);

  router.get(
    '/',
    common.requireAuth,
    common.validate(paginationSchema),
    controller.list
  );
  router.patch(
    '/:notificationId/read',
    common.requireAuth,
    common.validate(notificationParamsSchema, 'params'),
    controller.markRead
  );

  return router;
}

module.exports = createNotificationRoutes;
