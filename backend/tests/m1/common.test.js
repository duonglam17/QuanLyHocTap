const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
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
const { ValidationError } = require('../../src/common/errors');
const errorHandler = require('../../src/common/errorHandler');
const config = require('../../src/common/config');
const sanitizeText = require('../../src/common/sanitizeText');
const { saveFile } = require('../../src/common/storage');
const validate = require('../../src/common/validate');
const withTransaction = require('../../src/common/withTransaction');

test('contract registry handles required and optional ports', () => {
  const registry = createRegistry();
  const implementation = createCourseAccessFake();

  assert.throws(() => registry.getPort('courseAccess'), /chưa được đăng ký/);
  assert.equal(registry.getPort('notifications', { optional: true }), null);
  registry.registerPort('courseAccess', implementation);
  assert.equal(registry.getPort('courseAccess'), implementation);
  assert.throws(() => registry.registerPort('courseAccess', implementation), /đã được đăng ký/);
});

test('contract fakes expose the declared Port data shapes', async () => {
  const courseAccess = createCourseAccessFake();
  const quizResults = createQuizResultsFake([
    {
      quizId: 9,
      title: 'Quiz',
      score: 8,
      totalQuestions: 10,
      correctAnswersCount: 8,
      status: 'SUBMITTED'
    }
  ]);
  const notifications = createNotificationsFake();

  assert.deepEqual(await courseAccess.validateEnrollment(1, 2), {
    courseId: 1,
    studentId: 2,
    enrolled: true
  });
  assert.deepEqual(await courseAccess.validateCourseOwner(1, 3), {
    courseId: 1,
    instructorId: 3,
    isOwner: true
  });
  assert.deepEqual(await courseAccess.getLessonSummary(4), {
    id: 4,
    courseId: 1,
    title: 'Fake lesson',
    orderIndex: 1
  });
  assert.deepEqual(await quizResults.getStudentQuizGrades(1, 2), [
    {
      quizId: 9,
      title: 'Quiz',
      score: 8,
      totalQuestions: 10,
      correctAnswersCount: 8,
      status: 'SUBMITTED'
    }
  ]);
  assert.deepEqual(await notifications.notifyCourseStudents(1, { type: 'SCHEDULE_CHANGED' }), {
    courseId: 1,
    notifiedCount: 0
  });
  assert.equal(notifications.sentNotifications.length, 1);
});

test('validate middleware parses valid input and returns structured errors', async () => {
  const middleware = validate(z.object({ count: z.coerce.number().int().positive() }));
  const validRequest = { body: { count: '3' } };

  await new Promise((resolve, reject) =>
    middleware(validRequest, {}, (error) => (error ? reject(error) : resolve()))
  );
  assert.deepEqual(validRequest.body, { count: 3 });

  const invalidRequest = { body: { count: 'zero' } };
  await new Promise((resolve) =>
    middleware(invalidRequest, {}, (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(error.details));
      resolve();
    })
  );
});

test('authentication and role middleware verify signed JWTs and enforce role access', async () => {
  const app = express();
  app.get('/protected', requireAuth, requireRole(['ADMIN']), (req, res) => {
    res.status(200).json({ id: req.user.id, role: req.user.role });
  });
  app.use(errorHandler);

  const adminToken = jwt.sign({ user_id: 17, role: 'ADMIN', token_version: 2 }, config.JWT_SECRET);
  const studentToken = jwt.sign({ user_id: 18, role: 'SINH_VIEN' }, config.JWT_SECRET);
  const valid = await request(app).get('/protected').set('Authorization', `Bearer ${adminToken}`);
  const forbidden = await request(app)
    .get('/protected')
    .set('Authorization', `Bearer ${studentToken}`);
  const invalid = await request(app).get('/protected').set('Authorization', 'Bearer invalid');

  assert.equal(valid.status, 200);
  assert.deepEqual(valid.body, { id: 17, role: 'ADMIN' });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.code, 'FORBIDDEN');
  assert.equal(invalid.status, 401);
  assert.equal(invalid.body.code, 'UNAUTHORIZED');
});

test('rate limit middleware emits the shared error envelope', async () => {
  const app = express();
  app.get('/limited', rateLimit({ windowMs: 60_000, limit: 1 }), (req, res) => res.sendStatus(200));
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

test('storage validates extension and magic bytes and saves UUID-named files outside web root', async (t) => {
  const baseDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-storage-'));
  t.after(async () => {
    await fs.rm(baseDirectory, { recursive: true, force: true });
  });

  const pdf = Buffer.from('%PDF-1.7\nLMS test file\n%%EOF');
  const saved = await saveFile({
    buffer: pdf,
    originalName: 'Báo Cáo #1 (Tập 2) !@.pdf',
    baseDirectory
  });
  const savedFiles = await fs.readdir(path.dirname(saved.filePath));

  assert.match(saved.fileUuid, /^[0-9a-f-]{36}$/i);
  assert.equal(path.basename(saved.filePath), `${saved.fileUuid}.pdf`);
  assert.equal(saved.originalFilename, 'Báo Cáo #1 (Tập 2) !@.pdf');
  assert.equal(saved.mimeType, 'application/pdf');
  assert.equal(savedFiles.length, 1);

  await assert.rejects(
    saveFile({ buffer: pdf, originalName: 'renamed.exe', baseDirectory }),
    /không được hỗ trợ/
  );
  await assert.rejects(
    saveFile({ buffer: Buffer.from('not a PDF'), originalName: 'fake.pdf', baseDirectory }),
    /không khớp/
  );
  assert.equal((await fs.readdir(path.dirname(saved.filePath))).length, 1);
});
