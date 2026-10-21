const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
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
    { quizId: 201, title: 'Quiz 1', studentId: 11, score: 7 },
    { quizId: 201, title: 'Quiz 1', studentId: 12, score: null }
  ];
  const courseAccess = {
    ...createCourseAccessFake({ courseOwner: { isOwner: owner }, students: roster }),
    async isOwner() {
      return owner;
    },
    async listEnrolledStudents(courseId, options) {
      events.push(['roster', courseId, options.page, options.pageSize]);
      const start = (options.page - 1) * options.pageSize;
      return {
        students: roster.slice(start, start + options.pageSize),
        total: roster.length
      };
    }
  };
  let quizPortCalls = 0;
  const quizResults = {
    ...createQuizResultsFake(quizScores),
    async getQuizScoresForCourse(courseId) {
      events.push(['quiz-scores', courseId]);
      quizPortCalls += 1;
      return quizScores;
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

test('US-14 streams CSV with UTF-8 BOM, formula escaping, and the full roster', async () => {
  const roster = Array.from({ length: 23 }, (_, index) => ({
    id: index + 11,
    studentNumber: `SV${String(index + 1).padStart(3, '0')}`,
    fullName: `Sinh viên ${index + 1}`
  }));
  roster[0].studentNumber = '=CMD(1)';
  roster[0].fullName = '@SUM(A1)';
  const { service, events, getQuizPortCalls } = createFixture({ students: roster });
  const app = express();
  app.use('/api/m2-assessment', createClassGradebookRouter({
    controller: new ClassGradebookController(service)
  }));
  app.use(errorHandler);
  const token = jwt.sign({ user_id: 3, role: 'GIANG_VIEN' }, config.JWT_SECRET, {
    expiresIn: '5m'
  });

  const response = await request(app)
    .get('/api/m2-assessment/courses/8/gradebook/export.csv')
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
    students: [
      { id: 1, fullName: 'One' },
      { id: 2, fullName: 'Two' }
    ]
  });
  const quizResults = createQuizResultsFake([
    { quizId: 5, studentId: 1, score: 8 }
  ]);

  assert.deepEqual(await courseAccess.listEnrolledStudents(10, { page: 2, pageSize: 1 }), {
    students: [{ id: 2, fullName: 'Two' }],
    total: 2,
    courseId: 10
  });
  assert.deepEqual(await quizResults.getQuizScoresForCourse(10), [
    { quizId: 5, studentId: 1, score: 8 }
  ]);
});
