const express = require('express');
const common = require('../../../common');
const createQuizController = require('../controllers/quizController');
const {
  createQuizSchema,
  updateQuestionsSchema,
  listQuizzesSchema,
  updateQuizSchema,
  quizIdSchema,
  questionIdSchema
} = require('../validators/quizSchemas');

function createQuizRoutes(service) {
  const router = express.Router();
  const controller = createQuizController(service);
  const instructorOnly = [common.requireAuth, common.requireRole(['GIANG_VIEN'])];
  const quizReader = [
    common.requireAuth,
    common.requireRole(['GIANG_VIEN', 'SINH_VIEN'])
  ];

  router.get(
    '/courses/:courseId/quizzes',
    ...quizReader,
    common.validate(listQuizzesSchema),
    controller.list
  );
  router.post(
    '/courses/:courseId/quizzes',
    ...instructorOnly,
    common.validate(createQuizSchema),
    controller.create
  );
  router.get(
    '/quizzes/:quizId',
    ...quizReader,
    common.validate(quizIdSchema),
    controller.get
  );
  router.patch(
    '/quizzes/:quizId',
    ...instructorOnly,
    common.validate(updateQuizSchema),
    controller.update
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
