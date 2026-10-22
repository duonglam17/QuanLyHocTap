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
      return state.schedules.filter((schedule) => schedule.courseId === Number(courseId));
    }
  };
  const courseAccess = {
    async getCourse(courseId) {
      return Number(courseId) === course.id ? course : null;
    },
    async isOwner(userId, courseId) {
      return Number(userId) === course.ownerId && Number(courseId) === course.id;
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

test('schedule routes require an authenticated instructor and validate create input', async () => {
  const calls = [];
  const schedule = { id: 10, courseId: 7, status: 'SCHEDULED' };
  const service = {
    async listForCourse(courseId, user) {
      calls.push(['list', courseId, user.id]);
      return [schedule];
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
  } finally {
    db.query = originalQuery;
  }
});
