const express = require('express');
const common = require('../../../common');
const createAttemptController = require('../controllers/attemptController');
const {
  attemptResultSchema,
  startAttemptSchema,
  saveAnswerSchema,
  submitAttemptSchema
} = require('../validators/attemptSchemas');

function createAttemptRoutes(service) {
  const router = express.Router();
  const controller = createAttemptController(service);
  const studentOnly = [common.requireAuth, common.requireRole(['SINH_VIEN'])];
  const resultReaders = [
    common.requireAuth,
    common.requireRole(['SINH_VIEN', 'GIANG_VIEN'])
  ];

  router.get(
    '/attempts/:attemptId/result',
    ...resultReaders,
    common.validate(attemptResultSchema),
    controller.getResult
  );
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
  router.post(
    '/attempts/:attemptId/submit',
    ...studentOnly,
    common.validate(submitAttemptSchema),
    controller.submit
  );

  return router;
}

module.exports = createAttemptRoutes;
