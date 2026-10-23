const express = require('express');
const common = require('../../../common');
const createDiscussionController = require('../controllers/discussionController');
const {
  createDiscussionSchema,
  discussionPaginationSchema,
  replyDiscussionSchema
} = require('../validators/discussionSchemas');

function createDiscussionRoutes(service) {
  const router = express.Router();
  const controller = createDiscussionController(service);
  const participants = [
    common.requireAuth,
    common.requireRole(['SINH_VIEN', 'GIANG_VIEN'])
  ];

  router.get(
    '/lessons/:lessonId/comments',
    ...participants,
    common.validate(discussionPaginationSchema),
    controller.list
  );
  router.post(
    '/lessons/:lessonId/comments',
    ...participants,
    common.validate(createDiscussionSchema),
    controller.create
  );
  router.post(
    '/comments/:commentId/replies',
    ...participants,
    common.validate(replyDiscussionSchema),
    controller.reply
  );

  return router;
}

module.exports = createDiscussionRoutes;
