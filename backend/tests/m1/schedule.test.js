const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const { ConflictError, ForbiddenError, ValidationError } = require('../../src/common/errors');
const ScheduleController = require('../../src/modules/m1-core/controllers/scheduleController');
const ScheduleRepository = require('../../src/modules/m1-core/repositories/scheduleRepository');
const { createScheduleRouter } = require('../../src/modules/m1-core/routes/scheduleRoutes');
const { ScheduleService } = require('../../src/modules/m1-core/services/scheduleService');

function createScheduleHarness({
  schedules = [],
  course = { id: 7, ownerId: 12, status: 'PUBLISHED' },
  notificationsAvailable = true
} = {}) {
  const state = {
    schedules: schedules.map((schedule) => ({ ...schedule })),
    events: [],
    notifications: [],
    transactionCount: 0,
    rollbacks: 0,
    nextId: schedules.reduce((maximum, schedule) => Math.max(maximum, schedule.id), 0) + 1
  };
  const repository = {
    async lockCourse(courseId) {
      return Number(courseId) === course.id ? { ...course } : null;
    },
    async findById(scheduleId) {
      return state.schedules.find((schedule) => schedule.id === Number(scheduleId)) || null;
    },
    async findConflict(courseId, date, startTime, endTime, { excludeId = null } = {}) {
      return state.schedules.some(
        (schedule) =>
          schedule.courseId === Number(courseId) &&
          schedule.id !== excludeId &&
          schedule.date === date &&
          schedule.status !== 'CANCELLED' &&
          schedule.startTime < endTime &&
          schedule.endTime > startTime
      );
    },
    async create(courseId, fields) {
      const schedule = {
        id: state.nextId++,
        courseId: Number(courseId),
        ...fields,
        status: 'SCHEDULED'
      };
      state.schedules.push(schedule);
      return schedule;
    },
    async update(scheduleId, courseId, fields) {
      const index = state.schedules.findIndex((schedule) => schedule.id === Number(scheduleId));
      state.schedules[index] = { ...state.schedules[index], ...fields, courseId };
      return state.schedules[index];
    },
    async setStatus(scheduleId, courseId, status) {
      const schedule = state.schedules.find((item) => item.id === Number(scheduleId));
      Object.assign(schedule, { courseId, status });
      return schedule;
    },
    async listByCourse(courseId) {
      return state.schedules.filter(
        (schedule) => schedule.courseId === Number(courseId) && schedule.status !== 'CANCELLED'
      );
    },
    async listForStudent(userId, pagination) {
      state.studentScheduleRequest = { userId, pagination };
      const items = state.schedules.filter(
        (schedule) =>
          schedule.studentIds?.includes(Number(userId)) && schedule.status !== 'CANCELLED'
      );
      const offset = (pagination.page - 1) * pagination.limit;
      return { items: items.slice(offset, offset + pagination.limit), total: items.length };
    }
  };
  const courseAccess = {
    async getCourse(courseId) {
      return Number(courseId) === course.id ? course : null;
    },
    async isOwner(userId, courseId) {
      return Number(userId) === course.ownerId && Number(courseId) === course.id;
    },
    async isEnrolled(userId, courseId) {
      return Number(userId) === 33 && Number(courseId) === course.id;
    }
  };
  const notifications = {
    async notifyCourseStudents(courseId, payload) {
      state.events.push('notification');
      state.notifications.push({ courseId, payload });
    }
  };
  const service = new ScheduleService({
    scheduleRepository: repository,
    getPortFn(name, options) {
      if (name === 'courseAccess') {
        return courseAccess;
      }
      assert.equal(name, 'notifications');
      assert.deepEqual(options, { optional: true });
      return notificationsAvailable ? notifications : null;
    },
    transactionRunner: async (work) => {
      state.transactionCount += 1;
      try {
        const result = await work({});
        state.events.push('commit');
        return result;
      } catch (error) {
        state.rollbacks += 1;
        throw error;
      }
    },
    logger: { error() {} }
  });
  return { state, service, repository };
}

const owner = { id: 12, role: 'GIANG_VIEN' };
const validSchedule = {
  title: 'Buổi 1',
  date: '2026-11-10',
  startTime: '08:00',
  endTime: '11:30',
  roomOrLink: 'Phòng B302'
};

