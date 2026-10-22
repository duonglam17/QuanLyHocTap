const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const { ConflictError } = require('../../src/common/errors');
const errorHandler = require('../../src/common/errorHandler');
const sanitizeText = require('../../src/common/sanitizeText');
const { createRegistry } = require('../../src/contracts');
const createAttemptRepository = require('../../src/modules/m3-quiz/repositories/attemptRepository');
const createQuizResultsRepository = require('../../src/modules/m3-quiz/repositories/quizResultsRepository');
const createAttemptRoutes = require('../../src/modules/m3-quiz/routes/attemptRoutes');
const { createQuizResultsFake } = require('../../src/contracts/fakes');
const {
  createAttemptService,
  MAX_SESSION_TAKEOVERS
} = require('../../src/modules/m3-quiz/services/attemptService');
const {
  startAttemptSchema,
  saveAnswerSchema
} = require('../../src/modules/m3-quiz/validators/attemptSchemas');

const now = new Date('2026-11-25T01:00:00.000Z');
const expiresAt = new Date('2026-11-25T01:30:00.000Z');

function createAttempt(overrides = {}) {
  return {
    id: 71,
    quizId: 5,
    studentId: 12,
    clientInstanceId: 'tab-one',
    sessionToken: 'session-one',
    startedAt: new Date('2026-11-25T00:30:00.000Z'),
    expiresAt,
    status: 'IN_PROGRESS',
    takeoverCount: 0,
    quizTitle: 'Quiz',
    showScoreImmediately: true,
    quizCloseTime: new Date('2026-11-25T02:00:00.000Z'),
    quizStatus: 'PUBLISHED',
    score: null,
    submittedAt: null,
    ...overrides
  };
}

