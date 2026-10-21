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
const {
  createQuizSchema
} = require('../../src/modules/m3-quiz/validators/quizSchemas');
const { createQuizService } = require('../../src/modules/m3-quiz/services/quizService');

function makeQuizData(overrides = {}) {
  return {
    title: 'Midterm quiz',
    description: 'Chapters 1-3',
    duration_minutes: 30,
    open_time: '2026-11-25 08:00:00',
    close_time: '2026-11-25 10:00:00',
    show_score_immediately: true,
    questions: [
      {
        content: 'Question one?',
        options: [
          { content: 'Correct', is_correct: true },
          { content: 'Incorrect', is_correct: false }
        ]
      }
    ],
    ...overrides
  };
}

function createService(overrides = {}) {
  const calls = [];
  const courseAccess = createCourseAccessFake();
  const repository = {
    async createQuizWithQuestions(connection, courseId, quiz, questions) {
      calls.push({ operation: 'create', connection, courseId, quiz, questions });
      return 55;
    },
    async loadQuiz(quizId) {
      calls.push({ operation: 'load', quizId });
      return { id: quizId, status: 'DRAFT', questions: [] };
    },
    async findQuizForUpdate(connection, quizId) {
      calls.push({ operation: 'lock', connection, quizId });
      return { id: quizId, courseId: 1, status: 'DRAFT', hasAttempts: false };
    },
    async findQuiz() {
      return { id: 55, courseId: 1, status: 'DRAFT', hasAttempts: false };
    },
    async hasAttempts() {
      return false;
    },
    async countQuestions() {
      return 1;
    },
    async replaceQuestions(connection, quizId, questions) {
      calls.push({ operation: 'replace', connection, quizId, questions });
    },
    async findQuestion(connection, questionId) {
      return { id: questionId, quizId: 55, courseId: 1 };
    },
    async deleteQuestion() {
      return true;
    },
    async publishQuiz() {
      calls.push({ operation: 'publish' });
    },
    ...overrides.repository
  };
  const transaction = { connection: true };
  const service = createQuizService({
    repository,
    getCourseAccess: overrides.getCourseAccess || (() => courseAccess),
    withTransaction: async (work) => work(transaction),
    sanitizeText
  });

  return { service, repository, calls, courseAccess };
}

test('creates a draft quiz with sanitized questions in one transaction', async () => {
  const { service, calls, courseAccess } = createService();
  let writableCourseId;
  courseAccess.assertCourseWritable = async (courseId) => {
    writableCourseId = courseId;
  };

  const quiz = await service.createQuiz(
    1,
    2,
    makeQuizData({
      title: '<b>Midterm quiz</b>',
      questions: [
        {
          content: '<script>alert(1)</script>Question one?',
          options: [
            { content: '<b>Correct</b>', is_correct: true },
            { content: 'Incorrect', is_correct: false }
          ]
        }
      ]
    })
  );

  assert.equal(writableCourseId, 1);
  assert.deepEqual(quiz, { id: 55, status: 'DRAFT', questions: [] });
  assert.equal(calls[0].operation, 'create');
  assert.equal(calls[0].connection.connection, true);
  assert.equal(calls[0].quiz.title, 'Midterm quiz');
  assert.equal(calls[0].questions[0].content.includes('<'), false);
  assert.equal(calls[0].questions[0].options[0].content, 'Correct');
});

test('inserts a quiz, its questions, and options through the same transaction connection', async () => {
  const queries = [];
  let insertId = 10;
  const connection = {
    async query(sql) {
      queries.push(sql);
      return [{ insertId: insertId++ }];
    }
  };
  const repository = createQuizRepository({ query: assert.fail });

  const quizId = await repository.createQuizWithQuestions(
    connection,
    1,
    makeQuizData(),
    makeQuizData().questions
  );

  assert.equal(quizId, 10);
  assert.equal(queries.length, 4);
  assert.match(queries[0], /INSERT INTO quizzes/);
  assert.match(queries[1], /INSERT INTO questions/);
  assert.match(queries[2], /INSERT INTO options/);
  assert.match(queries[3], /INSERT INTO options/);
});

