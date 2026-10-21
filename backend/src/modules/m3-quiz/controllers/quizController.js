function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createQuizController(service) {
  return {
    create: asyncHandler(async (req, res) => {
      const quiz = await service.createQuiz(
        req.params.courseId,
        req.user.id,
        req.body
      );
      res.status(201).json(quiz);
    }),

    updateQuestions: asyncHandler(async (req, res) => {
      const quiz = await service.updateQuestions(
        req.params.quizId,
        req.user.id,
        req.body.questions
      );
      res.status(200).json(quiz);
    }),

    deleteQuestion: asyncHandler(async (req, res) => {
      const result = await service.deleteQuestion(req.params.questionId, req.user.id);
      res.status(200).json(result);
    }),

    publish: asyncHandler(async (req, res) => {
      const quiz = await service.publishQuiz(req.params.quizId, req.user.id);
      res.status(200).json(quiz);
    })
  };
}

module.exports = createQuizController;
