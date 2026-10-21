const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const errorHandler = require('../../src/common/errorHandler');
const { ForbiddenError } = require('../../src/common/errors');
const { createCourseAccessFake } = require('../../src/contracts/fakes');
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
    ...createCourseAccessFake(),
    async validateEnrollment(courseId, studentId) {
      return {
        courseId,
        studentId,
        enrolled,
        courseStatus
      };
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
    filePath: 'uploads/submissions/uuid-1.pdf',
    fileSizeBytes: upload.buffer.length,
    mimeType: 'application/pdf',
    submittedAt: new Date('2026-10-21T11:00:00.000Z'),
    isLate: false,
    lateMinutes: 0,
    submissionCount: existing ? 2 : 1,
    status: 'SUBMITTED'
  };
  const repository = {
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
    async saveFile(options) {
      assert.equal(options.originalName, upload.originalname);
      assert.equal(options.subdirectory, 'submissions');
      fileNumber += 1;
      const file = {
        fileUuid: `uuid-${fileNumber}`,
        filePath: `uploads/submissions/uuid-${fileNumber}.pdf`,
        fileSizeBytes: options.buffer.length,
        mimeType: 'application/pdf',
        originalFilename: options.originalName
      };
      storedFiles.push(file);
      events.push('save-file');
      return file;
    }
  };
  const fileSystem = {
    async rm(filePath) {
      removedFiles.push(filePath);
      events.push(`remove:${filePath}`);
    }
  };
  const courseAccess = createCourseAccess({ enrolled, courseStatus });
  const service = new SubmissionService({
    submissionRepository: repository,
    storageClient,
    transactionRunner,
    clock: { now: () => new Date('2026-10-21T11:00:00.000Z') },
    fileSystem,
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
    ForbiddenError
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
    'remove:uploads/submissions/uuid-1.pdf'
  ]);
  assert.deepEqual(removedFiles, ['uploads/submissions/uuid-1.pdf']);
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

test('US-08 applies a 10 requests per minute limit to authenticated uploads', async () => {
  let handledUploads = 0;
  const submissionController = {
    async submitAssignment(req, res) {
      handledUploads += 1;
      return res.status(201).json({ success: true });
    }
  };
  const app = express();
  app.use('/api/m2-assessment', createSubmissionRouter({ submissionController }));
  app.use(errorHandler);
  const token = jwt.sign({ id: 5, role: 'SINH_VIEN' }, config.JWT_SECRET, {
    expiresIn: '5m'
  });
  const responses = [];

  for (let index = 0; index < 11; index += 1) {
    const response = await request(app)
      .post('/api/m2-assessment/assignments/4/submissions')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('test'), 'report.pdf');
    responses.push(response.status);
  }

  assert.equal(responses.filter((status) => status === 201).length, 10);
  assert.equal(responses[10], 429);
  assert.equal(handledUploads, 10);
});
