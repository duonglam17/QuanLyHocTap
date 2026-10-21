const express = require('express');
const multer = require('multer');
const { ValidationError } = require('../../../common/errors');
const { rateLimit, requireAuth, requireRole } = require('../../../common');
const SubmissionController = require('../controllers/submissionController');
const SubmissionRepository = require('../repositories/submissionRepository');
const SubmissionService = require('../services/submissionService');

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function createSubmissionRouter({
  submissionController,
  uploadLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    message: 'Tối đa 10 lần nộp bài mỗi phút.'
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
          return next(new ValidationError('Tệp bài nộp không được vượt quá 20MB.'));
        }
        if (error instanceof multer.MulterError) {
          return next(new ValidationError('Yêu cầu chỉ được đính kèm một tệp bài làm.'));
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
