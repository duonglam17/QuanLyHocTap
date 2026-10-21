const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const { ForbiddenError, ValidationError } = require('../../src/common/errors');
const { createCourseAccessFake, createNotificationsFake } = require('../../src/contracts/fakes');
const { registerPort } = require('../../src/contracts');
const AssignmentService = require('../../src/modules/m2-assessment/services/assignmentService');

function createCourseAccess({ owner = true, writable = true } = {}) {
  return {
    ...createCourseAccessFake({ courseOwner: { isOwner: owner } }),
    async isOwner() {
      return owner;
    },
    async assertCourseWritable() {
      if (!writable) {
        throw new ForbiddenError('Course is read-only');
      }
    }
  };
}

function createTransactionDb(events) {
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

  return {
    getPool() {
      return {
        async getConnection() {
          return connection;
        }
      };
    }
  };
}

function createService({ repository, events = [], owner = true, writable = true, ports = true }) {
  const courseAccess = createCourseAccess({ owner, writable });
  const notifications = createNotificationsFake();
  const notify = notifications.notifyCourseStudents.bind(notifications);
  notifications.notifyCourseStudents = async (...args) => {
    events.push('notify');
    return notify(...args);
  };

  return {
    events,
    notifications,
    service: new AssignmentService({
      assignmentRepository: repository,
      dbClient: createTransactionDb(events),
      clock: { now: () => new Date('2026-10-21T10:00:00.000Z') },
      getPortFn(name, options) {
        assert.equal(options.optional, true);
        if (!ports) {
          return null;
        }
        return name === 'courseAccess' ? courseAccess : name === 'notifications' ? notifications : null;
      }
    })
  };
}

test('US-07 creates an assignment transactionally, sanitizes text, and notifies after commit', async () => {
  const events = [];
  let persisted;
  const repository = {
    async create(assignment, connection) {
      assert.ok(connection);
      events.push('create');
      persisted = assignment;
      return { id: 11, ...assignment };
    }
  };
  const { service, notifications } = createService({ repository, events });

  const result = await service.createAssignment({
    courseId: 3,
    instructorId: 8,
    title: '<script>alert(1)</script>Essay',
    description: 'Read <script>alert(1)</script> the prompt',
    dueDate: '2026-10-22T10:00:00.000Z',
    allowLateSubmission: true
  });

  assert.equal(persisted.title, 'Essay');
  assert.equal(persisted.description, 'Read  the prompt');
  assert.equal(persisted.maxScore, 10);
  assert.equal(persisted.allowLateSubmission, true);
  assert.equal(persisted.status, 'OPEN');
  assert.equal(result.id, 11);
  assert.deepEqual(events, ['begin', 'create', 'commit', 'release', 'notify']);
  assert.equal(notifications.sentNotifications.length, 1);
  assert.equal(notifications.sentNotifications[0].notification.type, 'NEW_ASSIGNMENT');
});

test('US-07 rejects a caller who does not own the course', async () => {
  let createCalls = 0;
  const repository = {
    async create() {
      createCalls += 1;
    }
  };
  const { service } = createService({ repository, owner: false });

  await assert.rejects(
    service.createAssignment({
      courseId: 3,
      instructorId: 8,
      title: 'Essay',
      dueDate: '2026-10-22T10:00:00.000Z'
    }),
    ForbiddenError
  );
  assert.equal(createCalls, 0);
});

test('US-07 rejects a course without write permission', async () => {
  let createCalls = 0;
  const repository = {
    async create() {
      createCalls += 1;
    }
  };
  const { service } = createService({ repository, writable: false });

  await assert.rejects(
    service.createAssignment({
      courseId: 3,
      instructorId: 8,
      title: 'Essay',
      dueDate: '2026-10-22T10:00:00.000Z'
    }),
    ForbiddenError
  );
  assert.equal(createCalls, 0);
});

