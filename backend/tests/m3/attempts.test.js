const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const { ConflictError } = require('../../src/common/errors');
const errorHandler = require('../../src/common/errorHandler');
const createAttemptRepository = require('../../src/modules/m3-quiz/repositories/attemptRepository');
const createAttemptRoutes = require('../../src/modules/m3-quiz/routes/attemptRoutes');
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
    createSessionToken: () => `generated-session-${++tokenNumber}`
  });

  return {
    service,
    repository,
    takeoverUpdates,
    saved,
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
  } finally {
    db.query = originalQuery;
  }
});
