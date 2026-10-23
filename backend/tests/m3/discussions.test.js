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
const createDiscussionRepository = require('../../src/modules/m3-quiz/repositories/discussionRepository');
const createDiscussionRoutes = require('../../src/modules/m3-quiz/routes/discussionRoutes');
const { createDiscussionService } = require('../../src/modules/m3-quiz/services/discussionService');

function createHarness(overrides = {}) {
  const events = [];
  const records = new Map();
  let nextId = 20;
  const repository = {
    async create(_connection, input) {
      const record = {
        id: nextId++,
        ...input,
        createdAt: new Date('2026-10-24T00:00:00.000Z'),
        updatedAt: new Date('2026-10-24T00:00:00.000Z')
      };
      records.set(record.id, record);
      events.push(['create', record]);
      return record;
    },
    async findById(id) {
      return records.get(Number(id)) || null;
    },
    async listRootDiscussions(lessonId, pagination) {
      events.push(['list', lessonId, pagination]);
      return { items: [], page: pagination.page, limit: pagination.limit, total: 0 };
    },
    ...overrides.repository
  };
  const courseAccess = overrides.courseAccess || createCourseAccessFake({
    lessonSummary: { courseId: 1 }
  });
  const service = createDiscussionService({
    repository,
    getCourseAccess: () => overrides.getCourseAccess === undefined
      ? courseAccess
      : overrides.getCourseAccess,
    withTransaction: async (work) => {
      const result = await work({ transaction: true });
      events.push(['commit']);
      return result;
    },
    sanitizeText
  });
  return { service, repository, courseAccess, events, records };
}

test('creates sanitized lesson discussion for an enrolled member', async () => {
  const { service, events } = createHarness();

  const result = await service.create(
    '4',
    3,
    '<script>alert(1)</script>Question about REST and GraphQL'
  );

  assert.equal(result.lessonId, 4);
  assert.equal(result.courseId, 1);
  assert.equal(result.content.includes('<script>'), false);
  assert.deepEqual(result.author, {
    id: 3,
    username: 'student',
    fullName: 'Fake Student',
    role: 'SINH_VIEN'
  });
  assert.deepEqual(events.map(([name]) => name), ['create', 'commit']);
});

test('rejects users who are neither enrolled nor course owner', async () => {
  const { service } = createHarness({
    courseAccess: {
      async getLessonSummary() {
        return { id: 4, courseId: 1 };
      },
      async getCourse() {
        return { id: 1, status: 'PUBLISHED' };
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
    service.create(4, 99, 'question'),
    (error) => error.code === 'FORBIDDEN'
  );
});

test('rejects missing lesson and missing courseAccess dependency explicitly', async (t) => {
  await t.test('lesson missing', async () => {
    const { service } = createHarness({
      courseAccess: {
        async getLessonSummary() {
          return null;
        },
        async getCourse() {
          return null;
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
      service.list(4, 3, { page: 1, limit: 20 }),
      (error) => error.code === 'NOT_FOUND'
    );
  });

  await t.test('port unavailable', async () => {
    const { service } = createHarness({ getCourseAccess: () => null });
    await assert.rejects(
      service.list(4, 3, { page: 1, limit: 20 }),
      (error) => error.code === 'INTERNAL_ERROR'
    );
  });
});

test('reply to a reply is stored under its root thread', async () => {
  const { service, records } = createHarness();
  const root = await service.create(4, 3, 'Root question');
  const firstReply = await service.reply(root.id, 3, 'First reply');
  const secondReply = await service.reply(firstReply.id, 3, 'Nested response');

  assert.equal(firstReply.parentDiscussionId, root.id);
  assert.equal(secondReply.parentDiscussionId, root.id);
  assert.equal(records.size, 3);
});

test('lists paginated root discussions after course membership check', async () => {
  const { service, events } = createHarness();
  const result = await service.list('4', 3, { page: 2, limit: 5 });

  assert.deepEqual(result, { items: [], page: 2, limit: 5, total: 0 });
  assert.deepEqual(events[0], ['list', 4, { page: 2, limit: 5 }]);
});

test('discussion repository executes parameterized paginated query and loads replies by root IDs', async () => {
  const queries = [];
  const repository = createDiscussionRepository({
    async query(sql, values) {
      queries.push({ sql, values });
      if (/COUNT\(\*\)/.test(sql)) {
        return [[{ total: 1 }]];
      }
      if (/parent_discussion_id IN/.test(sql)) {
        return [[{
          id: 22,
          courseId: 1,
          lessonId: 4,
          parentDiscussionId: 20,
          authorId: 3,
          content: 'Reply'
        }]];
      }
      return [[{
        id: 20,
        courseId: 1,
        lessonId: 4,
        authorId: 2,
        content: 'Root'
      }]];
    }
  });

  const result = await repository.listRootDiscussions(4, { page: 1, limit: 10 });

  assert.deepEqual(result.items[0].replies.map((reply) => reply.id), [22]);
  assert.deepEqual(queries[1].values, [4, 10, 0]);
  assert.deepEqual(queries[2].values, [20]);
});

test('discussion repository inserts a reply with its root ID in a transaction', async () => {
  const queries = [];
  const repository = createDiscussionRepository({});
  const discussion = await repository.create(
    {
      async query(sql, values) {
        queries.push({ sql, values });
        if (/INSERT INTO discussions/.test(sql)) {
          return [{ insertId: 21 }];
        }
        return [[{
          id: 21,
          courseId: 1,
          lessonId: 4,
          parentDiscussionId: 20,
          authorId: 3,
          content: 'Reply'
        }]];
      }
    },
    {
      courseId: 1,
      lessonId: 4,
      parentDiscussionId: 20,
      authorId: 3,
      content: 'Reply'
    }
  );

  assert.equal(discussion.id, 21);
  assert.match(queries[0].sql, /INSERT INTO discussions/);
  assert.deepEqual(queries[0].values, [1, 4, 20, 3, 'Reply']);
  assert.match(queries[1].sql, /WHERE id = \?/);
  assert.deepEqual(queries[1].values, [21]);
});

test('discussion routes validate role and input before invoking handlers', async () => {
  const calls = [];
  const service = {
    async create(...args) {
      calls.push(['create', ...args]);
      return { id: 20 };
    },
    async reply(...args) {
      calls.push(['reply', ...args]);
      return { id: 21 };
    },
    async list(...args) {
      calls.push(['list', ...args]);
      return {
        items: [],
        page: args[2].page,
        limit: args[2].limit,
        total: 0
      };
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createDiscussionRoutes(service));
  app.use(errorHandler);
  const studentToken = jwt.sign(
    { user_id: 3, role: 'SINH_VIEN', token_version: 1 },
    config.JWT_SECRET
  );
  const adminToken = jwt.sign(
    { user_id: 1, role: 'ADMIN', token_version: 1 },
    config.JWT_SECRET
  );
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }]];

  try {
    const created = await request(app)
      .post('/api/lessons/4/comments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'Question' });
    const reply = await request(app)
      .post('/api/comments/20/replies')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'Reply' });
    const listed = await request(app)
      .get('/api/lessons/4/comments?page=2&limit=5')
      .set('Authorization', `Bearer ${studentToken}`);
    const forbidden = await request(app)
      .post('/api/lessons/4/comments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Admin not in allowed roles' });

    assert.equal(created.status, 201);
    assert.equal(reply.status, 201);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.limit, 5);
    assert.equal(forbidden.status, 403);
    assert.equal(calls.length, 3);
    assert.equal(calls[2][3].limit, 5);
  } finally {
    db.query = originalQuery;
  }
});
