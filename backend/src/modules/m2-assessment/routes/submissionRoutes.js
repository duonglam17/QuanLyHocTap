const express = require('express');
const multer = require('multer');
const { AppError, BadRequestError } = require('../../../common/errors');
const { rateLimit, requireAuth, requireRole } = require('../../../common');
const SubmissionController = require('../controllers/submissionController');
const SubmissionRepository = require('../repositories/submissionRepository');
const SubmissionService = require('../services/submissionService');

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function createSubmissionRouter({
  submissionController,
  uploadLimiter = rateLimit('m2-assessment-submissions', {
    windowMs: 60_000,
    max: 10
  })
} = {}) {
  const router = express.Router();
  const controller =
    submissionController ||
    new SubmissionController(
      new SubmissionService({ submissionRepository: new SubmissionRepository() })
    );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1
    }
  }).single('file');

  router.get(
    '/assignments/:assignmentId/submissions/me',
    requireAuth,
    requireRole(['SINH_VIEN']),
    controller.getMySubmission
  );

  router.post(
    '/assignments/:assignmentId/submissions',
    requireAuth,
    requireRole(['SINH_VIEN']),
    uploadLimiter,
    (req, res, next) => {
      upload(req, res, (error) => {
        if (!error) {
          return next();
        }
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('Tệp bài nộp không được vượt quá 20MB.', 'PAYLOAD_TOO_LARGE', 413));
        }
        if (error instanceof multer.MulterError) {
          return next(new BadRequestError('Yêu cầu chỉ được đính kèm một tệp bài làm.'));
        }
        return next(error);
      });
    },
    controller.submitAssignment
  );

  return router;
}

const router = createSubmissionRouter();
module.exports = { router, createSubmissionRouter };