test('US-17 creates a scheduled session and notifies students after commit', async () => {
  const { state, service } = createScheduleHarness();
  const schedule = await service.createSchedule(7, owner, {
    ...validSchedule,
    title: '<b>Buổi 1</b>'
  });

  assert.equal(schedule.status, 'SCHEDULED');
  assert.equal(schedule.title, 'Buổi 1');
  assert.equal(schedule.startTime, '08:00:00');
  assert.equal(schedule.endTime, '11:30:00');
  assert.deepEqual(state.events, ['commit', 'notification']);
  assert.equal(state.notifications[0].courseId, 7);
  assert.deepEqual(state.notifications[0].payload, {
    type: 'SCHEDULE_CHANGED',
    title: 'Lịch học được cập nhật',
    message: 'Một buổi học mới đã được thêm vào lịch.',
    refType: 'schedule',
    refId: schedule.id,
    link: '/courses/7/schedules'
  });
});

test('US-17 rejects invalid date/time and overlapping sessions without committing', async () => {
  const existing = {
    id: 4,
    courseId: 7,
    title: 'Existing',
    date: '2026-11-10',
    startTime: '08:00:00',
    endTime: '11:30:00',
    roomOrLink: 'B302',
    status: 'SCHEDULED'
  };
  const { state, service } = createScheduleHarness({ schedules: [existing] });

  await assert.rejects(
    service.createSchedule(7, owner, { ...validSchedule, date: '2026-02-30' }),
    ValidationError
  );
  await assert.rejects(
    service.createSchedule(7, owner, { ...validSchedule, startTime: '11:30', endTime: '11:30' }),
    ValidationError
  );
  await assert.rejects(
    service.createSchedule(7, owner, { ...validSchedule, startTime: '09:00', endTime: '12:00' }),
    (error) => error instanceof ConflictError && error.code === 'SCHEDULE_CONFLICT'
  );

  assert.equal(state.schedules.length, 1);
  assert.equal(state.transactionCount, 1);
  assert.equal(state.rollbacks, 1);
  assert.deepEqual(state.notifications, []);
});

test('US-17 permits adjacent sessions and reschedules while excluding itself from conflict checks', async () => {
  const existing = {
    id: 4,
    courseId: 7,
    title: 'Existing',
    date: '2026-11-10',
    startTime: '08:00:00',
    endTime: '11:30:00',
    roomOrLink: 'B302',
    status: 'SCHEDULED'
  };
  const { state, service } = createScheduleHarness({ schedules: [existing] });

  const adjacent = await service.createSchedule(7, owner, {
    ...validSchedule,
    startTime: '11:30',
    endTime: '12:30'
  });
  assert.equal(adjacent.status, 'SCHEDULED');

  const updated = await service.updateSchedule(4, owner, {
    date: '2026-11-11',
    startTime: '09:00',
    endTime: '10:00'
  });
  assert.equal(updated.status, 'RESCHEDULED');
  assert.equal(updated.date, '2026-11-11');
  assert.equal(state.notifications.length, 2);
});

test('US-17 rejects a reschedule that overlaps another active session', async () => {
  const schedules = [
    {
      id: 4,
      courseId: 7,
      title: 'One',
      date: '2026-11-10',
      startTime: '08:00:00',
      endTime: '09:00:00',
      roomOrLink: 'B302',
      status: 'SCHEDULED'
    },
    {
      id: 5,
      courseId: 7,
      title: 'Two',
      date: '2026-11-10',
      startTime: '10:00:00',
      endTime: '11:00:00',
      roomOrLink: 'B302',
      status: 'SCHEDULED'
    }
  ];
  const { state, service } = createScheduleHarness({ schedules });

  await assert.rejects(
    service.updateSchedule(4, owner, { startTime: '10:30', endTime: '11:30' }),
    (error) => error instanceof ConflictError && error.code === 'SCHEDULE_CONFLICT'
  );
  assert.equal(state.schedules[0].startTime, '08:00:00');
  assert.equal(state.rollbacks, 1);
  assert.deepEqual(state.notifications, []);
});

