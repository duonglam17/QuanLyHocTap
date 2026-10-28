const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const fsSync = require('node:fs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const { ConflictError, ForbiddenError, ValidationError } = require('../../src/common/errors');
const {
  createCourseAccessFake,
  createNotificationsFake
} = require('../../src/contracts/fakes');
const GradeController = require('../../src/modules/m2-assessment/controllers/gradeController');
const GradeRepository = require('../../src/modules/m2-assessment/repositories/gradeRepository');
const GradebookRepository = require('../../src/modules/m2-assessment/repositories/gradebookRepository');
const GradeService = require('../../src/modules/m2-assessment/services/gradeService');
const { createGradeRouter } = require('../../src/modules/m2-assessment/routes/gradeRoutes');

function createGradeFixture({ owner = true, writable = true, submission = null } = {}) {
  const events = [];
  const notifications = createNotificationsFake();
  const courseAccess = {
    ...createCourseAccessFake(),
    async getCourse(courseId) {
      return courseId === 9
        ? { id: 9, ownerId: 3, title: 'Course', status: 'PUBLISHED' }
        : null;
    },
    async isOwner(instructorId, courseId) {
      assert.equal(courseId, 9);
      assert.equal(instructorId, 3);
      return owner;
    },
    async assertCourseWritable(courseId) {
      assert.equal(courseId, 9);
      if (!writable) {
        throw new ConflictError('Khóa học đã lưu trữ.', null, 'COURSE_ARCHIVED');
      }
    }
  };
  const targetSubmission = submission || {
    id: 12,
    assignment_id: 4,
    student_id: 5,
    course_id: 9,
    status: 'SUBMITTED'
  };
  let existingGrade = null;
  const gradeRepository = {
    async findSubmissionForGradeForUpdate(id, connection) {
      assert.equal(id, 12);
      events.push(connection ? 'lock-submission' : 'find-submission');
      return targetSubmission;
    },
    async upsert(data, connection) {
      assert.ok(connection);
      events.push('upsert-grade');
      existingGrade = {
        id: existingGrade?.id || 21,
        submissionId: data.submissionId,
        gradedBy: data.graderId,
        score: data.score,
        feedback: data.feedback,
        gradedAt: existingGrade?.gradedAt || '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z'
      };
      return existingGrade;
    },
    async markSubmissionGraded(id, connection) {
      assert.equal(id, 12);
      assert.ok(connection);
      events.push('mark-graded');
    }
  };
  const gradebookRepository = {
    async countSubmissionsByCourse(courseId) {
      assert.equal(courseId, 9);
      events.push('count');
      return 3;
    },
    async findSubmissionsByCourse(courseId, pagination) {
      assert.equal(courseId, 9);
      assert.deepEqual(pagination, { limit: 2, offset: 0 });
      events.push('list');
      return [
        { id: 12, student_id: 5, status: 'SUBMITTED' },
        { id: 13, student_id: 6, status: 'GRADED' }
      ];
    }
  };
  const transactionRunner = async (work) => {
    events.push('begin');
    const result = await work({});
    events.push('commit');
    return result;
  };
  const service = new GradeService({
    gradeRepository,
    gradebookRepository,
    transactionRunner,
    getPortFn(name, options) {
      assert.equal(options.optional, true);
      if (name === 'courseAccess') {
        return courseAccess;
      }
      if (name === 'notifications') {
        const originalNotify = notifications.notifyUser.bind(notifications);
        notifications.notifyUser = async (...args) => {
          events.push('notify');
          return originalNotify(...args);
        };
        return notifications;
      }
      return null;
    }
  });
  return { service, events, notifications, gradeRepository, gradebookRepository };
}

test('US-09 grades a submission transactionally, sanitizes feedback, and notifies after commit', async () => {
  const { service, events, notifications } = createGradeFixture();

  const grade = await service.gradeSubmission({
    submissionId: 12,
    graderId: 3,
    score: 8.5,
    feedback: 'Good <script>alert(1)</script> work'
  });

  assert.equal(grade.score, 8.5);
  assert.equal(grade.feedback, 'Good  work');
  assert.deepEqual(events, ['begin', 'lock-submission', 'upsert-grade', 'mark-graded', 'commit', 'notify']);
  assert.deepEqual(notifications.sentNotifications, [
    {
      userId: 5,
      payload: {
        type: 'ASSIGNMENT_GRADED',
        title: 'Bài tập đã được chấm',
        message: 'Bài tập của bạn đã được chấm: 8.5/10.',
        refType: 'SUBMISSION',
        refId: 12,
        link: '/courses/9/my-grades'
      }
    }
  ]);
});

test('US-09 rejects a grader who does not own the submission course', async () => {
  const { service, events, notifications } = createGradeFixture({ owner: false });

  await assert.rejects(
    service.gradeSubmission({
      submissionId: 12,
      graderId: 3,
      score: 8,
      feedback: 'Good'
    }),
    ForbiddenError
  );
  assert.deepEqual(events, ['begin', 'lock-submission']);
  assert.equal(notifications.sentNotifications.length, 0);
});

test('US-09 returns 404 for a missing submission and 409 for a read-only course', async () => {
  const missing = createGradeFixture();
  missing.gradeRepository.findSubmissionForGradeForUpdate = async () => null;
  await assert.rejects(
    missing.service.gradeSubmission({
      submissionId: 999,
      graderId: 3,
      score: 8
    }),
    (error) => error.statusCode === 404
  );

  const archived = createGradeFixture({ writable: false });
  await assert.rejects(
    archived.service.gradeSubmission({
      submissionId: 12,
      graderId: 3,
      score: 8
    }),
    (error) => error instanceof ConflictError && error.statusCode === 409
  );
  assert.equal(archived.events.includes('upsert-grade'), false);
});

test('US-09 HTTP endpoint returns 401, 403, 404, and 422 for grading requests', async (t) => {
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });

  const fixture = createGradeFixture();
  const app = express();
  app.use(express.json());
  app.use('/api', createGradeRouter({
    gradeController: new GradeController({ gradeService: fixture.service })
  }));
  app.use(errorHandler);
  const token = (id, role) =>
    jwt.sign({ id, role, token_version: 0 }, config.JWT_SECRET, { expiresIn: '5m' });

  const unauthenticated = await request(app)
    .post('/api/submissions/12/grade')
    .send({ score: 8 });
  assert.equal(unauthenticated.status, 401);

  const wrongRole = await request(app)
    .post('/api/submissions/12/grade')
    .set('Authorization', `Bearer ${token(5, 'SINH_VIEN')}`)
    .send({ score: 8 });
  assert.equal(wrongRole.status, 403);

  const missingSubmissionRepository = fixture.gradeRepository;
  const originalFindSubmission = missingSubmissionRepository.findSubmissionForGradeForUpdate;
  missingSubmissionRepository.findSubmissionForGradeForUpdate = async () => null;
  const missing = await request(app)
    .post('/api/submissions/999/grade')
    .set('Authorization', `Bearer ${token(3, 'GIANG_VIEN')}`)
    .send({ score: 8 });
  missingSubmissionRepository.findSubmissionForGradeForUpdate = originalFindSubmission;
  assert.equal(missing.status, 404);

  const invalidScore = await request(app)
    .post('/api/submissions/12/grade')
    .set('Authorization', `Bearer ${token(3, 'GIANG_VIEN')}`)
    .send({ score: 10.5 });
  assert.equal(invalidScore.status, 422);
});

