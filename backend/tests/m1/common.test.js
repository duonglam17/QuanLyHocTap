const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { z } = require('zod');
const test = require('node:test');

const { createRegistry } = require('../../src/contracts');
const {
  createCourseAccessFake,
  createNotificationsFake,
  createQuizResultsFake
} = require('../../src/contracts/fakes');
const createClock = require('../../src/common/clock').createClock;
const requireAuth = require('../../src/common/authMiddleware');
const requireRole = require('../../src/common/rbacMiddleware');
const rateLimit = require('../../src/common/rateLimiter');
const db = require('../../src/common/db');
const { BadRequestError, ConflictError, ValidationError } = require('../../src/common/errors');
const errorHandler = require('../../src/common/errorHandler');
const config = require('../../src/common/config');
const storage = require('../../src/common/storage');
const sanitizeText = require('../../src/common/sanitizeText');
const validate = require('../../src/common/validate');
const withTransaction = require('../../src/common/withTransaction');

test('contract registry handles required and optional ports', () => {
  const registry = createRegistry();
  const implementation = createCourseAccessFake();

  assert.throws(() => registry.getPort('courseAccess'), /chưa được đăng ký/);
  assert.throws(() => registry.getPort('notifications'), /chưa được đăng ký/);
  assert.equal(registry.getPort('notifications', { optional: true }), null);
  registry.registerPort('courseAccess', implementation);
  registry.registerPort('quizResults', createQuizResultsFake());
  registry.registerPort('notifications', createNotificationsFake());
  assert.equal(registry.getPort('courseAccess'), implementation);
  assert.throws(() => registry.registerPort('courseAccess', implementation), /đã được đăng ký/);
});

test('contract fakes expose the declared Port data shapes', async () => {
  const courseAccess = createCourseAccessFake();
  const quizScore = {
    studentId: 3,
    quizId: 9,
    quizTitle: 'Quiz',
    maxScore: 10,
    score: 8,
    attemptStatus: 'SUBMITTED',
    submittedAt: '2026-10-21T08:00:00.000Z',
    visibleToStudent: true
  };
  const pendingQuizScore = {
    studentId: 4,
    quizId: 9,
    quizTitle: 'Quiz',
    maxScore: 10,
    score: null,
    attemptStatus: null,
    submittedAt: null,
    visibleToStudent: false
  };
  const quizResults = createQuizResultsFake({
    courseScores: {
      1: [quizScore, pendingQuizScore]
    },
    studentScores: {
      '1:3': [quizScore],
      '1:4': [pendingQuizScore]
    }
  });
  const notifications = createNotificationsFake();

  assert.deepEqual(await courseAccess.getCourse(1), {
    id: 1,
    ownerId: 2,
    title: 'Fake course',
    status: 'PUBLISHED'
  });
  assert.deepEqual(Object.keys(await courseAccess.getCourse(1)), [
    'id',
    'ownerId',
    'title',
    'status'
  ]);
  assert.equal(await courseAccess.isOwner(2, 1), true);
  assert.equal(await courseAccess.isEnrolled(3, 1), true);
  assert.equal(await courseAccess.isEnrolled(4, 1), false);
  assert.equal(await courseAccess.assertCourseWritable(1), undefined);
  await assert.rejects(
    createCourseAccessFake({
      courses: [{ id: 1, ownerId: 2, title: 'Archived', status: 'ARCHIVED' }]
    }).assertCourseWritable(1),
    (error) => error instanceof ConflictError && error.code === 'COURSE_ARCHIVED'
  );
  assert.deepEqual(await courseAccess.getEnrolledStudentIds(1), [3]);
  assert.deepEqual(await courseAccess.listEnrolledStudents(1, { page: 1, limit: 20 }), {
    items: [{ id: 3, username: 'student', fullName: 'Fake Student' }],
    total: 1
  });
  assert.deepEqual(Object.keys((await courseAccess.listEnrolledStudents(1)).items[0]), [
    'id',
    'username',
    'fullName'
  ]);
  assert.deepEqual(await courseAccess.getUsersBrief([3]), [
    {
      id: 3,
      username: 'student',
      fullName: 'Fake Student',
      role: 'SINH_VIEN'
    }
  ]);
  assert.deepEqual(Object.keys((await courseAccess.getUsersBrief([3]))[0]), [
    'id',
    'username',
    'fullName',
    'role'
  ]);
  assert.deepEqual(await courseAccess.getLessonSummary(4), {
    id: 4,
    courseId: 1
  });
  assert.equal(await courseAccess.getCourse(99), null);
  assert.deepEqual(await createCourseAccessFake({ lessonSummary: null }).getLessonSummary(4), null);
  assert.deepEqual(await quizResults.getQuizScoresForCourse(1, [3, 4]), [
    quizScore,
    pendingQuizScore
  ]);
  assert.deepEqual(await quizResults.getQuizScoresForStudent(1, 3), [quizScore]);
  assert.deepEqual(await quizResults.getQuizScoresForStudent(1, 4), [pendingQuizScore]);
  assert.deepEqual(Object.keys((await quizResults.getQuizScoresForStudent(1, 3))[0]), [
    'studentId',
    'quizId',
    'quizTitle',
    'maxScore',
    'score',
    'attemptStatus',
    'submittedAt',
    'visibleToStudent'
  ]);

  const payload = {
    type: 'SCHEDULE_CHANGED',
    title: 'Lịch học đã đổi',
    message: 'Buổi học được đổi lịch.',
    refType: 'schedule',
    refId: 5,
    link: '/courses/1/schedules'
  };
  assert.equal(await notifications.notifyUser(3, payload), undefined);
  assert.equal(await notifications.notifyCourseStudents(1, payload), undefined);
  assert.deepEqual(notifications.sentNotifications, [
    { userId: 3, payload },
    { courseId: 1, payload }
  ]);
  assert.deepEqual(Object.keys(notifications.sentNotifications[0]), ['userId', 'payload']);
  assert.deepEqual(Object.keys(notifications.sentNotifications[0].payload), [
    'type',
    'title',
    'message',
    'refType',
    'refId',
    'link'
  ]);
  assert.equal(payload.type, 'SCHEDULE_CHANGED');
  assert.ok(
    ['NEW_ASSIGNMENT', 'ASSIGNMENT_GRADED', 'ANNOUNCEMENT', 'SCHEDULE_CHANGED'].includes(
      payload.type
    )
  );
  assert.equal(quizScore.maxScore, 10);
  assert.ok(['SUBMITTED', 'AUTO_SUBMITTED'].includes(quizScore.attemptStatus));
});