function createService({ initialAttempt = null, clockNow = now } = {}) {
  let attempt = initialAttempt && { ...initialAttempt };
  let nextAttemptId = 71;
  let savedAnswers = [{ questionId: 9, optionId: 92 }];
  let nowValue = clockNow;
  const takeoverUpdates = [];
  const saved = [];
  const logger = {
    errors: [],
    error(message, error) {
      this.errors.push({ message, error });
    }
  };
  let gradingCount = 0;
  const quiz = {
    id: 5,
    courseId: 8,
    durationMinutes: 30,
    openTime: new Date('2026-11-25T00:00:00.000Z'),
    closeTime: new Date('2026-11-25T02:00:00.000Z'),
    status: 'PUBLISHED'
  };
  const repository = {
    async findQuizForAttempt() {
      return quiz;
    },
    async findAttempt() {
      return attempt && { ...attempt };
    },
    async findAttemptById() {
      return attempt && { ...attempt };
    },
    async findAttemptForUpdate() {
      return attempt && { ...attempt };
    },
    async createAttempt(_connection, data) {
      if (attempt) {
        const error = new Error('Duplicate attempt');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      attempt = {
        ...data,
        id: nextAttemptId,
        status: 'IN_PROGRESS',
        takeoverCount: 0
      };
      return nextAttemptId;
    },
    async takeOverAttempt(_connection, data) {
      takeoverUpdates.push(data);
      if (
        !attempt ||
        attempt.status !== 'IN_PROGRESS' ||
        attempt.expiresAt <= data.now ||
        attempt.sessionToken !== data.previousSessionToken ||
        attempt.clientInstanceId === data.clientInstanceId ||
        attempt.takeoverCount >= MAX_SESSION_TAKEOVERS
      ) {
        return false;
      }
      attempt = {
        ...attempt,
        clientInstanceId: data.clientInstanceId,
        sessionToken: data.sessionToken,
        takeoverCount: attempt.takeoverCount + 1,
        lastTakeoverAt: data.now
      };
      return true;
    },
    async listQuestions() {
      return [
        {
          id: 9,
          content: 'Question',
          orderIndex: 1,
          options: [{ id: 91, content: 'A', orderIndex: 1 }, { id: 92, content: 'B', orderIndex: 2 }]
        }
      ];
    },
    async listSavedAnswers() {
      return savedAnswers.map((answer) => ({ ...answer }));
    },
    async optionBelongsToQuestion(_connection, quizId, questionId, optionId) {
      return quizId === 5 && questionId === 9 && optionId === 92;
    },
    async upsertAnswer(_connection, attemptId, questionId, optionId) {
      saved.push({ attemptId, questionId, optionId });
      savedAnswers = [{ questionId, optionId }];
    },
    async gradeAttempt() {
      gradingCount++;
      return { totalQuestions: 4, correctAnswersCount: 3, score: 7.5 };
    },
    async completeAttempt(_connection, attemptId, result) {
      if (!attempt || attempt.id !== attemptId || attempt.status !== 'IN_PROGRESS') {
        return false;
      }
      attempt = { ...attempt, ...result };
      return true;
    },
    async markQuizHasAttempts() {},
    async listExpiredAttemptIds() {
      return attempt?.status === 'IN_PROGRESS' && attempt.expiresAt <= nowValue
        ? [attempt.id]
        : [];
    }
  };
  const courseAccess = {
    async getCourse(courseId) {
      return { id: courseId, status: 'PUBLISHED' };
    },
    async isEnrolled(studentId, courseId) {
      return studentId === 12 && courseId === 8;
    }
  };
  let tokenNumber = 0;
  const service = createAttemptService({
    repository,
    getCourseAccess: () => courseAccess,
    withTransaction: async (work) => work({}),
    clock: { now: () => new Date(nowValue) },
    logger,
    createSessionToken: () => `generated-session-${++tokenNumber}`
  });

  return {
    service,
    repository,
    takeoverUpdates,
    saved,
    logger,
    getGradingCount: () => gradingCount,
    getAttempt: () => attempt,
    setNow(value) {
      nowValue = value;
    }
  };
}

test('same client instance resumes the same attempt and restores saved answers', async () => {
  const original = createAttempt();
  const { service } = createService({ initialAttempt: original });

  const result = await service.startAttempt(5, 12, {
    clientInstanceId: original.clientInstanceId,
    takeOver: false
  });

  assert.equal(result.attemptId, original.id);
  assert.equal(result.sessionToken, original.sessionToken);
  assert.equal(result.startedAt, original.startedAt);
  assert.equal(result.expiresAt, original.expiresAt);
  assert.deepEqual(result.savedAnswers, [{ questionId: 9, optionId: 92 }]);
  assert.equal(result.remaining_seconds, 1800);
  assert.equal(JSON.stringify(result).includes('is_correct'), false);
});

test('a different client instance is rejected without question or answer data', async () => {
  const { service } = createService({ initialAttempt: createAttempt() });

  await assert.rejects(
    service.startAttempt(5, 12, { clientInstanceId: 'tab-two', takeOver: false }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'SESSION_ACTIVE_ELSEWHERE');
      assert.equal(error.details, null);
      assert.equal(Object.hasOwn(error, 'questions'), false);
      assert.equal(Object.hasOwn(error, 'savedAnswers'), false);
      return true;
    }
  );
});

