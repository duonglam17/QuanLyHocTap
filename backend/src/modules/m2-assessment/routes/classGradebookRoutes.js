const { Router } = require('express');
const { requireAuth, requireRole } = require('../../../common');

function createClassGradebookRouter({ controller }) {
  const router = Router();
  const gradersOnly = [requireAuth, requireRole(['GIANG_VIEN', 'ADMIN'])];

  router.get(
    '/courses/:courseId/gradebook',
    ...gradersOnly,
    controller.getCourseGradebook
  );
  router.get(
    '/courses/:courseId/gradebook/export.csv',
    ...gradersOnly,
    controller.exportCourseGradebookCsv
  );
  return router;
}

module.exports = { createClassGradebookRouter };
