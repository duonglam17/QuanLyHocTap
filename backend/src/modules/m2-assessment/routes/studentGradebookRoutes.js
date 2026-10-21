const { Router } = require('express');
const { requireAuth, requireRole } = require('../../../common');
const StudentGradebookController = require('../controllers/studentGradebookController');
const StudentGradebookRepository = require('../repositories/studentGradebookRepository');
const StudentGradebookService = require('../services/studentGradebookService');

function createStudentGradebookRouter({ controller } = {}) {
  const router = Router();
  const gradebookController =
    controller ||
    new StudentGradebookController(
      new StudentGradebookService({
        gradebookRepository: new StudentGradebookRepository()
      })
    );

  router.get(
    '/courses/:courseId/my-grades',
    requireAuth,
    requireRole(['SINH_VIEN']),
    gradebookController.getMyCourseGrades
  );

  return router;
}

const router = createStudentGradebookRouter();
module.exports = { router, createStudentGradebookRouter };
