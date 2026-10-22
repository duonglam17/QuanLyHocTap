const crypto = require('node:crypto');
const {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');

const MAX_SESSION_TAKEOVERS = 5;

function parseServerDateTime(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== 'string') {
    return new Date(Number.NaN);
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  return new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}+07:00`);
}

function isExpired(attempt, now) {
  return parseServerDateTime(attempt.expiresAt).getTime() <= now.getTime();
}

function isDuplicateAttemptError(error) {
  return error && error.code === 'ER_DUP_ENTRY';
}

function createAttemptService({
  repository,
  getCourseAccess,
  withTransaction,
  clock,
  createSessionToken = () => crypto.randomBytes(32).toString('hex')
}) {
  function remainingSeconds(expiresAt) {
    const milliseconds = parseServerDateTime(expiresAt).getTime() - clock.now().getTime();
    return Math.max(0, Math.ceil(milliseconds / 1000));
  }

  async function requireEnrolledStudent(courseId, studentId) {
    const courseAccess = getCourseAccess();
    if (
      !courseAccess ||
      typeof courseAccess.getCourse !== 'function' ||
      typeof courseAccess.isEnrolled !== 'function'
    ) {
      throw new InternalServerError('Port courseAccess chưa sẵn sàng.');
    }
    const course = await courseAccess.getCourse(courseId);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học.');
    }
    if (!(await courseAccess.isEnrolled(studentId, courseId))) {
      throw new ForbiddenError('Sinh viên chưa ghi danh khóa học.');
    }
  }

  function assertAttemptInProgress(attempt, now) {
    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictError('Lượt thi đã được nộp.', null, 'ATTEMPT_ALREADY_SUBMITTED');
    }
    if (isExpired(attempt, now)) {
      throw new ConflictError('Lượt thi đã hết thời gian.', null, 'ATTEMPT_EXPIRED');
    }
  }

  function assertSession(attempt, clientInstanceId, sessionToken) {
    if (
      attempt.clientInstanceId !== clientInstanceId ||
      attempt.sessionToken !== sessionToken
    ) {
      throw new ConflictError(
        'Phiên làm bài này đã được thay thế.',
        null,
        'SESSION_REPLACED'
      );
    }
  }

  async function buildAttemptResponse(attempt) {
    const [questions, savedAnswers] = await Promise.all([
      repository.listQuestions(attempt.quizId),
      repository.listSavedAnswers(attempt.id)
    ]);
    return {
      attemptId: attempt.id,
      clientInstanceId: attempt.clientInstanceId,
      sessionToken: attempt.sessionToken,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      remaining_seconds: remainingSeconds(attempt.expiresAt),
      questions,
      savedAnswers
    };
  }

  async function handleExistingAttempt(attempt, input) {
    const now = clock.now();
    assertAttemptInProgress(attempt, now);

    if (attempt.clientInstanceId === input.clientInstanceId) {
      return buildAttemptResponse(attempt);
    }

    if (!input.takeOver) {
      throw new ConflictError(
        'Lượt thi đang hoạt động ở một cửa sổ khác.',
        null,
        'SESSION_ACTIVE_ELSEWHERE'
      );
    }

    if (attempt.takeoverCount >= MAX_SESSION_TAKEOVERS) {
      throw new ConflictError(
        'Đã vượt quá số lần chiếm quyền phiên cho lượt thi này.',
        null,
        'SESSION_TAKEOVER_LIMIT'
      );
    }

    const sessionToken = createSessionToken();
    const updated = await withTransaction((connection) =>
      repository.takeOverAttempt(connection, {
        attemptId: attempt.id,
        previousSessionToken: attempt.sessionToken,
        clientInstanceId: input.clientInstanceId,
        sessionToken,
        now
      })
    );

    if (!updated) {
      const latestAttempt = await repository.findAttemptById(attempt.id);
      if (!latestAttempt) {
        throw new NotFoundError('Không tìm thấy lượt thi.');
      }
      if (
        latestAttempt.clientInstanceId === input.clientInstanceId &&
        latestAttempt.status === 'IN_PROGRESS' &&
        !isExpired(latestAttempt, clock.now())
      ) {
        return buildAttemptResponse(latestAttempt);
      }
      assertAttemptInProgress(latestAttempt, clock.now());
      if (latestAttempt.takeoverCount >= MAX_SESSION_TAKEOVERS) {
        throw new ConflictError(
          'Đã vượt quá số lần chiếm quyền phiên cho lượt thi này.',
          null,
          'SESSION_TAKEOVER_LIMIT'
        );
      }
      throw new ConflictError(
        'Lượt thi đang hoạt động ở một cửa sổ khác.',
        null,
        'SESSION_ACTIVE_ELSEWHERE'
      );
    }

    return buildAttemptResponse({
      ...attempt,
      clientInstanceId: input.clientInstanceId,
      sessionToken
    });
  }

  return {
    async startAttempt(quizId, studentId, input) {
      if (
        !input ||
        typeof input.clientInstanceId !== 'string' ||
        input.clientInstanceId.length < 1 ||
        input.clientInstanceId.length > 128 ||
        typeof input.takeOver !== 'boolean'
      ) {
        throw new ValidationError('Thông tin định danh phiên làm bài không hợp lệ.');
      }

      const quiz = await repository.findQuizForAttempt(quizId);
      if (!quiz) {
        throw new NotFoundError('Không tìm thấy đề thi.');
      }
      await requireEnrolledStudent(quiz.courseId, studentId);

      const existingAttempt = await repository.findAttempt(quizId, studentId);
      if (existingAttempt) {
        return handleExistingAttempt(existingAttempt, input);
      }

      const now = clock.now();
      const openTime = parseServerDateTime(quiz.openTime);
      const closeTime = parseServerDateTime(quiz.closeTime);
      if (
        quiz.status !== 'PUBLISHED' ||
        now.getTime() < openTime.getTime() ||
        now.getTime() >= closeTime.getTime()
      ) {
        throw new ConflictError('Đề thi chưa mở hoặc không còn trong thời gian làm bài.', null, 'QUIZ_NOT_OPEN');
      }

      const attempt = {
        quizId,
        studentId,
        clientInstanceId: input.clientInstanceId,
        sessionToken: createSessionToken(),
        startedAt: now,
        expiresAt: new Date(now.getTime() + Number(quiz.durationMinutes) * 60_000)
      };

      try {
        const attemptId = await withTransaction((connection) =>
          repository.createAttempt(connection, attempt)
        );
        return buildAttemptResponse({ ...attempt, id: attemptId, status: 'IN_PROGRESS' });
      } catch (error) {
        if (!isDuplicateAttemptError(error)) {
          throw error;
        }
        const racedAttempt = await repository.findAttempt(quizId, studentId);
        if (!racedAttempt) {
          throw error;
        }
        return handleExistingAttempt(racedAttempt, input);
      }
    },

    async saveAnswer(attemptId, studentId, input) {
      if (
        !input ||
        typeof input.clientInstanceId !== 'string' ||
        typeof input.sessionToken !== 'string' ||
        !input.sessionToken ||
        !Number.isInteger(Number(input.questionId)) ||
        !Number.isInteger(Number(input.optionId))
      ) {
        throw new ValidationError('Thông tin câu trả lời hoặc phiên làm bài không hợp lệ.');
      }

      return withTransaction(async (connection) => {
        const attempt = await repository.findAttemptForUpdate(connection, attemptId);
        if (!attempt) {
          throw new NotFoundError('Không tìm thấy lượt thi.');
        }
        if (String(attempt.studentId) !== String(studentId)) {
          throw new ForbiddenError('Lượt thi không thuộc về sinh viên hiện tại.');
        }
        const now = clock.now();
        assertAttemptInProgress(attempt, now);
        assertSession(attempt, input.clientInstanceId, input.sessionToken);
        const validOption = await repository.optionBelongsToQuestion(
          connection,
          attempt.quizId,
          input.questionId,
          input.optionId
        );
        if (!validOption) {
          throw new ValidationError('Câu hỏi hoặc lựa chọn không thuộc đề thi.');
        }
        await repository.upsertAnswer(
          connection,
          attemptId,
          input.questionId,
          input.optionId
        );
        return {
          saved: true,
          remaining_seconds: remainingSeconds(attempt.expiresAt)
        };
      });
    }
  };
}

module.exports = { createAttemptService, MAX_SESSION_TAKEOVERS };
