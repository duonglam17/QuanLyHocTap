const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const sanitizeText = require('../../src/common/sanitizeText');
const { createCourseAccessFake } = require('../../src/contracts/fakes');
const createQuizRepository = require('../../src/modules/m3-quiz/repositories/quizRepository');
const createQuizRoutes = require('../../src/modules/m3-quiz/routes/quizRoutes');
const { createQuizService } = require('../../src/modules/m3-quiz/services/quizService');

const serverNow = new Date('2026-11-25T01:00:00.000Z');

function createQuiz(overrides = {}) {
  return {
    id: 55,
    courseId: 1,
    title: 'Midterm quiz',
    description: 'Chapters 1-3',
    durationMinutes: 30,
    openTime: '2026-11-25 08:00:00',
    closeTime: '2026-11-25 10:00:00',
    showScoreImmediately: false,
    status: 'PUBLISHED',
    hasAttempts: false,
    ...overrides
  };
}

function createFixture({
  courseStatus = 'PUBLISHED',
  quiz = createQuiz(),
  attempts = false
} = {}) {
  const calls = [];
  const connection = { transaction: true };
  let storedQuiz = { ...quiz, hasAttempts: attempts || quiz.hasAttempts };
  const questions = [
    {
      id: 90,
      content: 'Question one?',
      orderIndex: 1,
      options: [
        { id: 91, content: 'Correct', isCorrect: true, orderIndex: 1 },
        { id: 92, content: 'Incorrect', isCorrect: false, orderIndex: 2 }
      ]
    }
  ];
  const repository = {
    async findQuiz(quizId) {
      calls.push({ operation: 'findQuiz', quizId });
      return String(quizId) === String(storedQuiz.id) ? { ...storedQuiz } : null;
    },
    async loadQuiz(quizId) {
      calls.push({ operation: 'loadQuiz', quizId });
      return { ...storedQuiz, hasAttempts: Boolean(storedQuiz.hasAttempts), questions };
    },
    async findQuizQuestions(quizId) {
      calls.push({ operation: 'findQuizQuestions', quizId });
      return questions;
    },
    async listOwnerQuizzes(courseId, pagination) {
      calls.push({ operation: 'listOwnerQuizzes', courseId, pagination });
      return {
        items: [
          { ...storedQuiz, hasAttempts: Boolean(storedQuiz.hasAttempts), questionCount: 1 }
        ],
        total: 31
      };
    },
    async listStudentQuizzes(courseId, studentId, options) {
      calls.push({ operation: 'listStudentQuizzes', courseId, studentId, options });
      return {
        items: [
          {
            ...storedQuiz,
            attemptStatus: null,
            canStart: true,
            score: null
          }
        ],
        total: 1
      };
    },
    async findQuizForUpdate(_connection, quizId) {
      calls.push({ operation: 'findQuizForUpdate', quizId });
      return String(quizId) === String(storedQuiz.id) ? { ...storedQuiz } : null;
    },
    async hasAttempts() {
      return Boolean(storedQuiz.hasAttempts);
    },
    async updateQuiz(_connection, quizId, updated) {
      calls.push({ operation: 'updateQuiz', quizId, updated });
      storedQuiz = { ...storedQuiz, ...updated };
    },
    async countQuestions() {
      return questions.length;
    },
    async replaceQuestions() {},
    async deleteQuestion() {},
    async publishQuiz() {}
  };
  const courseAccess = createCourseAccessFake({
    courses: [{ id: 1, ownerId: 2, title: 'Course', status: courseStatus }],
    enrolledStudentIds: [3]
  });
  const service = createQuizService({
    repository,
    getCourseAccess: () => courseAccess,
    withTransaction: async (work) => work(connection),
    sanitizeText,
    clock: { now: () => serverNow }
  });

  return { calls, courseAccess, repository, service, connection };
}

function createApp(service) {
  const app = express();
  app.use(express.json());
  app.use(createQuizRoutes(service));
  app.use(errorHandler);
  return app;
}

function tokenFor(userId, role) {
  return jwt.sign(
    { user_id: userId, role, token_version: 1 },
    config.JWT_SECRET
  );
}

