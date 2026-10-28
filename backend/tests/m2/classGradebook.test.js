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
const ClassGradebookController = require('../../src/modules/m2-assessment/controllers/classGradebookController');
const ClassGradebookRepository = require('../../src/modules/m2-assessment/repositories/classGradebookRepository');
const ClassGradebookService = require('../../src/modules/m2-assessment/services/classGradebookService');
const {
  createClassGradebookRouter
} = require('../../src/modules/m2-assessment/routes/classGradebookRoutes');
const { escapeCsvCell } = require('../../src/modules/m2-assessment/utils/csv');

function createFixture({ owner = true, students } = {}) {
  const events = [];
  const roster = students || [
    { id: 11, studentNumber: 'SV001', fullName: 'Nguyễn An' },
    { id: 12, studentNumber: '=CMD(1)', fullName: '@SUM(A1)' }
  ];
  const assignments = [
    { id: 101, title: 'Bài tập 1', max_score: '10.00' },
    { id: 102, title: '+Final', max_score: '10.00' }
  ];
  const assignmentScores = [
    { assignment_id: 101, student_id: 11, score: '8.50' },
    { assignment_id: 102, student_id: 11, score: null },
    { assignment_id: 101, student_id: 12, score: '9.00' }
  ];
  const quizScores = [
    {
      quizId: 201,
      quizTitle: 'Quiz 1',
      maxScore: 10,
      studentId: 11,
      score: 7,
      attemptStatus: 'SUBMITTED',
      submittedAt: '2026-10-21T11:00:00.000Z',
      visibleToStudent: true
    },
    {
      quizId: 201,
      quizTitle: 'Quiz 1',
      maxScore: 10,
      studentId: 12,
      score: null,
      attemptStatus: null,
      submittedAt: null,
      visibleToStudent: true
    }
  ];
  const courseAccess = {
    ...createCourseAccessFake({
      courses: [{ id: 8, ownerId: 3, title: 'Course', status: 'PUBLISHED' }],
      enrolledStudentIds: roster.map((student) => student.id),
      enrolledStudents: roster
    }),
    async isOwner(userId, courseId) {
      assert.equal(userId, 3);
      assert.equal(courseId, 8);
      return owner;
    },
    async getEnrolledStudentIds(courseId) {
      events.push(['roster-ids', courseId]);
      return roster.map((student) => student.id);
    },
    async listEnrolledStudents(courseId, options) {
      events.push(['roster', courseId, options.page, options.limit]);
      const start = (options.page - 1) * options.limit;
      return {
        items: roster.slice(start, start + options.limit),
        total: roster.length
      };
    }
  };
  let quizPortCalls = 0;
  const quizResults = {
    ...createQuizResultsFake({
      courseScores: { 8: quizScores }
    }),
    async getQuizScoresForCourse(courseId, studentIds) {
      events.push(['quiz-scores', courseId, studentIds]);
      quizPortCalls += 1;
      const requestedIds = new Set(studentIds);
      return quizScores.filter((score) => requestedIds.has(score.studentId));
    }
  };
  const repository = {
    async findCourseAssignments(courseId) {
      events.push(['assignments', courseId]);
      return assignments;
    },
    async findAssignmentScoresForStudents(courseId, pageStudents, assignmentIds) {
      events.push([
        'assignment-scores',
        courseId,
        pageStudents.map((student) => student.id),
        assignmentIds
      ]);
      return assignmentScores.filter((row) =>
        pageStudents.some((student) => student.id === row.student_id)
      );
    }
  };
  const service = new ClassGradebookService({
    gradebookRepository: repository,
    getPortFn(name, options) {
      events.push(['getPort', name, options.optional]);
      if (name === 'courseAccess') {
        return courseAccess;
      }
      if (name === 'quizResults') {
        return quizResults;
      }
      return null;
    }
  });
  return { service, events, repository, getQuizPortCalls: () => quizPortCalls };
}

test('US-14 returns a 20-student page with batched assignment and course quiz scores', async () => {
  const { service, events, getQuizPortCalls } = createFixture();

  const result = await service.getCourseGradebook({ courseId: 8, instructorId: 3 });

  assert.equal(result.pagination.page_size, 20);
  assert.equal(result.pagination.total, 2);
  assert.equal(result.data[0].assignments['101'], 8.5);
  assert.equal(result.data[0].assignments['102'], null);
  assert.equal(result.data[1].assignments['102'], null);
  assert.equal(result.data[0].quizzes['201'], 7);
  assert.equal(result.data[1].quizzes['201'], null);
  assert.equal(
    events.filter((event) => event[0] === 'assignment-scores').length,
    1
  );
  assert.equal(getQuizPortCalls(), 1);
  assert.deepEqual(events.find((event) => event[0] === 'quiz-scores'), [
    'quiz-scores',
    8,
    [11, 12]
  ]);
  assert.deepEqual(
    events.find((event) => event[0] === 'assignment-scores'),
    ['assignment-scores', 8, [11, 12], [101, 102]]
  );
});

