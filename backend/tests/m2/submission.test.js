const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const { ConflictError, ForbiddenError } = require('../../src/common/errors');
const { createCourseAccessFake } = require('../../src/contracts/fakes');
const SubmissionController = require('../../src/modules/m2-assessment/controllers/submissionController');
const { createSubmissionRouter } = require('../../src/modules/m2-assessment/routes/submissionRoutes');
const SubmissionRepository = require('../../src/modules/m2-assessment/repositories/submissionRepository');
const SubmissionService = require('../../src/modules/m2-assessment/services/submissionService');

const upload = {
  buffer: Buffer.from('file content'),
  originalname: 'report.pdf'
};

function createCourseAccess({
  enrolled = true,
  courseStatus = 'PUBLISHED'
} = {}) {
  return {
    ...createCourseAccessFake({
      courses: [{ id: 9, ownerId: 3, title: 'Course', status: courseStatus }],
      enrolledStudentIds: enrolled ? [5] : []
    }),
    async getCourse(courseId) {
      return courseId === 9
        ? { id: 9, ownerId: 3, title: 'Course', status: courseStatus }
        : null;
    }
  };
}

function createFixture({
  assignment = {
    id: 4,
    course_id: 9,
    deadline: new Date('2026-10-21T12:00:00.000Z'),
    allow_late: false,
    status: 'OPEN'
  },
  existing = null,
  enrolled = true,
  courseStatus = 'PUBLISHED',
  upsertError = null
} = {}) {
  const events = [];
  const storedFiles = [];
  const removedFiles = [];
  const savedSubmission = {
    id: 12,
    assignmentId: 4,
    studentId: 5,
    originalFilename: 'report.pdf',
    fileUuid: 'uuid-1',
    filePath: '00000000-0000-4000-8000-000000000001.pdf',
    fileSizeBytes: upload.buffer.length,
    mimeType: 'application/pdf',
    submittedAt: new Date('2026-10-21T11:00:00.000Z'),
    isLate: false,
    lateMinutes: 0,
    submissionCount: existing ? 2 : 1,
    status: 'SUBMITTED'
  };
  const repository = {
    async findAssignment(assignmentId) {
      assert.equal(assignmentId, 4);
      return assignment;
    },
    async findByAssignmentAndStudent(assignmentId, studentId) {
      assert.equal(assignmentId, 4);
      assert.equal(studentId, 5);
      return existing || savedSubmission;
    },
    async findAssignmentForUpdate(assignmentId, connection) {
      assert.equal(assignmentId, 4);
      assert.ok(connection);
      events.push('find-assignment');
      return assignment;
    },
    async findByAssignmentAndStudentForUpdate(assignmentId, studentId, connection) {
      assert.equal(assignmentId, 4);
      assert.equal(studentId, 5);
      assert.ok(connection);
      events.push('find-existing');
      return existing;
    },
    async upsert(data, connection) {
      assert.ok(connection);
      events.push('upsert');
      if (upsertError) {
        throw upsertError;
      }
      savedSubmission.isLate = data.isLate;
      savedSubmission.lateMinutes = data.lateMinutes;
      savedSubmission.status = data.status;
      return savedSubmission;
    }
  };
  const transactionRunner = async (work) => {
    const connection = {};
    events.push('begin');
    try {
      const result = await work(connection);
      events.push('commit');
      return result;
    } catch (error) {
      events.push('rollback');
      throw error;
    }
  };
  let fileNumber = 0;
  const storageClient = {
    async saveUpload(file, options) {
      assert.equal(file.originalname, upload.originalname);
      assert.deepEqual(options.allowedExt, ['.pdf', '.docx', '.pptx', '.zip', '.rar']);
      assert.equal(options.maxBytes, 20 * 1024 * 1024);
      fileNumber += 1;
      const storedFile = {
        storedName: `00000000-0000-4000-8000-00000000000${fileNumber}.pdf`,
        originalName: file.originalname,
        size: file.buffer.length,
        mime: 'application/pdf'
      };
      storedFiles.push(storedFile);
      events.push('save-file');
      return storedFile;
    },
    async deleteFile(storedName) {
      removedFiles.push(storedName);
      events.push(`remove:${storedName}`);
    }
  };
  const courseAccess = createCourseAccess({ enrolled, courseStatus });
  const service = new SubmissionService({
    submissionRepository: repository,
    storageClient,
    transactionRunner,
    clock: { now: () => new Date('2026-10-21T11:00:00.000Z') },
    getPortFn(name, options) {
      assert.equal(name, 'courseAccess');
      assert.equal(options.optional, true);
      return courseAccess;
    }
  });

  return { service, events, storedFiles, removedFiles, repository };
}