async function withAuthenticatedDatabase(callback) {
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }]];
  try {
    await callback();
  } finally {
    db.query = originalQuery;
  }
}

function authenticatedRequest(app, method, path, userId, role) {
  return request(app)[method](path)
    .set('Authorization', String.fromCharCode(66, 101, 97, 114, 101, 114, 32) + tokenFor(userId, role));
}

test('owner quiz listing paginates and includes drafts and editing metadata', async () => {
  const fixture = createFixture({ quiz: createQuiz({ status: 'DRAFT' }) });
  const app = createApp(fixture.service);

  await withAuthenticatedDatabase(async () => {
    const response = await authenticatedRequest(
      app,
      'get',
      '/courses/1/quizzes?page=2&limit=1',
      2,
      'GIANG_VIEN'
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.items[0].status, 'DRAFT');
    assert.equal(response.body.items[0].questionCount, 1);
    assert.equal(response.body.items[0].hasAttempts, false);
    assert.equal(response.body.page, 2);
    assert.equal(response.body.limit, 1);
    assert.equal(response.body.total, 31);
    assert.equal(fixture.calls[0].operation, 'listOwnerQuizzes');
    assert.deepEqual(fixture.calls[0].pagination, { page: 2, limit: 1 });
  });
});

test('student listing exposes only published quiz state and omits a hidden score', async () => {
  const fixture = createFixture();
  const app = createApp(fixture.service);

  await withAuthenticatedDatabase(async () => {
    const response = await authenticatedRequest(
      app,
      'get',
      '/courses/1/quizzes',
      3,
      'SINH_VIEN'
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.items[0].attemptStatus, 'NOT_STARTED');
    assert.equal(response.body.items[0].canStart, true);
    assert.equal(response.body.items[0].visibleToStudent, false);
    assert.equal(Object.hasOwn(response.body.items[0], 'score'), false);
    assert.equal(Object.hasOwn(response.body.items[0], 'questions'), false);
    const serialized = JSON.stringify(response.body).toLowerCase();
    for (const forbiddenKey of ['iscorrect', 'is_correct', 'correct']) {
      assert.equal(serialized.includes(forbiddenKey), false);
    }
    assert.equal(fixture.calls[0].operation, 'listStudentQuizzes');
    assert.equal(fixture.calls[0].studentId, 3);
    assert.equal(fixture.calls[0].options.now, serverNow);
  });
});

test('student listing includes a score only when visible to the student', async () => {
  const fixture = createFixture({
    quiz: createQuiz({ showScoreImmediately: true })
  });
  fixture.repository.listStudentQuizzes = async () => ({
    items: [{ ...createQuiz({ showScoreImmediately: true }), attemptStatus: 'SUBMITTED', score: '8.50' }],
    total: 1
  });
  const app = createApp(fixture.service);

  await withAuthenticatedDatabase(async () => {
    const response = await authenticatedRequest(app, 'get', '/courses/1/quizzes', 3, 'SINH_VIEN');
    assert.equal(response.status, 200);
    assert.equal(response.body.items[0].visibleToStudent, true);
    assert.equal(response.body.items[0].score, 8.5);
  });
});

test('quiz list denies another instructor and an unregistered student and reports missing courses', async () => {
  const fixture = createFixture();
  const app = createApp(fixture.service);

  await withAuthenticatedDatabase(async () => {
    const otherInstructor = await authenticatedRequest(
      app,
      'get',
      '/courses/1/quizzes',
      4,
      'GIANG_VIEN'
    );
    const outsider = await authenticatedRequest(
      app,
      'get',
      '/courses/1/quizzes',
      4,
      'SINH_VIEN'
    );
    const missingCourse = await authenticatedRequest(
      app,
      'get',
      '/courses/999/quizzes',
      3,
      'SINH_VIEN'
    );
    assert.equal(otherInstructor.status, 403);
    assert.equal(outsider.status, 403);
    assert.equal(missingCourse.status, 404);
  });
});

