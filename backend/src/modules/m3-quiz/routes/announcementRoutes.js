const express = require('express');
const common = require('../../../common');
const createAnnouncementController = require('../controllers/announcementController');
const {
  announcementIdSchema,
  announcementPaginationSchema,
  createAnnouncementSchema
} = require('../validators/announcementSchemas');

function createAnnouncementRoutes(service) {
  const router = express.Router();
  const controller = createAnnouncementController(service);
  const authenticated = common.requireAuth;
  const writers = [common.requireAuth, common.requireRole(['GIANG_VIEN', 'ADMIN'])];

  router.post(
    '/courses/:courseId/announcements',
    ...writers,
    common.validate(createAnnouncementSchema),
    controller.create
  );
  router.get(
    '/courses/:courseId/announcements',
    authenticated,
    common.validate(announcementPaginationSchema),
    controller.list
  );
  router.delete(
    '/announcements/:announcementId',
    ...writers,
    common.validate(announcementIdSchema),
    controller.delete
  );

  return router;
}

module.exports = createAnnouncementRoutes;