test('US-09 validates the 0 to 10 range and 0.25 score increments', async () => {
  const { service, events } = createGradeFixture();

  for (const score of [-0.25, 10.25, 8.1, 'abc', ' ']) {
    await assert.rejects(
      service.gradeSubmission({ submissionId: 12, graderId: 3, score }),
      ValidationError
    );
  }
  assert.deepEqual(events, []);
});

test('US-09 contract fakes expose batched user lookup and individual notifications', async () => {
  const courseAccess = createCourseAccessFake({
    users: [{ id: 5, username: 'student-five', fullName: 'Student Five', role: 'SINH_VIEN' }]
  });
  const notifications = createNotificationsFake();

  assert.deepEqual(await courseAccess.getUsersBrief([5]), [
    {
      id: 5,
      username: 'student-five',
      fullName: 'Student Five',
      role: 'SINH_VIEN'
    }
  ]);
  const payload = { type: 'ASSIGNMENT_GRADED' };
  await notifications.notifyUser(5, payload);
  assert.deepEqual(notifications.sentNotifications, [
    { userId: 5, payload }
  ]);
});

test('US-09 updates the one-to-one grade record when regrading', async () => {
  const { service, events } = createGradeFixture();

  const original = await service.gradeSubmission({
    submissionId: 12,
    graderId: 3,
    score: 7.5,
    feedback: 'Original'
  });
  const revised = await service.gradeSubmission({
    submissionId: 12,
    graderId: 3,
    score: 9,
    feedback: 'Revised'
  });

  assert.equal(original.id, revised.id);
  assert.equal(revised.score, 9);
  assert.equal(revised.feedback, 'Revised');
  assert.equal(revised.gradedAt, original.gradedAt);
  assert.equal(events.filter((event) => event === 'upsert-grade').length, 2);
});

