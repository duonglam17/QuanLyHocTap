const express = require('express');
const common = require('../../../common');
const createAttemptController = require('../controllers/attemptController');
const {
  startAttemptSchema,
  saveAnswerSchema
} = require('../validators/attemptSchemas');

function createAttemptRoutes(service) {
  const router = express.Router();
  const controller = createAttemptController(service);
  const studentOnly = [common.requireAuth, common.requireRole(['SINH_VIEN'])];

  router.post(
    '/quizzes/:quizId/start',
    ...studentOnly,
    common.validate(startAttemptSchema),
    controller.start
  );
  router.patch(
    '/attempts/:attemptId/save-answer',
    ...studentOnly,
    common.validate(saveAnswerSchema),
    controller.saveAnswer
  );

  return router;
}

module.exports = createAttemptRoutes;
