function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createAttemptController(service) {
  return {
    start: asyncHandler(async (req, res) => {
      const result = await service.startAttempt(
        req.params.quizId,
        req.user.id,
        req.body
      );
      res.status(200).json(result);
    }),

    saveAnswer: asyncHandler(async (req, res) => {
      const result = await service.saveAnswer(
        req.params.attemptId,
        req.user.id,
        req.body
      );
      res.status(200).json(result);
    })
  };
}

module.exports = createAttemptController;