test('US-08 stores a timely submission with server time and transaction', async () => {
  const { service, events, storedFiles } = createFixture();

  const submission = await service.submitAssignment({
    assignmentId: 4,
    studentId: 5,
    upload
  });

  assert.equal(submission.status, 'SUBMITTED');
  assert.equal(submission.isLate, false);
  assert.equal(submission.lateMinutes, 0);
  assert.equal(submission.submissionCount, 1);
  assert.deepEqual(events, [
    'begin',
    'find-assignment',
    'find-existing',
    'save-file',
    'upsert',
    'commit'
  ]);
  assert.equal(storedFiles.length, 1);
});

test('US-08 accepts late work when enabled and records rounded-up late minutes', async () => {
  const { service, repository } = createFixture({
    assignment: {
      id: 4,
      course_id: 9,
      deadline: new Date('2026-10-21T10:59:30.000Z'),
      allow_late: true,
      status: 'OPEN'
    }
  });
  let saved;
  repository.upsert = async (data) => {
    saved = data;
    return {
      status: data.status,
      isLate: data.isLate,
      lateMinutes: data.lateMinutes
    };
  };

  const submission = await service.submitAssignment({
    assignmentId: 4,
    studentId: 5,
    upload
  });

  assert.equal(submission.status, 'SUBMITTED_LATE');
  assert.equal(submission.isLate, true);
  assert.equal(submission.lateMinutes, 1);
  assert.equal(saved.submittedAt.toISOString(), '2026-10-21T11:00:00.000Z');
});

test('US-08 allows resubmission after deadline only when late submissions are enabled', async () => {
  const { service, repository } = createFixture({
    assignment: {
      id: 4,
      course_id: 9,
      deadline: new Date('2026-10-21T10:00:00.000Z'),
      allow_late_submission: true,
      status: 'OPEN'
    },
    existing: {
      id: 12,
      filePath: 'uploads/submissions/previous.pdf',
      submissionCount: 1
    }
  });
  let saved;
  repository.upsert = async (data) => {
    saved = data;
    return { status: data.status, submissionCount: 2 };
  };

  const submission = await service.submitAssignment({
    assignmentId: 4,
    studentId: 5,
    upload
  });

  assert.equal(saved.status, 'SUBMITTED_LATE');
  assert.equal(saved.isLate, true);
  assert.equal(submission.submissionCount, 2);
});

test('US-08 rejects late work when late submission is disabled', async () => {
  const { service, events, storedFiles } = createFixture({
    assignment: {
      id: 4,
      course_id: 9,
      deadline: new Date('2026-10-21T10:00:00.000Z'),
      allow_late: false,
      status: 'OPEN'
    }
  });

  await assert.rejects(
    service.submitAssignment({ assignmentId: 4, studentId: 5, upload }),
    ForbiddenError
  );
  assert.deepEqual(events, ['begin', 'find-assignment', 'find-existing', 'rollback']);
  assert.equal(storedFiles.length, 0);
});

test('US-08 rejects an oversized upload before starting a transaction', async () => {
  const { service, events, storedFiles } = createFixture();

  await assert.rejects(
    service.submitAssignment({
      assignmentId: 4,
      studentId: 5,
      upload: { buffer: Buffer.alloc(20 * 1024 * 1024 + 1), originalname: 'large.pdf' }
    }),
    /không được vượt quá 20MB/
  );
  assert.deepEqual(events, []);
  assert.equal(storedFiles.length, 0);
});

test('US-08 rejects students who are not enrolled or whose course is archived', async () => {
  const notEnrolled = createFixture({ enrolled: false });
  await assert.rejects(
    notEnrolled.service.submitAssignment({ assignmentId: 4, studentId: 5, upload }),
    ForbiddenError
  );
  assert.deepEqual(notEnrolled.events, ['begin', 'find-assignment', 'rollback']);

  const archived = createFixture({ courseStatus: 'ARCHIVED' });
  await assert.rejects(
    archived.service.submitAssignment({ assignmentId: 4, studentId: 5, upload }),
    ConflictError
  );
  assert.deepEqual(archived.events, ['begin', 'find-assignment', 'rollback']);
});