test('US-09 lists submissions with one batched getUsersBrief Port call', async () => {
  const { service, events } = createGradeFixture();
  let briefCalls = 0;

  service.getPort = (name, options) => {
    assert.equal(options.optional, true);
    if (name === 'courseAccess') {
      return {
        async getCourse(courseId) {
          return { id: courseId, ownerId: 3, title: 'Course', status: 'PUBLISHED' };
        },
        async isOwner(userId, courseId) {
          return userId === 3 && courseId === 9;
        },
        async getUsersBrief(userIds) {
          briefCalls += 1;
          assert.deepEqual(userIds, [5, 6]);
          return [
            { id: 5, fullName: 'Student Five' },
            { id: 6, fullName: 'Student Six' }
          ];
        }
      };
    }
    return null;
  };

  const result = await service.listCourseSubmissions({
    courseId: 9,
    graderId: 3,
    page: 1,
    pageSize: 2
  });

  assert.equal(briefCalls, 1);
  assert.equal(result.data[0].student_name, 'Student Five');
  assert.equal(result.data[1].student_name, 'Student Six');
  assert.deepEqual(result.pagination, { page: 1, page_size: 2, total: 3, total_pages: 2 });
  assert.deepEqual(events, ['count', 'list']);
});

test('US-09 includes the assignment title in paginated grading rows', async () => {
  let queryText = '';
  const repository = new GradebookRepository({
    async query(sql, params) {
      queryText = sql;
      assert.deepEqual(params, [9, 20, 0]);
      return [[{ id: 12, assignment_title: 'Bài tập tuần 4' }], []];
    }
  });

  const rows = await repository.findSubmissionsByCourse(9, { limit: 20, offset: 0 });

  assert.match(queryText, /a\.`title` AS `assignment_title`/);
  assert.equal(rows[0].assignment_title, 'Bài tập tuần 4');
});

test('US-09 rejects submission downloads before exposing the file to a non-owner', async () => {
  const { service } = createGradeFixture({ owner: false });

  await assert.rejects(
    service.getSubmissionDownload({ submissionId: 12, graderId: 3 }),
    ForbiddenError
  );
});

test('US-09 authorizes the course owner before streaming a submission file', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'm2-grade-test-'));
  const filePath = path.join(directory, 'submission.pdf');
  await fs.writeFile(filePath, 'submission bytes');
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));

  const graderId = 3;
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });
  let authorizedDownloads = 0;
  const gradeController = new GradeController({
    gradeService: {
      async getSubmissionDownload({ graderId: requestedGraderId }) {
        if (requestedGraderId !== graderId) {
          throw new ForbiddenError('Not the course owner');
        }
        authorizedDownloads += 1;
        return {
          filePath,
          originalFilename: 'submission.pdf',
          mimeType: 'application/pdf'
        };
      }
    },
    storageClient: { openReadStream: fsSync.createReadStream }
  });
  const app = express();
  app.use('/api', createGradeRouter({ gradeController }));
  app.use(errorHandler);
  const token = jwt.sign({ id: graderId, role: 'GIANG_VIEN', token_version: 0 }, config.JWT_SECRET, {
    expiresIn: '5m'
  });

  const response = await request(app)
    .get('/api/submissions/12/download')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.toString(), 'submission bytes');
  assert.equal(authorizedDownloads, 1);

  const deniedToken = jwt.sign({ id: 4, role: 'GIANG_VIEN', token_version: 0 }, config.JWT_SECRET, {
    expiresIn: '5m'
  });
  const denied = await request(app)
    .get('/api/submissions/12/download')
    .set('Authorization', `Bearer ${deniedToken}`);

  assert.equal(denied.status, 403);
  assert.equal(authorizedDownloads, 1);
});

test('US-09 repository updates grades by the unique submission key with parameterized SQL', async () => {
  const repository = new GradeRepository();
  const statements = [];
  const connection = {
    async query(sql, params) {
      statements.push({ sql, params });
      if (sql.includes('INSERT INTO `grades`')) {
        return [{ affectedRows: 1 }, []];
      }
      return [
        [
          {
            id: 21,
            submission_id: 12,
            graded_by: 3,
            score: 8.5,
            feedback: 'Sanitized',
            graded_at: new Date(),
            updated_at: new Date()
          }
        ],
        []
      ];
    }
  };

  await repository.upsert(
    { submissionId: 12, graderId: 3, score: 8.5, feedback: 'Sanitized' },
    connection
  );

  assert.match(statements[0].sql, /ON DUPLICATE KEY UPDATE/);
  assert.deepEqual(statements[0].params, [12, 3, 8.5, 'Sanitized']);
});