test('US-07 fails closed when courseAccess is unavailable', async () => {
  const repository = { async create() { throw new Error('Must not create'); } };
  const { service } = createService({ repository, ports: false });

  await assert.rejects(
    service.createAssignment({
      courseId: 3,
      instructorId: 8,
      title: 'Essay',
      dueDate: '2026-10-22T10:00:00.000Z'
    }),
    ForbiddenError
  );
});

test('US-07 rejects a due date that is not in the future', async () => {
  const repository = { async create() { throw new Error('Must not create'); } };
  const { service } = createService({ repository });

  await assert.rejects(
    service.createAssignment({
      courseId: 3,
      instructorId: 8,
      title: 'Essay',
      dueDate: '2026-10-21T10:00:00.000Z'
    }),
    ValidationError
  );
});

test('US-07 soft-deletes assignments with submissions inside a transaction', async () => {
  const events = [];
  let hardDeleteCalls = 0;
  const repository = {
    async findById() {
      return { id: 11, courseId: 3 };
    },
    async countSubmissions(id, connection) {
      assert.equal(id, 11);
      assert.ok(connection);
      events.push('count');
      return 1;
    },
    async softDelete(id, connection) {
      assert.equal(id, 11);
      assert.ok(connection);
      events.push('soft-delete');
      return true;
    },
    async hardDelete() {
      hardDeleteCalls += 1;
    }
  };
  const { service } = createService({ repository, events });

  const result = await service.deleteAssignment(11, 8);

  assert.equal(result.softDeleted, true);
  assert.deepEqual(events, ['begin', 'count', 'soft-delete', 'commit', 'release']);
  assert.equal(hardDeleteCalls, 0);
});

test('US-07 HTTP endpoint creates only for the course owner', async (t) => {
  const events = [];
  const assignments = new Map();
  let nextId = 1;
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
    },
    async query(sql, params) {
      if (sql.includes('INSERT INTO `assignments`')) {
        const id = nextId++;
        assignments.set(id, {
          id,
          course_id: params[0],
          title: params[1],
          description: params[2],
          deadline: params[3],
          due_date: params[4],
          max_score: params[5],
          allow_late: params[6],
          allow_late_submission: params[7],
          status: params[8],
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null
        });
        events.push('insert');
        return [{ insertId: id }, []];
      }

      if (sql.includes('SELECT * FROM `assignments`')) {
        const row = assignments.get(Number(params[0]));
        events.push('select');
        return [row && row.deleted_at === null ? [row] : [], []];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  const originalGetPool = db.getPool;
  db.getPool = () => ({
    async getConnection() {
      return connection;
    }
  });
  t.after(() => {
    db.getPool = originalGetPool;
  });

  const courseAccess = {
    ...createCourseAccess(),
    async isOwner(courseId, instructorId) {
      return Number(courseId) === 3 && Number(instructorId) === 8;
    }
  };
  const notifications = createNotificationsFake();
  const notify = notifications.notifyCourseStudents.bind(notifications);
  notifications.notifyCourseStudents = async (...args) => {
    events.push('notify');
    return notify(...args);
  };
  registerPort('courseAccess', courseAccess);
  registerPort('notifications', notifications);

  const { createApp } = require('../../src/app');
  const app = createApp();
  const token = (id) =>
    jwt.sign({ id, role: 'GIANG_VIEN' }, config.JWT_SECRET, { expiresIn: '5m' });

  const created = await request(app)
    .post('/api/m2-assessment/courses/3/assignments')
    .set('Authorization', `Bearer ${token(8)}`)
    .send({
      title: 'Essay',
      due_date: '2099-10-22T10:00:00.000Z'
    });

  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, 'OPEN');
  assert.equal(created.body.data.max_score, 10);
  assert.ok(events.indexOf('commit') < events.indexOf('notify'));

  const denied = await request(app)
    .post('/api/m2-assessment/courses/3/assignments')
    .set('Authorization', `Bearer ${token(9)}`)
    .send({
      title: 'Forbidden essay',
      due_date: '2099-10-22T10:00:00.000Z'
    });

  assert.equal(denied.status, 403);
  assert.equal(notifications.sentNotifications.length, 1);
});