test('US-08 resubmits in place and removes the previous file only after commit', async () => {
  const { service, events, removedFiles } = createFixture({
    existing: {
      id: 12,
      filePath: 'uploads/submissions/previous.pdf',
      submissionCount: 1
    }
  });

  const submission = await service.submitAssignment({
    assignmentId: 4,
    studentId: 5,
    upload
  });

  assert.equal(submission.submissionCount, 2);
  assert.deepEqual(removedFiles, ['uploads/submissions/previous.pdf']);
  assert.ok(events.indexOf('commit') < events.indexOf('remove:uploads/submissions/previous.pdf'));
});

test('US-08 removes the newly saved orphan file when the database transaction fails', async () => {
  const { service, events, removedFiles } = createFixture({
    upsertError: new Error('database unavailable')
  });

  await assert.rejects(
    service.submitAssignment({ assignmentId: 4, studentId: 5, upload }),
    /database unavailable/
  );

  assert.deepEqual(events, [
    'begin',
    'find-assignment',
    'find-existing',
    'save-file',
    'upsert',
    'rollback',
    'remove:00000000-0000-4000-8000-000000000001.pdf'
  ]);
  assert.deepEqual(removedFiles, ['00000000-0000-4000-8000-000000000001.pdf']);
});

test('US-08 uses a parameterized unique-key upsert for double-submit protection', async () => {
  const repository = new SubmissionRepository();
  const queries = [];
  const connection = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('INSERT INTO `submissions`')) {
        return [{ affectedRows: 1 }, []];
      }
      return [
        [
          {
            id: 12,
            assignment_id: 4,
            student_id: 5,
            original_filename: 'report.pdf',
            file_uuid: 'uuid',
            file_path: 'uploads/report.pdf',
            file_size_bytes: 12,
            mime_type: 'application/pdf',
            submitted_at: new Date(),
            is_late: 0,
            late_minutes: 0,
            submission_count: 1,
            status: 'SUBMITTED'
          }
        ],
        []
      ];
    }
  };

  const result = await repository.upsert(
    {
      assignmentId: 4,
      studentId: 5,
      file: {
        originalFilename: 'report.pdf',
        fileUuid: 'uuid',
        filePath: 'uploads/report.pdf',
        fileSizeBytes: 12,
        mimeType: 'application/pdf'
      },
      submittedAt: new Date(),
      isLate: false,
      lateMinutes: 0,
      status: 'SUBMITTED'
    },
    connection
  );

  assert.equal(result.id, 12);
  assert.match(queries[0].sql, /ON DUPLICATE KEY UPDATE/);
  assert.match(queries[0].sql, /`submission_count` = `submission_count` \+ 1/);
  assert.ok(queries[0].sql.includes('?'));
  assert.equal(queries[0].params[0], 4);
  assert.equal(queries[0].params[1], 5);
});

test('US-08 reads only the authenticated student submission after enrollment check', async () => {
  const { service, repository } = createFixture();
  const savedSubmission = { id: 12, studentId: 5, status: 'SUBMITTED' };
  let requestedAssignmentId;
  let requestedStudentId;
  repository.findAssignment = async (assignmentId) => {
    requestedAssignmentId = assignmentId;
    return { course_id: 9 };
  };
  repository.findByAssignmentAndStudent = async (assignmentId, studentId) => {
    requestedAssignmentId = assignmentId;
    requestedStudentId = studentId;
    return savedSubmission;
  };

  const result = await service.getMySubmission({ assignmentId: 4, studentId: 5 });

  assert.equal(result, savedSubmission);
  assert.equal(requestedAssignmentId, 4);
  assert.equal(requestedStudentId, 5);
});

test('US-08 rejects invalid IDs, missing assignments, and archived courses with the expected status', async () => {
  const invalidId = createFixture();
  await assert.rejects(
    invalidId.service.submitAssignment({
      assignmentId: 'not-an-id',
      studentId: 5,
      upload
    }),
    (error) => error.statusCode === 422
  );

  const missingAssignment = createFixture();
  missingAssignment.repository.findAssignmentForUpdate = async () => null;
  const missingResponse = await missingAssignment.service.submitAssignment({
    assignmentId: 4,
    studentId: 5,
    upload
  }).catch((error) => error);
  assert.equal(missingResponse.statusCode, 404);
  assert.deepEqual(missingAssignment.events, ['begin', 'rollback']);

  const archived = createFixture({ courseStatus: 'ARCHIVED' });
  await assert.rejects(
    archived.service.submitAssignment({ assignmentId: 4, studentId: 5, upload }),
    (error) => error instanceof ConflictError && error.statusCode === 409
  );
});