test('concurrent starts create one attempt and only its client instance wins', async () => {
  const { service, getAttempt } = createService();
  const results = await Promise.allSettled([
    service.startAttempt(5, 12, { clientInstanceId: 'tab-one', takeOver: false }),
    service.startAttempt(5, 12, { clientInstanceId: 'tab-two', takeOver: false })
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'SESSION_ACTIVE_ELSEWHERE');
  assert.ok(['tab-one', 'tab-two'].includes(getAttempt().clientInstanceId));
});

test('explicit takeover replaces the session and rejects saves from the old session', async () => {
  const { service, getAttempt, takeoverUpdates } = createService({
    initialAttempt: createAttempt()
  });

  const result = await service.startAttempt(5, 12, {
    clientInstanceId: 'tab-two',
    takeOver: true
  });
  assert.equal(result.clientInstanceId, 'tab-two');
  assert.equal(result.sessionToken, 'generated-session-1');
  assert.equal(result.startedAt.getTime(), createAttempt().startedAt.getTime());
  assert.equal(result.expiresAt.getTime(), expiresAt.getTime());
  assert.equal(getAttempt().takeoverCount, 1);
  assert.equal(takeoverUpdates.length, 1);
  assert.equal(takeoverUpdates[0].now.getTime(), now.getTime());

  await assert.rejects(
    service.saveAnswer(71, 12, {
      clientInstanceId: 'tab-one',
      sessionToken: 'session-one',
      questionId: 9,
      optionId: 92
    }),
    (error) => error.code === 'SESSION_REPLACED' && error.statusCode === 409
  );
  await assert.rejects(
    service.submitAttempt(71, 12, {
      clientInstanceId: 'tab-one',
      sessionToken: 'session-one'
    }),
    (error) => error.code === 'SESSION_REPLACED' && error.statusCode === 409
  );
});

test('takeover is rejected after five replacements', async () => {
  const { service, takeoverUpdates } = createService({
    initialAttempt: createAttempt({ takeoverCount: MAX_SESSION_TAKEOVERS })
  });

  await assert.rejects(
    service.startAttempt(5, 12, { clientInstanceId: 'tab-new', takeOver: true }),
    (error) => error.code === 'SESSION_TAKEOVER_LIMIT' && error.statusCode === 409
  );
  assert.equal(takeoverUpdates.length, 0);
});

test('expired and submitted attempts cannot be taken over', async (t) => {
  await t.test('expired attempt', async () => {
    const { service, takeoverUpdates } = createService({
      initialAttempt: createAttempt({ expiresAt: new Date(now.getTime() - 1000) })
    });
    await assert.rejects(
      service.startAttempt(5, 12, { clientInstanceId: 'tab-new', takeOver: true }),
      (error) => error.code === 'ATTEMPT_EXPIRED' && error.statusCode === 409
    );
    assert.equal(takeoverUpdates.length, 0);
  });

  await t.test('submitted attempt', async () => {
    const { service, takeoverUpdates } = createService({
      initialAttempt: createAttempt({ status: 'SUBMITTED' })
    });
    await assert.rejects(
      service.startAttempt(5, 12, { clientInstanceId: 'tab-new', takeOver: true }),
      (error) =>
        error.code === 'ATTEMPT_ALREADY_SUBMITTED' && error.statusCode === 409
    );
    assert.equal(takeoverUpdates.length, 0);
  });
});

test('saving an answer validates the session and returns server remaining time', async () => {
  const { service, saved } = createService({ initialAttempt: createAttempt() });

  const result = await service.saveAnswer(71, 12, {
    clientInstanceId: 'tab-one',
    sessionToken: 'session-one',
    questionId: 9,
    optionId: 92
  });

  assert.deepEqual(result, { saved: true, remaining_seconds: 1800 });
  assert.deepEqual(saved, [{ attemptId: 71, questionId: 9, optionId: 92 }]);
});

test('repository takeover uses a conditional atomic update and affected row count', async () => {
  let query;
  const repository = createAttemptRepository({});
  const updated = await repository.takeOverAttempt(
    {
      async query(sql, values) {
        query = { sql, values };
        return [{ affectedRows: 1 }];
      }
    },
    {
      attemptId: 71,
      previousSessionToken: 'old',
      clientInstanceId: 'tab-two',
      sessionToken: 'new',
      now
    }
  );

  assert.equal(updated, true);
  assert.match(query.sql, /UPDATE attempts\s+SET client_instance_id = \?, session_token = \?/);
  assert.match(query.sql, /status = 'IN_PROGRESS'/);
  assert.match(query.sql, /expires_at > \?/);
  assert.match(query.sql, /session_token = \?/);
  assert.match(query.sql, /takeover_count < 5/);
  assert.deepEqual(query.values, ['tab-two', 'new', now, 71, now, 'old', 'tab-two']);
});

test('repository reports a lost conditional takeover when no row was updated', async () => {
  const repository = createAttemptRepository({});
  const updated = await repository.takeOverAttempt(
    {
      async query() {
        return [{ affectedRows: 0 }];
      }
    },
    {
      attemptId: 71,
      previousSessionToken: 'old',
      clientInstanceId: 'tab-two',
      sessionToken: 'new',
      now
    }
  );

  assert.equal(updated, false);
});

test('repository grades all questions with one grouped query and normalizes score to ten', async () => {
  let query;
  const repository = createAttemptRepository({});
  const result = await repository.gradeAttempt(
    {
      async query(sql, values) {
        query = { sql, values };
        return [[{ totalQuestions: 3, correctAnswersCount: 1 }]];
      }
    },
    5,
    71
  );

  assert.match(query.sql, /COUNT\(DISTINCT q\.id\)/);
  assert.match(query.sql, /LEFT JOIN attempt_answers/);
  assert.match(query.sql, /LEFT JOIN options/);
  assert.deepEqual(query.values, [71, 5]);
  assert.deepEqual(result, {
    totalQuestions: 3,
    correctAnswersCount: 1,
    score: 3.33
  });
});

test('manual submit grades once and repeated submit returns the stored result', async () => {
  const { service, getAttempt, getGradingCount } = createService({
    initialAttempt: createAttempt()
  });
  const input = { clientInstanceId: 'tab-one', sessionToken: 'session-one' };

  const first = await service.submitAttempt(71, 12, input);
  const repeated = await service.submitAttempt(71, 12, input);

  assert.deepEqual(first, {
    attemptId: 71,
    status: 'SUBMITTED',
    submittedAt: now,
    score: 7.5,
    visibleToStudent: true
  });
  assert.deepEqual(repeated, first);
  assert.equal(getAttempt().totalQuestions, 4);
  assert.equal(getAttempt().correctAnswersCount, 3);
  assert.equal(getGradingCount(), 1);
});

test('manual submit after expiry is auto-submitted and score visibility follows quiz settings', async () => {
  const { service, getAttempt } = createService({
    initialAttempt: createAttempt({
      showScoreImmediately: false,
      quizCloseTime: new Date('2026-11-25T02:00:00.000Z')
    }),
    clockNow: new Date(expiresAt.getTime() + 1000)
  });

  const result = await service.submitAttempt(71, 12, {
    clientInstanceId: 'tab-one',
    sessionToken: 'session-one'
  });

  assert.equal(result.status, 'AUTO_SUBMITTED');
  assert.equal(result.score, null);
  assert.equal(result.visibleToStudent, false);
  assert.equal(getAttempt().score, 7.5);
});

test('expired save-answer lazily auto-submits before returning a conflict', async () => {
  const { service, getAttempt, getGradingCount } = createService({
    initialAttempt: createAttempt(),
    clockNow: new Date(expiresAt.getTime() + 1000)
  });

  await assert.rejects(
    service.saveAnswer(71, 12, {
      clientInstanceId: 'tab-one',
      sessionToken: 'session-one',
      questionId: 9,
      optionId: 92
    }),
    (error) => error.code === 'ATTEMPT_EXPIRED' && error.statusCode === 409
  );
  assert.equal(getAttempt().status, 'AUTO_SUBMITTED');
  assert.equal(getGradingCount(), 1);
});

test('an expired save from a replaced session is rejected without using that request to finalize', async () => {
  const { service, getAttempt, getGradingCount } = createService({
    initialAttempt: createAttempt({
      clientInstanceId: 'tab-two',
      sessionToken: 'session-two',
      expiresAt: new Date(now.getTime() - 1000)
    })
  });

  await assert.rejects(
    service.saveAnswer(71, 12, {
      clientInstanceId: 'tab-one',
      sessionToken: 'session-one',
      questionId: 9,
      optionId: 92
    }),
    (error) => error.code === 'SESSION_REPLACED' && error.statusCode === 409
  );
  assert.equal(getAttempt().status, 'IN_PROGRESS');
  assert.equal(getGradingCount(), 0);
});

test('a save after prior submission does not attempt to grade the expired attempt again', async () => {
  const { service, getGradingCount } = createService({
    initialAttempt: createAttempt({
      status: 'SUBMITTED',
      score: 7.5,
      expiresAt: new Date(now.getTime() - 1000)
    }),
    clockNow: now
  });

  await assert.rejects(
    service.saveAnswer(71, 12, {
      clientInstanceId: 'tab-one',
      sessionToken: 'session-one',
      questionId: 9,
      optionId: 92
    }),
    (error) =>
      error.code === 'ATTEMPT_ALREADY_SUBMITTED' && error.statusCode === 409
  );
  assert.equal(getGradingCount(), 0);
});

test('expired attempts are auto-submitted by the server sweep', async () => {
  const { service, getAttempt, logger } = createService({
    initialAttempt: createAttempt({ expiresAt: new Date(now.getTime() - 1) })
  });

  const result = await service.autoSubmitExpiredAttempts();

  assert.deepEqual(result, { processed: 1, found: 1 });
  assert.equal(getAttempt().status, 'AUTO_SUBMITTED');
  assert.equal(logger.errors.length, 0);
});

test('quizResults repository uses one parameterized query for all students and returns contract shape', async () => {
  const queries = [];
  const rows = [
    {
      studentId: 12,
      quizId: 5,
      quizTitle: 'Quiz',
      score: '7.50',
      attemptStatus: 'SUBMITTED',
      submittedAt: new Date('2026-11-25T01:00:00.000Z'),
      visibleToStudent: 1
    },
    {
      studentId: 13,
      quizId: 5,
      quizTitle: 'Quiz',
      score: null,
      attemptStatus: null,
      submittedAt: null,
      visibleToStudent: 0
    }
  ];
  const repository = createQuizResultsRepository(
    {
      async query(sql, values) {
        queries.push({ sql, values });
        return [rows];
      }
    },
    { now: () => now }
  );

  const results = await repository.getQuizScoresForCourse(8, [12, 13, 12]);

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /q\.status IN \('PUBLISHED', 'CLOSED'\)/);
  assert.match(queries[0].sql, /LEFT JOIN attempts/);
  assert.deepEqual(queries[0].values, [now, 12, 13, 8]);
  assert.deepEqual(results, [
    {
      studentId: 12,
      quizId: 5,
      quizTitle: 'Quiz',
      maxScore: 10,
      score: 7.5,
      attemptStatus: 'SUBMITTED',
      submittedAt: '2026-11-25T01:00:00.000Z',
      visibleToStudent: true
    },
    {
      studentId: 13,
      quizId: 5,
      quizTitle: 'Quiz',
      maxScore: 10,
      score: null,
      attemptStatus: null,
      submittedAt: null,
      visibleToStudent: false
    }
  ]);
});

