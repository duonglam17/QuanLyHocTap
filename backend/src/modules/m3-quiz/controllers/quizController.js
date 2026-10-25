function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createQuizController(service) {
  return {
    list: asyncHandler(async (req, res) => {
      const quizzes = await service.listQuizzes(
        Number(req.params.courseId),
        req.user.id,
        req.user.role,
        req.query
      );
      res.status(200).json(quizzes);
    }),

    get: asyncHandler(async (req, res) => {
      const quiz = await service.getQuiz(
        Number(req.params.quizId),
        req.user.id,
        req.user.role
      );
      res.status(200).json(quiz);
    }),

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

    update: asyncHandler(async (req, res) => {
      const quiz = await service.updateQuiz(
        Number(req.params.quizId),
        req.user.id,
        req.body
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