test('US-08 HTTP endpoint returns 401, 403, and 400 for auth, role, and missing file errors', async (t) => {
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });

  const fixture = createFixture();
  const app = express();
  app.use(
    '/api',
    createSubmissionRouter({
      submissionController: new SubmissionController(fixture.service),
      uploadLimiter: (req, res, next) => next()
    })
  );
  app.use(errorHandler);
  const token = (id, role) =>
    jwt.sign({ id, role, token_version: 0 }, config.JWT_SECRET, { expiresIn: '5m' });

  const unauthenticated = await request(app).post('/api/assignments/4/submissions');
  assert.equal(unauthenticated.status, 401);

  const wrongRole = await request(app)
    .post('/api/assignments/4/submissions')
    .set('Authorization', `Bearer ${token(3, 'GIANG_VIEN')}`);
  assert.equal(wrongRole.status, 403);

  const missingFile = await request(app)
    .post('/api/assignments/4/submissions')
    .set('Authorization', `Bearer ${token(5, 'SINH_VIEN')}`)
    .field('description', 'Bài làm');
  assert.equal(missingFile.status, 400);
  assert.equal(missingFile.body.message, 'Vui lòng đính kèm tệp bài làm.');

  const archivedFixture = createFixture({ courseStatus: 'ARCHIVED' });
  const archivedApp = express();
  archivedApp.use(
    '/api',
    createSubmissionRouter({
      submissionController: new SubmissionController(archivedFixture.service),
      uploadLimiter: (req, res, next) => next()
    })
  );
  archivedApp.use(errorHandler);
  const archivedResponse = await request(archivedApp)
    .post('/api/assignments/4/submissions')
    .set('Authorization', `Bearer ${token(5, 'SINH_VIEN')}`)
    .attach('file', upload.buffer, upload.originalname);
  assert.equal(archivedResponse.status, 409);
});

test('US-08 returns HTTP 413 for uploads larger than the accepted file size', async (t) => {
  const submissionController = {
    async getMySubmission(req, res) {
      return res.status(200).json({ success: true, data: null });
    },
    async submitAssignment() {
      assert.fail('Oversized upload must be rejected before reaching the controller.');
    }
  };
  const app = express();
  app.use(
    '/api',
    createSubmissionRouter({
      submissionController,
      uploadLimiter: (req, res, next) => next()
    })
  );
  app.use(errorHandler);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });
  const token = jwt.sign({ id: 5, role: 'SINH_VIEN', token_version: 0 }, config.JWT_SECRET, {
    expiresIn: '5m'
  });

  const response = await request(app)
    .post('/api/assignments/4/submissions')
    .set('Authorization', ['Bearer', token].join(' '))
    .attach('file', Buffer.alloc(20 * 1024 * 1024 + 1), 'large.pdf');

  assert.equal(response.status, 413);
  assert.equal(response.body.message, 'Tệp bài nộp không được vượt quá 20MB.');
});

test('US-08 applies a 10 requests per minute limit to authenticated uploads', async (t) => {
  let handledUploads = 0;
  const submissionController = {
    async getMySubmission(req, res) {
      return res.status(200).json({ success: true, data: null });
    },
    async submitAssignment(req, res) {
      handledUploads += 1;
      return res.status(201).json({ success: true });
    }
  };
  const app = express();
  app.use('/api', createSubmissionRouter({ submissionController }));
  app.use(errorHandler);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });
  const token = jwt.sign({ id: 5, role: 'SINH_VIEN', token_version: 0 }, config.JWT_SECRET, {
    expiresIn: '5m'
  });
  const responses = [];

  for (let index = 0; index < 11; index += 1) {
    const response = await request(app)
      .post('/api/assignments/4/submissions')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('test'), 'report.pdf');
    responses.push(response.status);
  }

  assert.equal(responses.filter((status) => status === 201).length, 10);
  assert.equal(responses[10], 429);
  assert.equal(handledUploads, 10);
});

test('US-08 HTTP endpoint returns student submission detail', async (t) => {
  const fixture = createFixture();
  const submissionController = new SubmissionController(fixture.service);
  const app = express();
  app.use(
    '/api',
    createSubmissionRouter({
      submissionController,
      uploadLimiter: (req, res, next) => next()
    })
  );
  app.use(errorHandler);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });
  const token = jwt.sign({ id: 5, role: 'SINH_VIEN', token_version: 0 }, config.JWT_SECRET, {
    expiresIn: '5m'
  });

  const response = await request(app)
    .get('/api/assignments/4/submissions/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});