test('US-17 cancels without deleting and sends only one cancellation notice', async () => {
  const existing = {
    id: 4,
    courseId: 7,
    title: 'Existing',
    date: '2026-11-10',
    startTime: '08:00:00',
    endTime: '09:00:00',
    roomOrLink: 'B302',
    status: 'SCHEDULED'
  };
  const { state, service } = createScheduleHarness({ schedules: [existing] });

  const cancelled = await service.cancelSchedule(4, owner);
  const repeated = await service.cancelSchedule(4, owner);

  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(repeated.status, 'CANCELLED');
  assert.equal(state.schedules.length, 1);
  assert.equal(state.notifications.length, 1);
  assert.deepEqual(state.events, ['commit', 'notification', 'commit']);
});

test('US-17 enforces ownership and treats the notifications Port as optional', async () => {
  const { state, service } = createScheduleHarness({ notificationsAvailable: false });

  await assert.rejects(
    service.createSchedule(7, { id: 99, role: 'GIANG_VIEN' }, validSchedule),
    ForbiddenError
  );
  const schedule = await service.createSchedule(7, owner, validSchedule);

  assert.equal(schedule.status, 'SCHEDULED');
  assert.deepEqual(state.events, ['commit']);
  assert.deepEqual(state.notifications, []);
});

test('US-18 permits only the course owner or an enrolled student to view course schedules', async () => {
  const schedules = [
    { id: 4, courseId: 7, status: 'SCHEDULED' },
    { id: 5, courseId: 7, status: 'CANCELLED' }
  ];
  const { service } = createScheduleHarness({ schedules });

  assert.deepEqual(await service.listForCourse(7, owner), [schedules[0]]);
  assert.deepEqual(await service.listForCourse(7, { id: 33, role: 'SINH_VIEN' }), [schedules[0]]);
  await assert.rejects(service.listForCourse(7, { id: 34, role: 'SINH_VIEN' }), ForbiddenError);
  await assert.rejects(service.listForCourse(7, { id: 1, role: 'ADMIN' }), ForbiddenError);
});

test('US-18 aggregates a student timetable across enrolled courses with pagination', async () => {
  const schedules = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    courseId: index < 3 ? 7 : 8,
    studentIds: [33],
    status: 'SCHEDULED'
  }));
  const { state, service } = createScheduleHarness({ schedules });

  const result = await service.listStudentSchedule(
    { id: 33, role: 'SINH_VIEN' },
    { page: '2', limit: '2' }
  );

  assert.deepEqual(result, { items: schedules.slice(2, 4), total: 5, page: 2, limit: 2 });
  assert.deepEqual(state.studentScheduleRequest, { userId: 33, pagination: { page: 2, limit: 2 } });
  await assert.rejects(service.listStudentSchedule(owner), ForbiddenError);
  await assert.rejects(
    service.listStudentSchedule({ id: 33, role: 'SINH_VIEN' }, { page: 0, limit: 20 }),
    ValidationError
  );
  await assert.rejects(
    service.listStudentSchedule({ id: 33, role: 'SINH_VIEN' }, { page: 1, limit: 101 }),
    ValidationError
  );
  await assert.rejects(
    service.listStudentSchedule(
      { id: 33, role: 'SINH_VIEN' },
      { page: Number.MAX_SAFE_INTEGER, limit: 100 }
    ),
    ValidationError
  );
});

test('schedule repository locks the course row and uses a parameterized overlap query', async () => {
  const queries = [];
  const connection = {
    async query(sql, parameters) {
      queries.push({ sql, parameters });
      return [
        sql.includes('SELECT id\n       FROM schedules')
          ? []
          : [{ id: 7, ownerId: 12, status: 'PUBLISHED' }],
        []
      ];
    }
  };
  const repository = new ScheduleRepository();

  const course = await repository.lockCourse(7, connection);
  const conflict = await repository.findConflict(
    7,
    '2026-11-10',
    '09:00:00',
    '10:00:00',
    { excludeId: 4 },
    connection
  );

  assert.deepEqual(course, { id: 7, ownerId: 12, status: 'PUBLISHED' });
  assert.equal(conflict, false);
  assert.match(queries[0].sql, /FOR UPDATE/);
  assert.match(queries[1].sql, /status <> 'CANCELLED'/);
  assert.match(queries[1].sql, /start_time < \?/);
  assert.match(queries[1].sql, /end_time > \?/);
  assert.match(queries[1].sql, /AND id <> \?/);
  assert.deepEqual(queries[1].parameters, [7, '2026-11-10', '10:00:00', '09:00:00', 4]);
});

