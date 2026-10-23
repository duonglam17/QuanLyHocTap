function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createDiscussionController(service) {
  return {
    create: asyncHandler(async (req, res) => {
      const discussion = await service.create(
        req.params.lessonId,
        req.user.id,
        req.body.content
      );
      res.status(201).json(discussion);
    }),

    reply: asyncHandler(async (req, res) => {
      const reply = await service.reply(
        req.params.commentId,
        req.user.id,
        req.body.content
      );
      res.status(201).json(reply);
    }),

    list: asyncHandler(async (req, res) => {
      const result = await service.list(
        req.params.lessonId,
        req.user.id,
        req.query
      );
      res.status(200).json(result);
    })
  };
}

module.exports = createDiscussionController;