test('quizResults implementation and provided fake return the same public shape', async () => {
  const expected = {
    studentId: 12,
    quizId: 5,
    quizTitle: 'Quiz',
    maxScore: 10,
    score: 7.5,
    attemptStatus: 'SUBMITTED',
    submittedAt: '2026-11-25T01:00:00.000Z',
    visibleToStudent: true
  };
  const repository = createQuizResultsRepository(
    {
      async query() {
        return [[{
          ...expected,
          score: '7.50',
          visibleToStudent: 1,
          submittedAt: new Date(expected.submittedAt)
        }]];
      }
    },
    { now: () => now }
  );
  const fake = createQuizResultsFake({
    courseScores: { 8: [expected] },
    studentScores: { '8:12': [expected] }
  });

  assert.deepEqual(
    Object.keys(await repository.getQuizScoresForCourse(8, [12])),
    Object.keys(await fake.getQuizScoresForCourse(8, [12]))
  );
  assert.deepEqual(
    await repository.getQuizScoresForStudent(8, 12),
    await fake.getQuizScoresForStudent(8, 12)
  );
  assert.deepEqual(
    Object.keys((await repository.getQuizScoresForStudent(8, 12))[0]).sort(),
    Object.keys(expected).sort()
  );
});

test('module init registers the real quizResults port and starts the expiry sweep', async () => {
  const { init } = require('../../src/modules/m3-quiz');
  const registry = createRegistry();
  const cronCalls = [];
  const nowValue = new Date('2026-11-25T01:00:00.000Z');
  const expectedRows = [{
    studentId: 12,
    quizId: 5,
    quizTitle: 'Quiz',
    maxScore: 10,
    score: '8.00',
    attemptStatus: 'AUTO_SUBMITTED',
    submittedAt: new Date('2026-11-25T00:30:00.000Z'),
    visibleToStudent: 1
  }];
  init({
    db: {
      async query(sql) {
        assert.match(sql, /FROM quizzes q/);
        return [expectedRows];
      }
    },
    logger: { error() {} },
    common: {
      sanitizeText,
      withTransaction: async (work) => work({}),
      clock: { now: () => nowValue }
    },
    contracts: registry,
    cron: {
      schedule(expression, callback) {
        cronCalls.push({ expression, callback });
        return { stop() {} };
      }
    }
  });

  const quizResults = registry.getPort('quizResults');
  assert.equal(typeof quizResults.getQuizScoresForCourse, 'function');
  assert.equal(typeof quizResults.getQuizScoresForStudent, 'function');
  assert.deepEqual(await quizResults.getQuizScoresForStudent(8, 12), [{
    studentId: 12,
    quizId: 5,
    quizTitle: 'Quiz',
    maxScore: 10,
    score: 8,
    attemptStatus: 'AUTO_SUBMITTED',
    submittedAt: '2026-11-25T00:30:00.000Z',
    visibleToStudent: true
  }]);
  assert.equal(cronCalls[0].expression, '* * * * *');
});

