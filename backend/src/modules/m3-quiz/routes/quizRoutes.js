const express = require('express');
const common = require('../../../common');
const createQuizController = require('../controllers/quizController');
const {
  createQuizSchema,
  updateQuestionsSchema,
  quizIdSchema,
  questionIdSchema
} = require('../validators/quizSchemas');

function createQuizRoutes(service) {
  const router = express.Router();
  const controller = createQuizController(service);
  const instructorOnly = [common.requireAuth, common.requireRole(['GIANG_VIEN'])];

  router.post(
    '/courses/:courseId/quizzes',
    ...instructorOnly,
    common.validate(createQuizSchema),
    controller.create
  );
  router.put(
    '/quizzes/:quizId/questions',
    ...instructorOnly,
    common.validate(updateQuestionsSchema),
    controller.updateQuestions
  );
  router.delete(
    '/questions/:questionId',
    ...instructorOnly,
    common.validate(questionIdSchema),
    controller.deleteQuestion
  );
  router.post(
    '/quizzes/:quizId/publish',
    ...instructorOnly,
    common.validate(quizIdSchema),
    controller.publish
  );

  return router;
}

module.exports = createQuizRoutes;