test('schedule repository pages the enrolled students schedule across courses', async () => {
  const queries = [];
  const repository = new ScheduleRepository({
    async query(sql, parameters) {
      queries.push({ sql, parameters });
      if (sql.includes('COUNT(*)')) {
        return [[{ total: 3 }], []];
      }
      return [
        [
          {
            id: 9,
            courseId: 8,
            courseCode: 'CS102',
            courseTitle: 'Second course',
            title: 'Lesson',
            date: '2026-11-11',
            startTime: '09:00:00',
            endTime: '10:00:00',
            roomOrLink: 'Room 2',
            status: 'SCHEDULED'
          }
        ],
        []
      ];
    }
  });

  const result = await repository.listForStudent(33, { page: 2, limit: 1 });

  assert.equal(result.total, 3);
  assert.equal(result.items[0].id, 9);
  assert.equal(result.items[0].courseId, 8);
  assert.equal(result.items[0].courseCode, 'CS102');
  assert.match(queries[0].sql, /JOIN enrollments e ON e\.course_id = s\.course_id/);
  assert.match(queries[1].sql, /e\.student_id = \?/);
  assert.match(queries[1].sql, /s\.status <> 'CANCELLED'/);
  assert.match(queries[1].sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(
    queries.map((query) => query.parameters),
    [[33], [33, 1, 1]]
  );
});

test('schedule routes require an authenticated instructor and validate create input', async () => {
  const calls = [];
  const schedule = { id: 10, courseId: 7, status: 'SCHEDULED' };
  const service = {
    async listForCourse(courseId, user) {
      calls.push(['list', courseId, user.id]);
      return [schedule];
    },
    async listStudentSchedule(user, pagination) {
      calls.push(['student-list', user.id, pagination]);
      return { items: [schedule], total: 1, page: pagination.page, limit: pagination.limit };
    },
    async createSchedule(courseId, user, input) {
      calls.push(['create', courseId, user.id, input]);
      return schedule;
    },
    async updateSchedule(scheduleId, user, input) {
      calls.push(['update', scheduleId, user.id, input]);
      return schedule;
    },
    async cancelSchedule(scheduleId, user) {
      calls.push(['cancel', scheduleId, user.id]);
      return schedule;
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createScheduleRouter({ scheduleController: new ScheduleController(service) }));
  app.use(errorHandler);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }], []];
  const instructorToken = jwt.sign(
    { user_id: 12, role: 'GIANG_VIEN', token_version: 1 },
    config.JWT_SECRET
  );
  const studentToken = jwt.sign(
    { user_id: 33, role: 'SINH_VIEN', token_version: 1 },
    config.JWT_SECRET
  );

  try {
    const unauthorized = await request(app).get('/api/courses/7/schedules');
    assert.equal(unauthorized.status, 401);

    const forbidden = await request(app)
      .post('/api/courses/7/schedules')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(validSchedule);
    assert.equal(forbidden.status, 403);

    const invalid = await request(app)
      .post('/api/courses/7/schedules')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ ...validSchedule, startTime: '25:00' });
    assert.equal(invalid.status, 422);

    const created = await request(app)
      .post('/api/courses/7/schedules')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send(validSchedule);
    assert.equal(created.status, 201);
    assert.deepEqual(calls[0], ['create', '7', 12, validSchedule]);

    const studentSchedule = await request(app)
      .get('/api/me/schedule?page=2&limit=5')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(studentSchedule.status, 200);
    assert.deepEqual(studentSchedule.body, {
      items: [schedule],
      total: 1,
      page: 2,
      limit: 5
    });
    assert.deepEqual(calls[1], ['student-list', 33, { page: 2, limit: 5 }]);

    const courseSchedule = await request(app)
      .get('/api/courses/7/schedules')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(courseSchedule.status, 200);
    assert.deepEqual(courseSchedule.body, { schedules: [schedule] });
    assert.deepEqual(calls[2], ['list', '7', 33]);

    const invalidPagination = await request(app)
      .get('/api/me/schedule?page=0')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(invalidPagination.status, 422);
  } finally {
    db.query = originalQuery;
  }
});
