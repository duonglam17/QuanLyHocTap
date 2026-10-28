const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const { ForbiddenError } = require('../../src/common/errors');
const {
  createCourseAccessFake,
  createQuizResultsFake
} = require('../../src/contracts/fakes');
const StudentGradebookRepository = require('../../src/modules/m2-assessment/repositories/studentGradebookRepository');
const StudentGradebookService = require('../../src/modules/m2-assessment/services/studentGradebookService');
const {
  createStudentGradebookRouter
} = require('../../src/modules/m2-assessment/routes/studentGradebookRoutes');
const StudentGradebookController = require('../../src/modules/m2-assessment/controllers/studentGradebookController');

function createFixture({
  enrolled = true,
  quizScores = [],
  quizPort = createQuizResultsFake({
    studentScores: { '3:15': quizScores }
  }),
  assignments = [
    {
      type: 'ASSIGNMENT',
      id: 10,
      title: 'Essay without submission',
      score: null,
      maxScore: 10,
      feedback: null,
      status: 'NOT_SUBMITTED'
    },
    {
      type: 'ASSIGNMENT',
      id: 11,
      title: 'Essay submitted, not graded',
      score: null,
      maxScore: 10,
      feedback: null,
      status: 'SUBMITTED'
    },
    {
      type: 'ASSIGNMENT',
      id: 12,
      title: 'Graded essay',
      score: 8.5,
      maxScore: 10,
      feedback: 'Good',
      status: 'GRADED'
    }
  ]
} = {}) {
  const calls = [];
  const courseAccess = createCourseAccessFake({
    courses: [{ id: 3, ownerId: 8, title: 'Course', status: 'PUBLISHED' }],
    enrolledStudentIds: enrolled ? [15] : []
  });
  const repository = {
    async findByCourseAndStudent(courseId, studentId) {
      calls.push({ operation: 'findAssignments', courseId, studentId });
      return assignments;
    },
    createGradebook(data) {
      calls.push({ operation: 'createGradebook', studentId: data.studentId });
      return {
        toJSON() {
          return {
            course_id: Number(data.courseId),
            assignments: data.assignments,
            quizzes: data.quizzes
          };
        }
      };
    }
  };
  const service = new StudentGradebookService({
    gradebookRepository: repository,
    getPortFn(name, options) {
      calls.push({ operation: 'getPort', name, options });
      if (name === 'courseAccess') {
        return courseAccess;
      }
      if (name === 'quizResults') {
        return quizPort;
      }
      return null;
    }
  });

  return { service, calls, repository };
}

test('US-13 returns personal assignment and quiz grades and hides unpublished quizzes', async () => {
  const { service, calls } = createFixture({
    quizScores: [
      {
        quizId: 20,
        quizTitle: 'Published quiz',
        score: 8,
        maxScore: 10,
        attemptStatus: 'SUBMITTED',
        submittedAt: '2026-10-21T11:00:00.000Z',
        visibleToStudent: true
      },
      {
        quizId: 21,
        quizTitle: 'Hidden quiz',
        score: 10,
        maxScore: 10,
        attemptStatus: 'SUBMITTED',
        submittedAt: '2026-10-21T11:00:00.000Z',
        visibleToStudent: false
      },
      {
        quizId: 22,
        quizTitle: 'Quiz without visibility',
        score: 7
      }
    ]
  });

  const gradebook = await service.getForStudent({ courseId: 3, studentId: 15 });
  const result = gradebook.toJSON();

  assert.equal(result.course_id, 3);
  assert.deepEqual(result.assignments.map((item) => item.score), [null, null, 8.5]);
  assert.deepEqual(
    result.quizzes.map((item) => item.title),
    ['Published quiz']
  );
  assert.equal(result.quizzes[0].visibleToStudent, true);
  assert.equal(result.quizzes[0].status, 'SUBMITTED');
  assert.deepEqual(
    calls.filter((call) => call.operation === 'getPort').map((call) => call.name),
    ['courseAccess', 'quizResults']
  );
  assert.deepEqual(
    calls.filter((call) => call.operation === 'findAssignments'),
    [{ operation: 'findAssignments', courseId: 3, studentId: 15 }]
  );
});