test('US-14 rejects non-owners before querying roster or grades', async () => {
  const { service, events } = createFixture({ owner: false });

  await assert.rejects(
    service.getCourseGradebook({ courseId: 8, instructorId: 3 }),
    ForbiddenError
  );
  assert.equal(events.some((event) => event[0] === 'roster'), false);
  assert.equal(events.some((event) => event[0] === 'assignment-scores'), false);
});

test('US-14 repository uses one parameterized tuple-IN query for the page scores', async () => {
  const queries = [];
  const repository = new ClassGradebookRepository({
    async query(sql, params) {
      queries.push({ sql, params });
      return [[], []];
    }
  });

  await repository.findAssignmentScoresForStudents(
    8,
    [{ id: 11 }, { id: 12 }],
    [101, 102]
  );

  assert.equal(queries.length, 1);
  assert.match(
    queries[0].sql,
    /WHERE \(s\.`assignment_id`, s\.`student_id`\) IN \(\(\?, \?\), \(\?, \?\), \(\?, \?\), \(\?, \?\)\)/
  );
  assert.deepEqual(queries[0].params, [8, 101, 11, 102, 11, 101, 12, 102, 12]);
});

test('US-14 escapes CSV formula prefixes and quotes cells', () => {
  assert.equal(escapeCsvCell('=SUM(A1)'), "\"'=SUM(A1)\"");
  assert.equal(escapeCsvCell('+SUM(A1)'), "\"'+SUM(A1)\"");
  assert.equal(escapeCsvCell('  @CMD'), "\"'  @CMD\"");
  assert.equal(escapeCsvCell('Last, First "A"'), '"Last, First ""A"""');
  assert.equal(escapeCsvCell(-2), "\"'-2\"");
  assert.equal(escapeCsvCell(null), '""');
});

test('US-14 streams CSV with UTF-8 BOM, formula escaping, and the full roster', async (t) => {
  const roster = Array.from({ length: 23 }, (_, index) => ({
    id: index + 11,
    studentNumber: `SV${String(index + 1).padStart(3, '0')}`,
    fullName: `Sinh viên ${index + 1}`
  }));
  roster[0].studentNumber = '=CMD(1)';
  roster[0].fullName = '@SUM(A1)';
  const { service, events, getQuizPortCalls } = createFixture({ students: roster });
  const app = express();
  app.use('/api', createClassGradebookRouter({
    controller: new ClassGradebookController(service)
  }));
  app.use(errorHandler);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });
  const token = jwt.sign({ id: 3, user_id: 3, role: 'GIANG_VIEN', token_version: 0 }, config.JWT_SECRET, {
    expiresIn: '5m'
  });

  const response = await request(app)
    .get('/api/courses/8/grades/export-csv')
    .set('Authorization', `Bearer ${token}`);
  const csv = response.text || response.body.toString('utf8');

  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/csv/);
  assert.match(response.headers['content-disposition'], /BangDiem_8\.csv/);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"'=CMD\(1\)"/);
  assert.match(csv, /"'@SUM\(A1\)"/);
  assert.match(csv, /Sinh viên 23/);
  assert.match(csv, /"8\.5"/);
  assert.equal(csv.trimEnd().split('\r\n').length, 24);
  assert.deepEqual(
    events.filter((event) => event[0] === 'roster').map((event) => event[2]),
    [1, 2]
  );
  assert.equal(
    events.filter((event) => event[0] === 'assignment-scores').length,
    2
  );
  assert.equal(getQuizPortCalls(), 1);
});

test('US-14 contract fakes paginate enrolled students and expose course quiz scores', async () => {
  const courseAccess = createCourseAccessFake({
    courses: [{ id: 10, ownerId: 3, title: 'Course', status: 'PUBLISHED' }],
    enrolledStudentIds: [1, 2],
    enrolledStudents: [
      { id: 1, fullName: 'One' },
      { id: 2, fullName: 'Two' }
    ]
  });
  const quizResults = createQuizResultsFake({
    courseScores: { 10: [{ quizId: 5, studentId: 1, score: 8 }] }
  });

  assert.deepEqual(await courseAccess.listEnrolledStudents(10, { page: 2, limit: 1 }), {
    items: [{ id: 2, fullName: 'Two' }],
    total: 2
  });
  assert.deepEqual(await quizResults.getQuizScoresForCourse(10, [1, 2]), [
    { quizId: 5, studentId: 1, score: 8 }
  ]);
});

test('US-14 HTTP endpoint returns paginated class gradebook as JSON', async (t) => {
  const { service } = createFixture();
  const controller = new ClassGradebookController(service);
  const app = express();
  app.use('/api', createClassGradebookRouter({ controller }));
  app.use(errorHandler);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });
  const token = jwt.sign({ id: 3, user_id: 3, role: 'GIANG_VIEN', token_version: 0 }, config.JWT_SECRET, {
    expiresIn: '5m'
  });

  const response = await request(app)
    .get('/api/courses/8/grades?page=1')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
  assert.ok(response.body.pagination);
});
