const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const sanitizeText = require('../../src/common/sanitizeText');
const { createRegistry } = require('../../src/contracts');
const { createCourseAccessFake } = require('../../src/contracts/fakes');
const createNotificationRoutes = require('../../src/modules/m3-quiz/routes/notificationRoutes');
const createNotificationRepository = require('../../src/modules/m3-quiz/repositories/notificationRepository');
const { createNotificationService } = require('../../src/modules/m3-quiz/services/notificationService');

function createLogger() {
  return {
    errors: [],
    error(message, error) {
      this.errors.push({ message, error });
    }
  };
}

function createPayload(overrides = {}) {
  return {
    type: 'NEW_ASSIGNMENT',
    title: 'New assignment',
    message: 'Assignment is available',
    refType: 'assignment',
    refId: 12,
    link: '/assignments/12',
    ...overrides
  };
}

test('init registers a notifications Port and sends course notifications through courseAccess', async () => {
  const { router, init } = require('../../src/modules/m3-quiz');
  const registry = createRegistry();
  const courseAccess = createCourseAccessFake();
  const calls = [];
  courseAccess.getEnrolledStudentIds = async (courseId) => {
    assert.equal(courseId, 7);
    return [3, 4, 4];
  };
  registry.registerPort('courseAccess', courseAccess);

  init({
    db: {
      async query(sql, values) {
        calls.push({ sql, values });
        return [{ affectedRows: 2 }];
      }
    },
    logger: createLogger(),
    common: { sanitizeText },
    contracts: registry
  });

  assert.ok(router);
  const notifications = registry.getPort('notifications');
  assert.equal(typeof notifications.notifyUser, 'function');
  assert.equal(typeof notifications.notifyCourseStudents, 'function');

  const result = await notifications.notifyCourseStudents(7, createPayload());
  assert.deepEqual(result, { courseId: 7, notifiedCount: 2 });
  assert.match(calls[0].sql, /INSERT INTO notifications/);
  assert.match(calls[0].sql, /VALUES \(\?, \?, \?, \?, \?, \?, \?, \?\), \(\?, \?, \?, \?, \?, \?, \?, \?\)/);
  assert.deepEqual(calls[0].values.slice(0, 8), [
    3,
    7,
    'New assignment',
    'Assignment is available',
    'NEW_ASSIGNMENT',
    'assignment',
    '12',
    '/assignments/12'
  ]);
});

test('notifyUser persists one notification and best-effort errors are logged, not thrown', async () => {
  const logger = createLogger();
  const inserted = [];
  const service = createNotificationService({
    repository: {
      async createForUser(...args) {
        inserted.push(args);
        if (args[0] === 999) {
          throw new Error('database unavailable');
        }
      }
    },
    getCourseAccess: () => null,
    logger,
    sanitizeText
  });

  assert.deepEqual(await service.notifyUser(15, createPayload()), {
    userId: 15,
    notifiedCount: 1
  });
  assert.deepEqual(await service.notifyUser(999, createPayload()), {
    userId: 999,
    notifiedCount: 0
  });
  assert.deepEqual(await service.notifyCourseStudents(7, createPayload()), {
    courseId: 7,
    notifiedCount: 0
  });
  assert.equal(inserted.length, 2);
  assert.equal(logger.errors.length, 2);
});

test('marking a notification read is scoped to its owner', async () => {
  const queries = [];
  const repository = createNotificationRepository({
    async query(sql, values) {
      queries.push({ sql, values });
      return [[]];
    }
  });
  const service = createNotificationService({
    repository,
    getCourseAccess: () => null,
    logger: createLogger(),
    sanitizeText
  });

  await assert.rejects(service.markNotificationRead('43', 21), /Không tìm thấy thông báo/);
  assert.match(queries[0].sql, /WHERE id = \? AND user_id = \?/);
  assert.deepEqual(queries[0].values, ['43', 21]);
});

test('notification routes list and mark only the authenticated user’s notifications', async () => {
  const calls = [];
  const service = {
    async getNotifications(userId, pagination) {
      calls.push({ operation: 'list', userId, pagination });
      return { items: [], page: pagination.page, limit: pagination.limit, total: 0 };
    },
    async markNotificationRead(notificationId, userId) {
      calls.push({ operation: 'read', notificationId, userId });
      return { id: notificationId, isRead: true };
    }
  };
  const app = express();
  app.use('/api/notifications', createNotificationRoutes(service));
  app.use(errorHandler);
  const token = jwt.sign(
    { user_id: 21, role: 'SINH_VIEN', token_version: 1 },
    config.JWT_SECRET
  );
  const authorization = `Bearer ${token}`;

  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }]];
  try {
    const listResponse = await request(app)
      .get('/api/notifications')
      .set('Authorization', authorization);
    assert.equal(listResponse.status, 200);
    assert.deepEqual(listResponse.body, { items: [], page: 1, limit: 20, total: 0 });

    const readResponse = await request(app)
      .patch('/api/notifications/43/read')
      .set('Authorization', authorization);
    assert.equal(readResponse.status, 200);
    assert.deepEqual(readResponse.body, { id: '43', isRead: true });
    assert.deepEqual(calls, [
      { operation: 'list', userId: 21, pagination: { page: 1, limit: 20 } },
      { operation: 'read', notificationId: '43', userId: 21 }
    ]);

    const unauthorizedResponse = await request(app).get('/api/notifications');
    assert.equal(unauthorizedResponse.status, 401);
  } finally {
    db.query = originalQuery;
  }
});
