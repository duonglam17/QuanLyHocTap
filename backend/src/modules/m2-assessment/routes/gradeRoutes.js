const { Router } = require('express');
const { requireAuth, requireRole } = require('../../../common');
const GradeController = require('../controllers/gradeController');
const GradeRepository = require('../repositories/gradeRepository');
const GradebookRepository = require('../repositories/gradebookRepository');
const GradeService = require('../services/gradeService');

function createGradeRouter({ gradeController } = {}) {
  const router = Router();
  const controller =
    gradeController ||
    new GradeController({
      gradeService: new GradeService({
        gradeRepository: new GradeRepository(),
        gradebookRepository: new GradebookRepository()
      })
    });
  const gradersOnly = [requireAuth, requireRole(['GIANG_VIEN', 'ADMIN'])];

  router.get(
    '/courses/:courseId/grades/submissions',
    ...gradersOnly,
    controller.listCourseSubmissions
  );
  router.get('/submissions/:submissionId/download', ...gradersOnly, controller.downloadSubmission);
  router.post('/submissions/:submissionId/grade', ...gradersOnly, controller.gradeSubmission);

  return router;
}

const router = createGradeRouter();
module.exports = { router, createGradeRouter };