test('quiz detail returns answer keys only to the owner and hides drafts from students', async () => {
  const fixture = createFixture();
  const app = createApp(fixture.service);

  await withAuthenticatedDatabase(async () => {
    const owner = await authenticatedRequest(app, 'get', '/quizzes/55', 2, 'GIANG_VIEN');
    const student = await authenticatedRequest(app, 'get', '/quizzes/55', 3, 'SINH_VIEN');
    assert.equal(owner.status, 200);
    assert.equal(owner.body.questions[0].options[0].isCorrect, true);
    assert.equal(student.status, 200);
    assert.equal(Object.hasOwn(student.body, 'questions'), false);
    assert.equal(JSON.stringify(student.body).toLowerCase().includes('correct'), false);
  });

  const draftFixture = createFixture({ quiz: createQuiz({ status: 'DRAFT' }) });
  await withAuthenticatedDatabase(async () => {
    const studentDraft = await authenticatedRequest(
      createApp(draftFixture.service),
      'get',
      '/quizzes/55',
      3,
      'SINH_VIEN'
    );
    assert.equal(studentDraft.status, 404);
  });
});

test('quiz detail denies an unregistered student and another instructor', async () => {
  const fixture = createFixture();
  const app = createApp(fixture.service);

  await withAuthenticatedDatabase(async () => {
    const outsider = await authenticatedRequest(app, 'get', '/quizzes/55', 4, 'SINH_VIEN');
    const otherInstructor = await authenticatedRequest(
      app,
      'get',
      '/quizzes/55',
      4,
      'GIANG_VIEN'
    );
    const missingQuiz = await authenticatedRequest(app, 'get', '/quizzes/999', 2, 'GIANG_VIEN');
    assert.equal(outsider.status, 403);
    assert.equal(otherInstructor.status, 403);
    assert.equal(missingQuiz.status, 404);
  });
});