test('US-13 denies access when the authenticated student is not enrolled', async () => {
  const { service, calls } = createFixture({ enrolled: false });

  await assert.rejects(
    service.getForStudent({ courseId: 3, studentId: 15 }),
    ForbiddenError
  );
  assert.equal(calls.some((call) => call.operation === 'findAssignments'), false);
});

test('US-13 falls back to assignment grades and logs when the optional quiz Port is missing', async () => {
  const { service, calls } = createFixture({ quizPort: null });

  const gradebook = await service.getForStudent({ courseId: 3, studentId: 15 });

  assert.equal(gradebook.toJSON().quizzes.length, 0);
  assert.equal(calls.some((call) => call.name === 'quizResults'), true);
});

test('US-13 repository joins only the authenticated student submissions and preserves null scores', async () => {
  const statements = [];
  const repository = new StudentGradebookRepository({
    async query(sql, params) {
      statements.push({ sql, params });
      return [
        [
          {
            assignment_id: 5,
            title: 'No submission',
            max_score: 10,
            submission_id: null,
            submission_status: null,
            submitted_at: null,
            score: null,
            feedback: null,
            graded_at: null
          },
          {
            assignment_id: 6,
            title: 'Not graded yet',
            max_score: 10,
            submission_id: 7,
            submission_status: 'SUBMITTED',
            submitted_at: new Date(),
            score: null,
            feedback: null,
            graded_at: null
          }
        ],
        []
      ];
    }
  });

  const rows = await repository.findByCourseAndStudent(2, 15);

  assert.deepEqual(statements[0].params, [15, 2]);
  assert.match(statements[0].sql, /s\.`student_id` = \?/);
  assert.equal(rows[0].score, null);
  assert.equal(rows[1].score, null);
  assert.equal(rows[0].status, 'NOT_SUBMITTED');
  assert.equal(rows[1].status, 'SUBMITTED');
});

test('US-13 endpoint derives identity from JWT and ignores any client student_id', async (t) => {
  let requestedStudentId;
  const controller = {
    async getMyCourseGrades(req, res) {
      requestedStudentId = req.user.id;
      return res.status(200).json({
        success: true,
        data: { student_id: req.user.id }
      });
    }
  };
  const app = express();
  app.use('/api', createStudentGradebookRouter({ controller }));
  app.use(errorHandler);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });
  const token = jwt.sign({ id: 15, role: 'SINH_VIEN', token_version: 0 }, config.JWT_SECRET, {
    expiresIn: '5m'
  });

  const response = await request(app)
    .get('/api/courses/3/my-grades?student_id=999')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(requestedStudentId, 15);
  assert.equal(response.body.data.student_id, 15);
});

test('US-13 rejects non-student roles on the personal gradebook endpoint', async (t) => {
  const app = express();
  app.use(
    '/api',
    createStudentGradebookRouter({
      controller: {
        async getMyCourseGrades(req, res) {
          return res.status(200).json({ success: true });
        }
      }
    })
  );
  app.use(errorHandler);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });
  const token = jwt.sign({ id: 3, role: 'GIANG_VIEN', token_version: 0 }, config.JWT_SECRET, {
    expiresIn: '5m'
  });

  const response = await request(app)
    .get('/api/courses/3/my-grades')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 403);
});

test('US-13 HTTP endpoint uses real controller to return personal gradebook', async (t) => {
  const { service } = createFixture();
  const controller = new StudentGradebookController(service);
  const app = express();
  app.use('/api', createStudentGradebookRouter({ controller }));
  app.use(errorHandler);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });
  const token = jwt.sign({ id: 15, role: 'SINH_VIEN', token_version: 0 }, config.JWT_SECRET, {
    expiresIn: '5m'
  });

  const response = await request(app)
    .get('/api/courses/3/my-grades')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.course_id, 3);
  assert.equal(response.body.data.assignments.length, 3);
});