test('start and save-answer schemas expose the approved session fields', () => {
  assert.equal(
    startAttemptSchema.safeParse({
      params: { quizId: '5' },
      body: { clientInstanceId: 'tab-one' }
    }).success,
    true
  );
  assert.equal(
    saveAnswerSchema.safeParse({
      params: { attemptId: '71' },
      body: {
        questionId: 9,
        optionId: 92,
        clientInstanceId: 'tab-one',
        sessionToken: 'session-one'
      }
    }).success,
    true
  );
});

test('attempt routes apply defaults and return only the 409 error envelope on session conflicts', async () => {
  const calls = [];
  const service = {
    async startAttempt(...args) {
      calls.push(args);
      throw new ConflictError(
        'Lượt thi đang hoạt động ở một cửa sổ khác.',
        null,
        'SESSION_ACTIVE_ELSEWHERE'
      );
    },
    async saveAnswer() {
      throw new ConflictError('Phiên làm bài này đã được thay thế.', null, 'SESSION_REPLACED');
    },
    async submitAttempt() {
      throw new ConflictError('Phiên làm bài này đã được thay thế.', null, 'SESSION_REPLACED');
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createAttemptRoutes(service));
  app.use(errorHandler);
  const token = jwt.sign(
    { user_id: 12, role: 'SINH_VIEN', token_version: 1 },
    config.JWT_SECRET
  );
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }]];

  try {
    const startResponse = await request(app)
      .post('/api/quizzes/5/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientInstanceId: 'tab-two' });
    assert.equal(startResponse.status, 409);
    assert.equal(startResponse.body.code, 'SESSION_ACTIVE_ELSEWHERE');
    assert.deepEqual(startResponse.body.details, null);
    assert.equal(Object.hasOwn(startResponse.body, 'questions'), false);
    assert.equal(calls[0][2].takeOver, false);

    const saveResponse = await request(app)
      .patch('/api/attempts/71/save-answer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId: 9,
        optionId: 92,
        clientInstanceId: 'tab-one',
        sessionToken: 'old-session'
      });
    assert.equal(saveResponse.status, 409);
    assert.equal(saveResponse.body.code, 'SESSION_REPLACED');
    assert.deepEqual(saveResponse.body.details, null);
    assert.equal(Object.hasOwn(saveResponse.body, 'questions'), false);

    const submitResponse = await request(app)
      .post('/api/attempts/71/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientInstanceId: 'tab-one', sessionToken: 'old-session' });
    assert.equal(submitResponse.status, 409);
    assert.equal(submitResponse.body.code, 'SESSION_REPLACED');
    assert.deepEqual(submitResponse.body.details, null);
    assert.equal(Object.hasOwn(submitResponse.body, 'questions'), false);
  } finally {
    db.query = originalQuery;
  }
});