test('validation checks body, query, and params schemas and returns HTTP 422 errors', async () => {
  const schema = z.object({
    body: z.object({ name: z.string().min(1) }),
    query: z.object({ page: z.coerce.number().int().positive() }),
    params: z.object({ courseId: z.coerce.number().int().positive() })
  });
  const middleware = validate(schema);
  const req = {
    body: { name: 'Course' },
    query: { page: '2' },
    params: { courseId: '7' }
  };
  await new Promise((resolve, reject) =>
    middleware(req, {}, (error) => (error ? reject(error) : resolve()))
  );
  assert.deepEqual(req.body, { name: 'Course' });
  assert.deepEqual(req.query, { page: 2 });
  assert.deepEqual(req.params, { courseId: 7 });

  await new Promise((resolve) =>
    middleware(
      { body: { name: '' }, query: { page: '0' }, params: { courseId: 'invalid' } },
      {},
      (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.statusCode, 422);
        assert.ok(Array.isArray(error.details));
        resolve();
      }
    )
  );
  assert.equal(new BadRequestError().statusCode, 400);
});

test('authentication and role middleware verify signed JWTs and enforce role access', async () => {
  const app = express();
  app.get('/protected', requireAuth, requireRole('ADMIN'), (req, res) => {
    res.status(200).json({ id: req.user.id, role: req.user.role });
  });
  app.use(errorHandler);

  const adminToken = jwt.sign({ user_id: 17, role: 'ADMIN', token_version: 2 }, config.JWT_SECRET);
  const studentToken = jwt.sign(
    { user_id: 18, role: 'SINH_VIEN', token_version: 1 },
    config.JWT_SECRET
  );
  const originalQuery = db.query;
  db.query = async (sql, parameters) => {
    assert.match(sql, /status, token_version FROM users/);
    if (parameters[0] === 18) {
      return [[{ status: 'ACTIVE', token_version: 1 }], []];
    }
    return [[{ status: 'ACTIVE', token_version: 2 }], []];
  };
  let valid;
  let forbidden;
  let invalid;
  let locked;
  let temporarilyLocked;
  let staleTokenVersion;
  try {
    valid = await request(app).get('/protected').set('Authorization', `Bearer ${adminToken}`);
    forbidden = await request(app).get('/protected').set('Authorization', `Bearer ${studentToken}`);
    invalid = await request(app).get('/protected').set('Authorization', 'Bearer invalid');
    const lockedToken = jwt.sign(
      { user_id: 19, role: 'SINH_VIEN', token_version: 1 },
      config.JWT_SECRET
    );
    db.query = async () => [[{ status: 'LOCKED', token_version: 1 }], []];
    locked = await request(app).get('/protected').set('Authorization', `Bearer ${lockedToken}`);
    const temporaryToken = jwt.sign(
      { user_id: 20, role: 'SINH_VIEN', token_version: 1 },
      config.JWT_SECRET
    );
    db.query = async () => [[{ status: 'TEMPORARY_LOCKED', token_version: 1 }], []];
    temporarilyLocked = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${temporaryToken}`);
    db.query = async () => [[{ status: 'ACTIVE', token_version: 3 }], []];
    staleTokenVersion = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${adminToken}`);
  } finally {
    db.query = originalQuery;
  }

  assert.equal(valid.status, 200);
  assert.deepEqual(valid.body, { id: 17, role: 'ADMIN' });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.code, 'FORBIDDEN');
  assert.equal(invalid.status, 401);
  assert.equal(invalid.body.code, 'UNAUTHORIZED');
  assert.equal(locked.status, 401);
  assert.equal(temporarilyLocked.status, 401);
  assert.equal(staleTokenVersion.status, 401);
});

