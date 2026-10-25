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
  logger,
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

  function isScoreVisible(attempt, now) {
    return (
      Boolean(attempt.showScoreImmediately) ||
      attempt.quizStatus === 'CLOSED' ||
      parseServerDateTime(attempt.quizCloseTime).getTime() <= now.getTime()
    );
  }

  function formatDateTime(value) {
    return value == null ? null : parseServerDateTime(value).toISOString();
  }

  function buildSubmissionResult(attempt, now) {
    const visibleToStudent = isScoreVisible(attempt, now);
    return {
      attemptId: attempt.id,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
      score: visibleToStudent && attempt.score !== null ? Number(attempt.score) : null,
      visibleToStudent
    };
  }

  async function completeAttempt(connection, attempt, status, submittedAt) {
    const grade = await repository.gradeAttempt(
      connection,
      attempt.quizId,
      attempt.id
    );
    const updated = await repository.completeAttempt(
      connection,
      attempt.id,
      {
        ...grade,
        status,
        submittedAt,
        score: grade.score
      }
    );
    if (!updated) {
      throw new InternalServerError('Không thể cập nhật kết quả lượt thi.');
    }
    await repository.markQuizHasAttempts(connection, attempt.quizId);
    return {
      ...attempt,
      ...grade,
      status,
      submittedAt,
      score: grade.score
    };
  }

  async function finalizeAttempt(attemptId, studentId, session, forceAutoSubmit = false) {
    return withTransaction(async (connection) => {
      const attempt = await repository.findAttemptForUpdate(connection, attemptId);
      if (!attempt) {
        throw new NotFoundError('Không tìm thấy lượt thi.');
      }
      if (studentId != null && String(attempt.studentId) !== String(studentId)) {
        throw new ForbiddenError('Lượt thi không thuộc về sinh viên hiện tại.');
      }
      if (session) {
        assertSession(attempt, session.clientInstanceId, session.sessionToken);
      }

      const now = clock.now();
      if (attempt.status !== 'IN_PROGRESS') {
        return buildSubmissionResult(attempt, now);
      }

      const expired = isExpired(attempt, now);
      if (forceAutoSubmit && !expired) {
        return null;
      }
      const resultAttempt = await completeAttempt(
        connection,
        attempt,
        expired ? 'AUTO_SUBMITTED' : 'SUBMITTED',
        now
      );
      return buildSubmissionResult(resultAttempt, now);
    });
  }

  async function autoSubmitExpiredAttempts() {
    const now = clock.now();
    const attemptIds = await repository.listExpiredAttemptIds(now);
    let processed = 0;
    for (const attemptId of attemptIds) {
      try {
        const result = await finalizeAttempt(attemptId, null, null, true);
        if (result) {
          processed++;
        }
      } catch (error) {
        logger.error(`Không thể tự thu lượt thi ${attemptId}.`, error);
      }
    }
    return { processed, found: attemptIds.length };
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
    if (attempt.status !== 'IN_PROGRESS') {
      assertAttemptInProgress(attempt, now);
    }
    if (isExpired(attempt, now)) {
      await finalizeAttempt(attempt.id, null, null, true);
      throw new ConflictError('Lượt thi đã hết thời gian.', null, 'ATTEMPT_EXPIRED');
    }

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

      const result = await withTransaction(async (connection) => {
        const attempt = await repository.findAttemptForUpdate(connection, attemptId);
        if (!attempt) {
          throw new NotFoundError('Không tìm thấy lượt thi.');
        }
        if (String(attempt.studentId) !== String(studentId)) {
          throw new ForbiddenError('Lượt thi không thuộc về sinh viên hiện tại.');
        }
        const now = clock.now();
        assertSession(attempt, input.clientInstanceId, input.sessionToken);
        if (attempt.status !== 'IN_PROGRESS') {
          assertAttemptInProgress(attempt, now);
        }
        if (isExpired(attempt, now)) {
          const resultAttempt = await completeAttempt(
            connection,
            attempt,
            'AUTO_SUBMITTED',
            now
          );
          return { expired: true, result: buildSubmissionResult(resultAttempt, now) };
        }
        assertAttemptInProgress(attempt, now);
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
          expired: false,
          response: {
            saved: true,
            remaining_seconds: remainingSeconds(attempt.expiresAt)
          }
        };
      });
      if (result.expired) {
        throw new ConflictError('Lượt thi đã hết thời gian.', null, 'ATTEMPT_EXPIRED');
      }
      return result.response;
    },

    submitAttempt(attemptId, studentId, input) {
      if (
        !input ||
        typeof input.clientInstanceId !== 'string' ||
        typeof input.sessionToken !== 'string' ||
        !input.sessionToken
      ) {
        throw new ValidationError('Thông tin phiên làm bài không hợp lệ.');
      }
      return finalizeAttempt(attemptId, studentId, input);
    },

    async getAttemptResult(attemptId, userId, role) {
      let attempt = await repository.findAttemptResultById(attemptId);
      if (!attempt) {
        throw new NotFoundError('Không tìm thấy lượt thi.');
      }

      if (role === 'SINH_VIEN') {
        if (String(attempt.studentId) !== String(userId)) {
          throw new ForbiddenError('Lượt thi không thuộc về sinh viên hiện tại.');
        }
      } else if (role === 'GIANG_VIEN') {
        const courseAccess = getCourseAccess();
        if (
          !courseAccess ||
          typeof courseAccess.getCourse !== 'function' ||
          typeof courseAccess.isOwner !== 'function'
        ) {
          throw new InternalServerError('Port courseAccess chưa sẵn sàng.');
        }
        const course = await courseAccess.getCourse(attempt.courseId);
        if (!course) {
          throw new NotFoundError('Không tìm thấy khóa học.');
        }
        if (!(await courseAccess.isOwner(userId, attempt.courseId))) {
          throw new ForbiddenError('Chỉ chủ khóa học mới được xem kết quả lượt thi.');
        }
      } else {
        throw new ForbiddenError('Không có quyền xem kết quả lượt thi.');
      }

      const now = clock.now();
      if (attempt.status === 'IN_PROGRESS' && isExpired(attempt, now)) {
        await finalizeAttempt(attemptId, null, null, true);
        attempt = await repository.findAttemptResultById(attemptId);
        if (!attempt) {
          throw new NotFoundError('Không tìm thấy lượt thi.');
        }
      }

      const visibleToStudent = isScoreVisible(attempt, clock.now());
      const isGraded = attempt.status !== 'IN_PROGRESS' && attempt.score != null;
      return {
        attemptId: Number(attempt.attemptId),
        quizId: Number(attempt.quizId),
        quizTitle: attempt.quizTitle,
        status: attempt.status,
        startedAt: formatDateTime(attempt.startedAt),
        submittedAt: formatDateTime(attempt.submittedAt),
        expiresAt: formatDateTime(attempt.expiresAt),
        totalQuestions: Number(attempt.totalQuestions),
        answeredCount: Number(attempt.answeredCount),
        visibleToStudent,
        maxScore: 10,
        score: visibleToStudent && isGraded ? Number(attempt.score) : null,
        correctCount:
          visibleToStudent && isGraded && attempt.correctAnswersCount != null
            ? Number(attempt.correctAnswersCount)
            : null
      };
    },

    autoSubmitExpiredAttempts
  };
}

module.exports = { createAttemptService, MAX_SESSION_TAKEOVERS };
