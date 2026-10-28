const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const { ForbiddenError, NotFoundError, ValidationError } = require('../../src/common/errors');
const { createCourseAccessFake, createNotificationsFake } = require('../../src/contracts/fakes');
const { registerPort } = require('../../src/contracts');
const { router: assignmentRouter } = require('../../src/modules/m2-assessment/routes/assignmentRoutes');
const AssignmentController = require('../../src/modules/m2-assessment/controllers/assignmentController');
const AssignmentService = require('../../src/modules/m2-assessment/services/assignmentService');

function createCourseAccess({ owner = true, writable = true, enrolled = true } = {}) {
  return {
    ...createCourseAccessFake({ courseOwner: { isOwner: owner } }),
    async getCourse(courseId) {
      return { id: courseId, ownerId: 8, title: 'Course', status: 'PUBLISHED' };
    },
    async isOwner(userId, courseId) {
      if (Number(userId) === 8 && Number(courseId) === 3) {
        return owner;
      }
      return false;
    },
    async isEnrolled(_userId, _courseId) {
      return enrolled;
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
  assert.equal(persisted.createdBy, 8);
  assert.equal(persisted.maxScore, 10);
  assert.equal(persisted.allowLateSubmission, true);
  assert.equal(persisted.status, 'OPEN');
  assert.equal(result.id, 11);
  assert.deepEqual(events, ['begin', 'create', 'commit', 'release', 'notify']);
  assert.equal(notifications.sentNotifications.length, 1);
  assert.deepEqual(notifications.sentNotifications[0], {
    courseId: 3,
    payload: {
      type: 'NEW_ASSIGNMENT',
      title: 'Bài tập mới: Essay',
      message: 'Giảng viên đã giao bài tập mới "Essay" với hạn nộp là 2026-10-22T10:00:00.000Z.',
      refType: 'ASSIGNMENT',
      refId: 11,
      link: '/courses/3/assignments/11'
    }
  });
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

test('US-07 allows the course owner to update and sanitize assignment fields', async () => {
  const events = [];
  let assignment = {
    id: 11,
    courseId: 3,
    title: 'Essay',
    description: 'Original',
    dueDate: new Date('2026-10-22T10:00:00.000Z'),
    maxScore: 10,
    allowLateSubmission: false
  };
  const repository = {
    async findById(id) {
      assert.equal(id, 11);
      events.push('find');
      return assignment;
    },
    async update(id, changes, connection) {
      assert.equal(id, 11);
      assert.ok(connection);
      events.push('update');
      assignment = { ...assignment, ...changes };
      return true;
    }
  };
  const { service } = createService({ repository, events });

  const result = await service.updateAssignment(11, 8, {
    title: '<script>alert(1)</script>Updated',
    description: 'Updated <script>alert(1)</script> description',
    dueDate: '2026-10-23T10:00:00.000Z',
    maxScore: 8,
    allowLateSubmission: true
  });

  assert.equal(result.title, 'Updated');
  assert.equal(result.description, 'Updated  description');
  assert.equal(result.dueDate.toISOString(), '2026-10-23T10:00:00.000Z');
  assert.equal(result.maxScore, 8);
  assert.equal(result.allowLateSubmission, true);
  assert.deepEqual(events, ['find', 'begin', 'update', 'find', 'commit', 'release']);
});

test('US-07 prevents a non-owner from updating an assignment', async () => {
  let updateCalls = 0;
  const repository = {
    async findById() {
      return { id: 11, courseId: 3, title: 'Essay' };
    },
    async update() {
      updateCalls += 1;
    }
  };
  const { service } = createService({ repository, owner: false });

  await assert.rejects(
    service.updateAssignment(11, 8, { title: 'Unauthorized update' }),
    ForbiddenError
  );
  assert.equal(updateCalls, 0);
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
          created_by: params[1],
          title: params[2],
          description: params[3],
          deadline: params[4],
          due_date: params[5],
          max_score: params[6],
          allow_late: params[7],
          allow_late_submission: params[8],
          status: params[9],
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
  const originalQuery = db.query;
  db.getPool = () => ({
    async getConnection() {
      return connection;
    }
  });
  t.after(() => {
    db.getPool = originalGetPool;
    db.query = originalQuery;
  });
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];

  const courseAccess = {
    ...createCourseAccess(),
    async getCourse(courseId) {
      return { id: courseId, ownerId: 8, title: 'Course', status: 'PUBLISHED' };
    },
    async isOwner(instructorId, courseId) {
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

  const app = express();
  app.use(express.json());
  app.use('/api', assignmentRouter);
  app.use(errorHandler);
  const token = (id) =>
    jwt.sign({ id, role: 'GIANG_VIEN', token_version: 0 }, config.JWT_SECRET, {
      expiresIn: '5m'
    });

  const created = await request(app)
    .post('/api/courses/3/assignments')
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
    .post('/api/courses/3/assignments')
    .set('Authorization', `Bearer ${token(9)}`)
    .send({
      title: 'Forbidden essay',
      due_date: '2099-10-22T10:00:00.000Z'
    });

  assert.equal(denied.status, 403);
  assert.equal(notifications.sentNotifications.length, 1);
});

test('US-07 HTTP endpoint returns 401 without auth, 403 for wrong role, and 422 for invalid input', async (t) => {
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 0 }], []];
  t.after(() => {
    db.query = originalQuery;
  });

  const app = express();
  app.use(express.json());
  app.use('/api', assignmentRouter);
  app.use(errorHandler);
  const token = (id, role) =>
    jwt.sign({ id, role, token_version: 0 }, config.JWT_SECRET, { expiresIn: '5m' });

  const unauthenticated = await request(app)
    .post('/api/courses/3/assignments')
    .send({ title: 'Essay', due_date: '2099-10-22T10:00:00.000Z' });
  assert.equal(unauthenticated.status, 401);

  const wrongRole = await request(app)
    .post('/api/courses/3/assignments')
    .set('Authorization', `Bearer ${token(5, 'SINH_VIEN')}`)
    .send({ title: 'Essay', due_date: '2099-10-22T10:00:00.000Z' });
  assert.equal(wrongRole.status, 403);

  const invalidInput = await request(app)
    .post('/api/courses/3/assignments')
    .set('Authorization', `Bearer ${token(8, 'GIANG_VIEN')}`)
    .send({ title: '', due_date: '2099-10-22T10:00:00.000Z' });
  assert.equal(invalidInput.status, 422);
  assert.equal(invalidInput.body.details[0].field, 'title');
});

test('US-07 getAssignmentById checks roles and course enrollment', async () => {
  const assignment = { id: 11, courseId: 3, title: 'Essay', dueDate: new Date() };
  const repository = {
    async findById(id) {
      return id === 11 ? assignment : null;
    }
  };
  const { service } = createService({ repository });

  // 1. Missing assignment throws NotFoundError
  await assert.rejects(
    service.getAssignmentById(999, { id: 8, role: 'GIANG_VIEN' }),
    NotFoundError
  );

  // 2. ADMIN can access directly
  const adminResult = await service.getAssignmentById(11, { id: 1, role: 'ADMIN' });
  assert.equal(adminResult.id, 11);

  // 3. Enrolled student can access
  const studentResult = await service.getAssignmentById(11, { id: 15, role: 'SINH_VIEN' });
  assert.equal(studentResult.id, 11);

  // 4. Non-enrolled student is denied
  const notEnrolledService = createService({
    repository,
    events: [],
    owner: true,
    writable: true,
    ports: true
  }).service;
  // Override courseAccess to report not enrolled
  notEnrolledService.getPort = (name) => {
    if (name === 'courseAccess') {
      return {
        async getCourse() { return { id: 3, ownerId: 8 }; },
        async isOwner() { return false; },
        async isEnrolled() { return false; },
        async assertCourseWritable() {}
      };
    }
    return null;
  };
  await assert.rejects(
    notEnrolledService.getAssignmentById(11, { id: 99, role: 'SINH_VIEN' }),
    ForbiddenError
  );

  // 5. Unknown role is denied
  await assert.rejects(
    service.getAssignmentById(11, { id: 15, role: 'UNKNOWN' }),
    ForbiddenError
  );
});

test('US-07 getAssignmentsByCourseId validates course ID and membership', async () => {
  const assignments = [{ id: 11, courseId: 3, title: 'Essay' }];
  const repository = {
    async findByCourseId(courseId) {
      return Number(courseId) === 3 ? assignments : [];
    }
  };
  const { service } = createService({ repository });

  // 1. Invalid course ID
  await assert.rejects(
    service.getAssignmentsByCourseId('invalid', { id: 8, role: 'GIANG_VIEN' }),
    ValidationError
  );
  await assert.rejects(
    service.getAssignmentsByCourseId(-1, { id: 8, role: 'GIANG_VIEN' }),
    ValidationError
  );

  // 2. Valid course owner can get list
  const ownerList = await service.getAssignmentsByCourseId(3, { id: 8, role: 'GIANG_VIEN' });
  assert.equal(ownerList.length, 1);

  // 3. Non-member is rejected
  const nonMemberService = createService({ repository }).service;
  nonMemberService.getPort = (name) => {
    if (name === 'courseAccess') {
      return {
        async getCourse() { return { id: 3, ownerId: 8 }; },
        async isOwner() { return false; },
        async isEnrolled() { return false; },
        async assertCourseWritable() {}
      };
    }
    return null;
  };
  await assert.rejects(
    nonMemberService.getAssignmentsByCourseId(3, { id: 99, role: 'GIANG_VIEN' }),
    ForbiddenError
  );
});

test('US-07 updateAssignment validates fields and boundaries', async () => {
  const assignment = {
    id: 11,
    courseId: 3,
    title: 'Essay',
    description: 'Desc',
    dueDate: new Date('2026-10-22T10:00:00.000Z'),
    maxScore: 10,
    allowLateSubmission: false
  };
  const repository = {
    async findById() { return assignment; },
    async update() { return true; }
  };
  const { service } = createService({ repository });

  // Empty title
  await assert.rejects(
    service.updateAssignment(11, 8, { title: '   ' }),
    ValidationError
  );
  // Title too long
  await assert.rejects(
    service.updateAssignment(11, 8, { title: 'a'.repeat(201) }),
    ValidationError
  );
  // Invalid due date
  await assert.rejects(
    service.updateAssignment(11, 8, { dueDate: 'not-a-date' }),
    ValidationError
  );
  // Past due date
  await assert.rejects(
    service.updateAssignment(11, 8, { dueDate: '2020-01-01T00:00:00.000Z' }),
    ValidationError
  );
  // Invalid maxScore
  await assert.rejects(
    service.updateAssignment(11, 8, { maxScore: 0 }),
    ValidationError
  );
  await assert.rejects(
    service.updateAssignment(11, 8, { maxScore: 15 }),
    ValidationError
  );
  // Invalid allowLateSubmission
  await assert.rejects(
    service.updateAssignment(11, 8, { allowLateSubmission: 'yes' }),
    ValidationError
  );
  // Empty changes
  await assert.rejects(
    service.updateAssignment(11, 8, {}),
    ValidationError
  );
});

test('US-07 deleteAssignment returns proper status when deleted without submissions', async () => {
  const events = [];
  const repository = {
    async findById() { return { id: 11, courseId: 3 }; },
    async countSubmissions() { return 0; },
    async softDelete(id) { events.push(`softDelete-${id}`); return true; }
  };
  const { service } = createService({ repository, events });

  const result = await service.deleteAssignment(11, 8);
  assert.equal(result.deleted, true);
  assert.equal(result.softDeleted, true);
  assert.equal(result.message, 'Đã xóa bài tập thành công.');
  assert.deepEqual(events, ['begin', 'softDelete-11', 'commit', 'release']);
});

test('US-07 AssignmentController handles course assignments, detail, update, and delete HTTP routes', async () => {
  const assignment = {
    id: 11,
    courseId: 3,
    title: 'Essay',
    description: 'Desc',
    dueDate: new Date('2026-10-22T10:00:00.000Z'),
    maxScore: 10,
    allowLateSubmission: false,
    toJSON() {
      return { id: 11, courseId: 3, title: this.title };
    }
  };
  const mockService = {
    async getAssignmentsByCourseId(courseId) {
      assert.equal(Number(courseId), 3);
      return [assignment];
    },
    async getAssignmentById(id) {
      assert.equal(Number(id), 11);
      return assignment;
    },
    async updateAssignment(id, instructorId, changes) {
      assert.equal(Number(id), 11);
      return { ...assignment, ...changes };
    },
    async deleteAssignment(id) {
      assert.equal(Number(id), 11);
      return { id: 11, deleted: true, message: 'Đã xóa' };
    }
  };

  const controller = new AssignmentController(mockService);
  const app = express();
  app.use(express.json());
  app.get('/api/courses/:courseId/assignments', (req, res, next) => {
    req.user = { id: 8, role: 'GIANG_VIEN' };
    controller.getCourseAssignments(req, res, next);
  });
  app.get('/api/assignments/:id', (req, res, next) => {
    req.user = { id: 8, role: 'GIANG_VIEN' };
    controller.getAssignmentDetail(req, res, next);
  });
  app.patch('/api/assignments/:id', (req, res, next) => {
    req.user = { id: 8, role: 'GIANG_VIEN' };
    controller.updateAssignment(req, res, next);
  });
  app.delete('/api/assignments/:id', (req, res, next) => {
    req.user = { id: 8, role: 'GIANG_VIEN' };
    controller.deleteAssignment(req, res, next);
  });
  app.use(errorHandler);

  // 1. GET course assignments
  const listRes = await request(app).get('/api/courses/3/assignments');
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.count, 1);
  assert.equal(listRes.body.data[0].id, 11);

  // 2. GET detail
  const detailRes = await request(app).get('/api/assignments/11');
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.body.data.id, 11);

  // 3. PATCH assignment
  const patchRes = await request(app)
    .patch('/api/assignments/11')
    .send({ title: 'Updated Title', max_score: 9.5 });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.success, true);

  // 4. DELETE assignment
  const deleteRes = await request(app).delete('/api/assignments/11');
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.data.deleted, true);
});
