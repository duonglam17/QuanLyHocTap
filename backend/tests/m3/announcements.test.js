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
const createAnnouncementRepository = require('../../src/modules/m3-quiz/repositories/announcementRepository');
const createAnnouncementRoutes = require('../../src/modules/m3-quiz/routes/announcementRoutes');
const { createAnnouncementService } = require('../../src/modules/m3-quiz/services/announcementService');

function makeAnnouncementService(overrides = {}) {
  const events = [];
  const courseAccess = overrides.courseAccess || createCourseAccessFake();
  const repository = {
    async create(_connection, courseId, authorId, title, content) {
      events.push(['insert', courseId, authorId, title, content]);
      return {
        id: 91,
        courseId,
        authorId,
        title,
        content,
        createdAt: new Date('2026-10-24T00:00:00.000Z')
      };
    },
    async listForCourse(courseId, pagination) {
      events.push(['list', courseId, pagination]);
      return { items: [], page: pagination.page, limit: pagination.limit, total: 0 };
    },
    async findForUpdate(_connection, announcementId) {
      events.push(['find-for-update', announcementId]);
      return { id: announcementId, courseId: 1, authorId: 2 };
    },
    async delete(_connection, announcementId) {
      events.push(['delete', announcementId]);
      return true;
    },
    ...overrides.repository
  };
  const notifications = {
    async notifyCourseStudents(...args) {
      events.push(['notify', ...args]);
      if (overrides.notifyError) {
        throw overrides.notifyError;
      }
    }
  };
  const logger = {
    errors: [],
    error(message, error) {
      this.errors.push({ message, error });
    },
    ...overrides.logger
  };
  const service = createAnnouncementService({
    repository,
    getCourseAccess: () => courseAccess,
    getNotificationsPort: () => notifications,
    withTransaction: async (work) => {
      const result = await work({ transaction: true });
      events.push(['commit']);
      return result;
    },
    sanitizeText,
    logger
  });

  return { service, repository, events, courseAccess, notifications, logger };
}

test('creates a sanitized announcement and notifies students only after commit', async () => {
  const { service, events } = makeAnnouncementService();
  const result = await service.create(
    1,
    2,
    'GIANG_VIEN',
    {
      title: '<b>Class update</b>',
      content: '<script>alert(1)</script>Make-up class at 8 AM'
    }
  );

  assert.equal(result.title, 'Class update');
  assert.equal(result.content.includes('<script>'), false);
  assert.deepEqual(events.map(([type]) => type), ['insert', 'commit', 'notify']);
  assert.deepEqual(events[2], [
    'notify',
    1,
    {
      type: 'ANNOUNCEMENT',
      title: 'Class update',
      message: 'Make-up class at 8 AM',
      refType: 'announcement',
      refId: 91,
      link: '/courses/1'
    }
  ]);
});

test('notification delivery is best effort and does not undo a committed announcement', async () => {
  const { service, events, logger } = makeAnnouncementService({
    notifyError: new Error('notification provider unavailable')
  });

  const result = await service.create(
    1,
    2,
    'GIANG_VIEN',
    { title: 'Update', content: 'New date' }
  );

  assert.equal(result.id, 91);
  assert.deepEqual(events.map(([type]) => type), ['insert', 'commit', 'notify']);
  assert.equal(logger.errors.length, 1);
});

test('only the course owner or Admin can create or delete announcements', async (t) => {
  await t.test('non-owner instructor cannot create', async () => {
    const { service } = makeAnnouncementService({
      courseAccess: {
        async getCourse() {
          return { id: 1 };
        },
        async isOwner() {
          return false;
        },
        async isEnrolled() {
          return false;
        },
        async assertCourseWritable() {}
      }
    });

    await assert.rejects(
      service.create(1, 9, 'GIANG_VIEN', { title: 'Update', content: 'Details' }),
      (error) => error.code === 'FORBIDDEN'
    );
  });

  await t.test('Admin may delete', async () => {
    const { service, events } = makeAnnouncementService();
    assert.deepEqual(await service.delete(91, 99, 'ADMIN'), {
      id: 91,
      deleted: true
    });
    assert.equal(events.some(([type]) => type === 'delete'), true);
  });
});

test('only course members, owner, or Admin can read paginated announcements', async () => {
  const { service, events } = makeAnnouncementService();
  const result = await service.list(1, 3, 'SINH_VIEN', { page: 2, limit: 10 });

  assert.deepEqual(result, { items: [], page: 2, limit: 10, total: 0 });
  assert.deepEqual(events[0], ['list', 1, { page: 2, limit: 10 }]);

  const unauthorized = makeAnnouncementService({
    courseAccess: {
      async getCourse() {
        return { id: 1 };
      },
      async isOwner() {
        return false;
      },
      async isEnrolled() {
        return false;
      }
    }
  });
  await assert.rejects(
    unauthorized.service.list(1, 77, 'SINH_VIEN', { page: 1, limit: 20 }),
    (error) => error.code === 'FORBIDDEN'
  );
});

test('course access checks accept validated numeric route identifiers with the shared fake', async () => {
  const { service } = makeAnnouncementService();
  const result = await service.create(
    '1',
    2,
    'GIANG_VIEN',
    { title: 'Update', content: 'Details' }
  );

  assert.equal(result.courseId, '1');
});

test('announcement repository uses parameterized pagination and delete queries', async () => {
  const queries = [];
  const repository = createAnnouncementRepository({
    async query(sql, values) {
      queries.push({ sql, values });
      if (/COUNT/.test(sql)) {
        return [[{ total: 1 }]];
      }
      return [[{ id: 91, title: 'Update' }]];
    }
  });

  const result = await repository.listForCourse(1, { page: 2, limit: 10 });

  assert.equal(result.total, 1);
  assert.match(queries[0].sql, /WHERE course_id = \?/);
  assert.match(queries[1].sql, /ORDER BY created_at DESC, id DESC/);
  assert.deepEqual(queries[1].values, [1, 10, 10]);
});

test('announcement routes reject students from the write endpoints', async () => {
  const service = {
    async create() {
      assert.fail('student must be rejected by RBAC before reaching service');
    },
    async list() {
      return { items: [], page: 1, limit: 20, total: 0 };
    },
    async delete() {
      assert.fail('student must be rejected by RBAC before reaching service');
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createAnnouncementRoutes(service));
  app.use(errorHandler);
  const token = jwt.sign(
    { user_id: 3, role: 'SINH_VIEN', token_version: 1 },
    config.JWT_SECRET
  );
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }]];

  try {
    const createResponse = await request(app)
      .post('/api/courses/1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Update', content: 'Details' });
    const deleteResponse = await request(app)
      .delete('/api/announcements/91')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(createResponse.status, 403);
    assert.equal(deleteResponse.status, 403);
  } finally {
    db.query = originalQuery;
  }
});