test('rejects quiz creation when the caller is not the course owner', async () => {
  const { service } = createService({
    getCourseAccess: () => ({
      async getCourse() {
        return { id: 1, status: 'PUBLISHED' };
      },
      async isOwner() {
        return false;
      },
      async assertCourseWritable() {
        assert.fail('read-only check must not follow failed ownership check');
      }
    })
  });

  await assert.rejects(
    service.createQuiz(1, 99, makeQuizData()),
    (error) => error.code === 'FORBIDDEN'
  );
});

test('blocks question replacement once the quiz has an attempt', async () => {
  const { service } = createService({
    repository: {
      async findQuizForUpdate() {
        return { id: 55, courseId: 1, status: 'DRAFT', hasAttempts: true };
      }
    }
  });

  await assert.rejects(
    service.updateQuestions(55, 2, makeQuizData().questions),
    (error) => error.code === 'CONFLICT'
  );
});

test('cannot publish an empty quiz and validates the single-correct-answer rule', async () => {
  const { service } = createService({
    repository: {
      async countQuestions() {
        return 0;
      }
    }
  });

  await assert.rejects(
    service.publishQuiz(55, 2),
    (error) => error.code === 'VALIDATION_ERROR'
  );

  const invalidQuiz = createQuizSchema.safeParse({
    params: { courseId: '1' },
    body: makeQuizData({
      questions: [
        {
          content: 'Question?',
          options: [
            { content: 'A', is_correct: true },
            { content: 'B', is_correct: true }
          ]
        }
      ]
    })
  });
  assert.equal(invalidQuiz.success, false);

  const invalidService = createService();
  await assert.rejects(
    invalidService.service.createQuiz(
      1,
      2,
      makeQuizData({
        questions: [
          {
            content: 'Question?',
            options: [
              { content: 'A', is_correct: true },
              { content: 'B', is_correct: true }
            ]
          }
        ]
      })
    ),
    (error) => error.code === 'VALIDATION_ERROR'
  );
});

test('validates the opening window and minimum duration', () => {
  const invalidQuiz = createQuizSchema.safeParse({
    params: { courseId: '1' },
    body: makeQuizData({
      duration_minutes: 0,
      open_time: '2026-11-25 10:00:00',
      close_time: '2026-11-25 08:00:00'
    })
  });
  assert.equal(invalidQuiz.success, false);
});

test('quiz creation endpoint validates input and returns a created draft', async () => {
  const calls = [];
  const service = {
    async createQuiz(courseId, userId, data) {
      calls.push({ courseId, userId, data });
      return { id: 55, courseId: 1, title: data.title, status: 'DRAFT', questions: [] };
    }
  };
  const app = express();
  app.use(express.json());
  app.use(createQuizRoutes(service));
  app.use(errorHandler);
  const token = jwt.sign(
    { user_id: 2, role: 'GIANG_VIEN', token_version: 1 },
    config.JWT_SECRET
  );
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }]];

  try {
    const success = await request(app)
      .post('/courses/1/quizzes')
      .set('Authorization', `Bearer ${token}`)
      .send(makeQuizData());
    assert.equal(success.status, 201);
    assert.equal(success.body.status, 'DRAFT');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].courseId, '1');
    assert.equal(calls[0].userId, 2);

    const invalid = await request(app)
      .post('/courses/1/quizzes')
      .set('Authorization', `Bearer ${token}`)
      .send(makeQuizData({
        questions: [
          {
            content: 'Question?',
            options: [
              { content: 'A', is_correct: false },
              { content: 'B', is_correct: false }
            ]
          }
        ]
      }));
    assert.equal(invalid.status, 422);
    assert.equal(calls.length, 1);
  } finally {
    db.query = originalQuery;
  }
});
