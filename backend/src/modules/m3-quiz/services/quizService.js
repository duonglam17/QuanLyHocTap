const {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');
const { isValidDateTime } = require('../validators/quizSchemas');

function sanitizeQuestion(question, sanitizeText) {
  if (!question || typeof question.content !== 'string' || !Array.isArray(question.options)) {
    throw new ValidationError('Câu hỏi và danh sách lựa chọn không hợp lệ.');
  }
  if (question.options.length < 2 || question.options.length > 5) {
    throw new ValidationError('Mỗi câu hỏi phải có từ 2 đến 5 lựa chọn.');
  }
  if (
    question.options.some(
      (option) =>
        !option ||
        typeof option.content !== 'string' ||
        typeof option.is_correct !== 'boolean'
    )
  ) {
    throw new ValidationError('Nội dung và trạng thái đáp án của lựa chọn không hợp lệ.');
  }
  if (question.options.filter((option) => option.is_correct).length !== 1) {
    throw new ValidationError('Mỗi câu hỏi phải có đúng một đáp án đúng.');
  }

  const content = sanitizeText(question.content);
  const options = question.options.map((option) => ({
    content: sanitizeText(option.content),
    is_correct: option.is_correct
  }));

  if (!content.trim() || options.some((option) => !option.content.trim())) {
    throw new ValidationError('Nội dung sau khi làm sạch không được để trống.');
  }

  return { content, options };
}

function createQuizService({ repository, getCourseAccess, withTransaction, sanitizeText }) {
  async function requireCourseAccess(courseId, userId) {
    const courseAccess = getCourseAccess();
    if (
      !courseAccess ||
      typeof courseAccess.getCourse !== 'function' ||
      typeof courseAccess.isOwner !== 'function' ||
      typeof courseAccess.assertCourseWritable !== 'function'
    ) {
      throw new InternalServerError('Port courseAccess chưa sẵn sàng.');
    }

    const course = await courseAccess.getCourse(courseId);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học.');
    }
    if (!(await courseAccess.isOwner(userId, courseId))) {
      throw new ForbiddenError('Chỉ chủ khóa học mới được quản lý đề thi.');
    }
    await courseAccess.assertCourseWritable(courseId);
    return course;
  }

  async function requireQuizOwner(quizId, userId, connection) {
    const quiz = connection
      ? await repository.findQuizForUpdate(connection, quizId)
      : await repository.findQuiz(quizId);
    if (!quiz) {
      throw new NotFoundError('Không tìm thấy đề thi.');
    }
    await requireCourseAccess(quiz.courseId, userId);
    return quiz;
  }

  async function assertNoAttempts(connection, quiz) {
    if (quiz.hasAttempts || (await repository.hasAttempts(connection, quiz.id))) {
      throw new ConflictError('Không thể chỉnh sửa đề thi khi đã có thí sinh làm bài.');
    }
  }

  return {
    async createQuiz(courseId, userId, data) {
      await requireCourseAccess(courseId, userId);
      if (
        !data ||
        typeof data.title !== 'string' ||
        (data.description != null && typeof data.description !== 'string') ||
        !Number.isInteger(data.duration_minutes) ||
        data.duration_minutes < 1 ||
        !isValidDateTime(data.open_time) ||
        !isValidDateTime(data.close_time) ||
        data.open_time >= data.close_time
      ) {
        throw new ValidationError('Thông tin đề thi hoặc cửa sổ mở đề không hợp lệ.');
      }
      const title = sanitizeText(data.title);
      const description =
        data.description == null ? null : sanitizeText(data.description);
      if (!title.trim() || (description !== null && !description.trim())) {
        throw new ValidationError('Tiêu đề và mô tả sau khi làm sạch không được để trống.');
      }
      const inputQuestions = data.questions ?? [];
      if (!Array.isArray(inputQuestions)) {
        throw new ValidationError('Danh sách câu hỏi không hợp lệ.');
      }
      const showScoreImmediately = data.show_score_immediately ?? true;
      if (typeof showScoreImmediately !== 'boolean') {
        throw new ValidationError('Cấu hình hiển thị điểm phải là boolean.');
      }
      const questions = inputQuestions.map((question) =>
        sanitizeQuestion(question, sanitizeText)
      );
      const quizId = await withTransaction((connection) =>
        repository.createQuizWithQuestions(
          connection,
          courseId,
          {
            ...data,
            title,
            description,
            show_score_immediately: showScoreImmediately
          },
          questions
        )
      );
      const quiz = await repository.loadQuiz(quizId);
      return quiz;
    },

    async updateQuestions(quizId, userId, questions) {
      if (!Array.isArray(questions) || questions.length < 1) {
        throw new ValidationError('Đề thi phải có ít nhất một câu hỏi.');
      }
      const safeQuestions = questions.map((question) => sanitizeQuestion(question, sanitizeText));
      await withTransaction(async (connection) => {
        const quiz = await requireQuizOwner(quizId, userId, connection);
        await assertNoAttempts(connection, quiz);
        await repository.replaceQuestions(connection, quizId, safeQuestions);
      });
      return repository.loadQuiz(quizId);
    },

    async deleteQuestion(questionId, userId) {
      return withTransaction(async (connection) => {
        const question = await repository.findQuestion(connection, questionId);
        if (!question) {
          throw new NotFoundError('Không tìm thấy câu hỏi.');
        }
        const quiz = await requireQuizOwner(question.quizId, userId, connection);
        await assertNoAttempts(connection, quiz);
        const totalQuestions = await repository.countQuestions(connection, quiz.id);
        if (totalQuestions === 1 && quiz.status === 'PUBLISHED') {
          throw new ConflictError('Đề thi đã công bố phải có ít nhất một câu hỏi.');
        }
        await repository.deleteQuestion(connection, questionId, quiz.id);
        return { id: questionId, deleted: true };
      });
    },

    async publishQuiz(quizId, userId) {
      await withTransaction(async (connection) => {
        const quiz = await requireQuizOwner(quizId, userId, connection);
        if (quiz.status !== 'DRAFT') {
          throw new ConflictError('Chỉ đề thi nháp mới có thể công bố.');
        }
        if ((await repository.countQuestions(connection, quizId)) < 1) {
          throw new ValidationError('Đề thi phải có ít nhất một câu hỏi trước khi công bố.');
        }
        await repository.publishQuiz(connection, quizId);
      });
      return repository.loadQuiz(quizId);
    }
  };
}

module.exports = { createQuizService };