test('rate limit middleware emits the shared error envelope', async () => {
  const app = express();
  app.get('/limited', rateLimit('common-test-limit', { windowMs: 60_000, max: 1 }), (req, res) =>
    res.sendStatus(200)
  );
  app.use(errorHandler);

  const first = await request(app).get('/limited');
  const second = await request(app).get('/limited');

  assert.equal(first.status, 200);
  assert.equal(second.status, 429);
  assert.equal(second.body.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(typeof second.body.message, 'string');
  assert.equal(typeof second.body.details.retryAfterSeconds, 'number');
});

test('transaction commits on success and rolls back on failure', async () => {
  const events = [];
  const connection = {
    async beginTransaction() {
      events.push('begin');
    },
    async commit() {
      events.push('commit');
    },
    async rollback() {
      events.push('rollback');
    },
    release() {
      events.push('release');
    }
  };
  const pool = {
    async getConnection() {
      return connection;
    }
  };

  assert.equal(await withTransaction(async () => 'done', pool), 'done');
  assert.deepEqual(events, ['begin', 'commit', 'release']);

  events.length = 0;
  await assert.rejects(
    withTransaction(async () => {
      throw new Error('failed');
    }, pool),
    /failed/
  );
  assert.deepEqual(events, ['begin', 'rollback', 'release']);
});

test('clock can be injected and returns defensive Date values', () => {
  const clock = createClock(() => new Date('2026-10-21T00:00:00.000Z'));
  const first = clock.now();
  first.setUTCFullYear(2000);

  assert.equal(clock.now().toISOString(), '2026-10-21T00:00:00.000Z');
  assert.equal(clock.unixSeconds(), 1792540800);
});

test('sanitizeText strips markup and executable content', () => {
  assert.equal(sanitizeText('<b>Xin chào</b><script>alert(1)</script>'), 'Xin chào');
  assert.throws(() => sanitizeText(null), /chỉ nhận chuỗi/);
});

test('storage validates extension, size and magic bytes and streams/deletes UUID files', async (t) => {
  const pdf = Buffer.from('%PDF-1.7\nLMS test file\n%%EOF');
  let storedName;
  let savedStoredName;
  t.after(async () => {
    if (storedName) {
      await storage.deleteFile(storedName);
    }
  });
  const saved = await storage.saveUpload(
    { buffer: pdf, originalname: 'Báo Cáo #1 (Tập 2) !@.pdf' },
    {
      allowedExt: ['.pdf'],
      allowedMime: ['application/pdf'],
      maxBytes: 1024
    }
  );
  storedName = saved.storedName;
  savedStoredName = saved.storedName;
  assert.match(saved.storedName, /^[0-9a-f-]{36}\.pdf$/i);
  assert.equal(saved.originalName, 'Báo Cáo #1 (Tập 2) !@.pdf');
  assert.equal(saved.mime, 'application/pdf');
  assert.equal(saved.size, pdf.length);
  await fs.access(path.join(config.UPLOAD_DIR, saved.storedName));

  const stream = storage.openReadStream(saved.storedName);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  assert.deepEqual(Buffer.concat(chunks), pdf);
  await storage.deleteFile(saved.storedName);
  storedName = null;
  await assert.rejects(fs.access(path.join(config.UPLOAD_DIR, savedStoredName)));

  await assert.rejects(
    storage.saveUpload(
      { buffer: pdf, originalname: 'renamed.exe' },
      { allowedExt: ['.pdf'], allowedMime: ['application/pdf'], maxBytes: 1024 }
    ),
    /không được hỗ trợ/
  );
  await assert.rejects(
    storage.saveUpload(
      { buffer: pdf, originalname: 'large.pdf' },
      { allowedExt: ['.pdf'], allowedMime: ['application/pdf'], maxBytes: 1 }
    ),
    /vượt quá giới hạn/
  );
  await assert.rejects(
    storage.saveUpload(
      { buffer: Buffer.from('not a PDF'), originalname: 'fake.pdf' },
      { allowedExt: ['.pdf'], allowedMime: ['application/pdf'], maxBytes: 1024 }
    ),
    /không khớp/
  );
});