test('owner can update a published quiz without attempts and receives the sanitized representation', async () => {
  const fixture = createFixture({ quiz: createQuiz({ status: 'PUBLISHED' }) });
  const app = createApp(fixture.service);

  await withAuthenticatedDatabase(async () => {
    const response = await authenticatedRequest(
      app,
      'patch',
      '/quizzes/55',
      2,
      'GIANG_VIEN'
    ).send({
      title: '<script>alert(1)</script>Updated quiz',
      description: '<b>Updated description</b>',
      duration_minutes: 45,
      show_score_immediately: true
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'PUBLISHED');
    assert.equal(response.body.title, 'Updated quiz');
    assert.equal(response.body.description, 'Updated description');
    assert.equal(response.body.durationMinutes, 45);
    assert.equal(response.body.showScoreImmediately, true);
    assert.equal(fixture.calls.find((call) => call.operation === 'updateQuiz').updated.durationMinutes, 45);
  });
});

test('quiz update returns CONFLICT after an attempt and COURSE_ARCHIVED for an archived course', async () => {
  const attempted = createFixture({ attempts: true });
  const archived = createFixture({ courseStatus: 'ARCHIVED' });

  await withAuthenticatedDatabase(async () => {
    const locked = await authenticatedRequest(
      createApp(attempted.service),
      'patch',
      '/quizzes/55',
      2,
      'GIANG_VIEN'
    ).send({ title: 'Updated title' });
    const readOnly = await authenticatedRequest(
      createApp(archived.service),
      'patch',
      '/quizzes/55',
      2,
      'GIANG_VIEN'
    ).send({ title: 'Updated title' });

    assert.equal(locked.status, 409);
    assert.equal(locked.body.code, 'CONFLICT');
    assert.equal(
      locked.body.message,
      'Không thể chỉnh sửa đề thi khi đã có thí sinh làm bài.'
    );
    assert.equal(readOnly.status, 409);
    assert.equal(readOnly.body.code, 'COURSE_ARCHIVED');
  });
});

test('quiz update validates merged time windows and rejects empty patches', async () => {
  const fixture = createFixture();
  const app = createApp(fixture.service);

  await withAuthenticatedDatabase(async () => {
    const invalidWindow = await authenticatedRequest(
      app,
      'patch',
      '/quizzes/55',
      2,
      'GIANG_VIEN'
    ).send({ open_time: '2026-11-25 11:00:00' });
    const emptyPatch = await authenticatedRequest(
      app,
      'patch',
      '/quizzes/55',
      2,
      'GIANG_VIEN'
    ).send({});
    const invalidDuration = await authenticatedRequest(
      app,
      'patch',
      '/quizzes/55',
      2,
      'GIANG_VIEN'
    ).send({ duration_minutes: 0 });
    assert.equal(invalidWindow.status, 422);
    assert.equal(invalidDuration.status, 422);
    assert.equal(emptyPatch.status, 422);
    assert.equal(
      fixture.calls.some((call) => call.operation === 'updateQuiz'),
      false
    );
  });
});

test('only the owner may update quiz settings', async () => {
  const fixture = createFixture();
  const app = createApp(fixture.service);

  await withAuthenticatedDatabase(async () => {
    const otherInstructor = await authenticatedRequest(
      app,
      'patch',
      '/quizzes/55',
      4,
      'GIANG_VIEN'
    ).send({ title: 'Unauthorized edit' });
    const student = await authenticatedRequest(
      app,
      'patch',
      '/quizzes/55',
      3,
      'SINH_VIEN'
    ).send({ title: 'Unauthorized edit' });
    assert.equal(otherInstructor.status, 403);
    assert.equal(student.status, 403);
  });
});

test('quiz repository lists use bounded aggregate queries and a single joined question query', async () => {
  const queries = [];
  const dbMock = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('COUNT(*) AS total')) {
        return [[{ total: sql.includes("status IN ('PUBLISHED', 'CLOSED')") ? 2 : 4 }]];
      }
      if (sql.includes('FROM questions q')) {
        return [[
          {
            questionId: 9,
            questionContent: 'Question',
            questionOrder: 1,
            optionId: 91,
            optionContent: 'A',
            isCorrect: 1,
            optionOrder: 1
          },
          {
            questionId: 9,
            questionContent: 'Question',
            questionOrder: 1,
            optionId: 92,
            optionContent: 'B',
            isCorrect: 0,
            optionOrder: 2
          }
        ]];
      }
      return [[{ id: 55, questionCount: 1, hasAttempts: 1 }]];
    }
  };
  const repository = createQuizRepository(dbMock);

  const ownerPage = await repository.listOwnerQuizzes(1, { page: 2, limit: 1 });
  assert.equal(ownerPage.total, 4);
  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /COUNT\(DISTINCT question\.id\)/);
  assert.match(queries[0].sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(queries[0].values, [1, 1, 1]);
  assert.deepEqual(queries[1].values, [1]);

  queries.length = 0;
  const studentPage = await repository.listStudentQuizzes(1, 3, {
    page: 1,
    limit: 20,
    now: serverNow
  });
  assert.equal(studentPage.total, 2);
  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /a\.student_id = \?/);
  assert.match(queries[0].sql, /q\.status IN \('PUBLISHED', 'CLOSED'\)/);
  assert.deepEqual(queries[0].values.slice(3), [3, 1, 20, 0]);

  queries.length = 0;
  const questions = await repository.findQuizQuestions(55);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /LEFT JOIN options/);
  assert.equal(questions.length, 1);
  assert.deepEqual(questions[0].options.map((option) => option.isCorrect), [true, false]);
});

test('quiz updates persist every editable field using the transaction connection', async () => {
  const queries = [];
  const repository = createQuizRepository({
    async query() {
      assert.fail('updates must use the supplied transaction connection');
    }
  });
  const connection = {
    async query(sql, values) {
      queries.push({ sql, values });
      return [{ affectedRows: 1 }];
    }
  };

  await repository.updateQuiz(connection, 55, {
    title: 'Updated',
    description: null,
    durationMinutes: 45,
    openTime: '2026-11-25 08:00:00',
    closeTime: '2026-11-25 10:00:00',
    showScoreImmediately: false
  });

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /UPDATE quizzes/);
  assert.deepEqual(queries[0].values, [
    'Updated',
    null,
    45,
    '2026-11-25 08:00:00',
    '2026-11-25 10:00:00',
    false,
    55
  ]);
});
