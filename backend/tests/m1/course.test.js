const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const {
  createCourseAccessPort
} = require('../../src/modules/m1-core/services/courseAccessService');
const CourseController = require('../../src/modules/m1-core/controllers/courseController');
const EnrollmentController = require('../../src/modules/m1-core/controllers/enrollmentController');
const CourseService = require('../../src/modules/m1-core/services/courseService');
const { createCourseRouter } = require('../../src/modules/m1-core/routes/courseRoutes');
const { createCourseAccessFake } = require('../../src/contracts/fakes');
const { createRegistry } = require('../../src/contracts');

function createCourseHarness({
  courses = [],
  courseData = false,
  assessmentData = false,
  quizData = false,
  registeredPorts = true,
  keyGenerator = () => 'ABC123'
} = {}) {
  const state = {
    courses: new Map(courses.map((course) => [Number(course.id), { ...course }])),
    enrollments: new Map(),
    deletedAt: new Map(),
    nextCourseId: courses.reduce((max, course) => Math.max(max, Number(course.id)), 0) + 1
  };
  const repository = {
    async findById(id) {
      const course = state.courses.get(Number(id));
      return course && !state.deletedAt.has(Number(id)) ? { ...course } : null;
    },
    async findForUser() {
      return [...state.courses.values()].map((course) => ({ ...course }));
    },
    async create(course) {
      if (
        [...state.courses.values()].some(
          (existing) => existing.enrollment_key === course.enrollmentKey
        )
      ) {
        const error = new Error('Duplicate enrollment key');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      const created = {
        id: state.nextCourseId++,
        code: course.code,
        title: course.title,
        description: course.description,
        semester: course.semester,
        ownerId: course.ownerId,
        enrollment_key: course.enrollmentKey,
        status: 'DRAFT'
      };
      state.courses.set(created.id, created);
      return { ...created };
    },
    async update(id, fields) {
      const course = state.courses.get(Number(id));
      Object.assign(course, fields);
      if (fields.enrollmentKey) {
        course.enrollment_key = fields.enrollmentKey;
      }
      return { ...course };
    },
    async updateStatus(id, status) {
      const course = state.courses.get(Number(id));
      course.status = status;
      return { ...course };
    },
    async softDelete(id, deletedAt) {
      state.deletedAt.set(Number(id), deletedAt);
      return true;
    },
    async hasM1CourseData() {
      return courseData || state.enrollments.size > 0;
    },
    async isOwner(userId, courseId) {
      return Number(state.courses.get(Number(courseId))?.ownerId) === Number(userId);
    },
    async isEnrolled(userId, courseId) {
      return state.enrollments.has(`${courseId}:${userId}`);
    },
    async getEnrolledStudentIds(courseId) {
      return [...state.enrollments.values()]
        .filter((enrollment) => enrollment.courseId === Number(courseId))
        .map((enrollment) => enrollment.studentId);
    },
    async listEnrolledStudents() {
      return { items: [], total: 0 };
    },
    async getUsersBrief() {
      return [];
    },
    async getLessonSummary() {
      return null;
    }
  };
  const enrollmentRepository = {
    async findPublishedCourseByKey(key) {
      return (
        [...state.courses.values()].find(
          (course) =>
            course.enrollment_key === key &&
            course.status === 'PUBLISHED' &&
            !state.deletedAt.has(Number(course.id))
        ) || null
      );
    },
    async findEnrollment(courseId, studentId) {
      return state.enrollments.get(`${courseId}:${studentId}`) || null;
    },
    async create(courseId, studentId) {
      const enrollment = {
        id: state.enrollments.size + 1,
        courseId: Number(courseId),
        studentId: Number(studentId)
      };
      state.enrollments.set(`${courseId}:${studentId}`, enrollment);
      return enrollment;
    },
    async delete(courseId, studentId) {
      return state.enrollments.delete(`${courseId}:${studentId}`);
    }
  };
  const ports = {
    assessmentUsage: {
      async hasCourseData() {
        return assessmentData;
      },
      async hasUserData() {
        return false;
      }
    },
    quizUsage: {
      async hasCourseData() {
        return quizData;
      },
      async hasUserData() {
        return false;
      }
    }
  };
  const requestedPorts = [];
  const service = new CourseService({
    courseRepository: repository,
    enrollmentRepository,
    keyGenerator,
    clock: { now: () => new Date('2026-10-22T00:00:00.000Z') },
    transactionRunner: async (work) => work({}),
    getPortFn(name, options) {
      requestedPorts.push({ name, options });
      return registeredPorts ? ports[name] : null;
    }
  });
  return { state, repository, service, requestedPorts, ports };
}

test('US-03 creates a draft course with a unique six-character key and sanitizes text', async () => {
  const { state, service } = createCourseHarness();
  const course = await service.createCourse(12, {
    code: 'INT3101',
    title: '<script>Bad()</script>Web nâng cao',
    description: '<b>Course description</b>',
    semester: 'HK1-2026'
  });

  assert.equal(course.status, 'DRAFT');
  assert.equal(course.ownerId, 12);
  assert.equal(course.enrollment_key, 'ABC123');
  assert.equal(course.title, 'Web nâng cao');
  assert.equal(course.description, 'Course description');
  assert.equal(state.courses.size, 1);
});

test('US-03 rejects missing course fields and duplicate custom enrollment keys', async () => {
  const { service } = createCourseHarness({
    courses: [
      {
        id: 7,
        ownerId: 12,
        code: 'CS101',
        title: 'Existing',
        semester: 'HK1',
        enrollment_key: 'WEB2026',
        status: 'DRAFT'
      }
    ]
  });

  await assert.rejects(
    service.createCourse(12, { code: 'CS101', title: ' ', semester: 'HK1' }),
    (error) => error.statusCode === 422
  );
  await assert.rejects(
    service.createCourse(12, {
      code: 'CS102',
      title: '<script>not a title</script>',
      semester: 'HK1'
    }),
    (error) => error.statusCode === 422
  );
  await assert.rejects(
    service.createCourse(12, {
      code: 'CS102',
      title: 'New',
      semester: 'HK1',
      enrollmentKey: 'WEB2026'
    }),
    (error) => error.statusCode === 409 && error.code === 'ENROLLMENT_KEY_EXISTS'
  );
});

test('US-03 retries generated keys after a unique-key collision', async () => {
  const first = 'ABC123';
  let attempts = 0;
  const { service } = createCourseHarness({
    courses: [
      {
        id: 7,
        ownerId: 12,
        code: 'CS101',
        title: 'Existing',
        semester: 'HK1',
        enrollment_key: first,
        status: 'DRAFT'
      }
    ],
    keyGenerator() {
      attempts += 1;
      return attempts === 1 ? first : 'DEF456';
    }
  });
  const created = await service.createCourse(12, {
    code: 'CS102',
    title: 'New',
    semester: 'HK1'
  });

  assert.equal(attempts, 2);
  assert.equal(created.enrollment_key, 'DEF456');
});

test('US-03 restricts course edits to the owner and publishes owner courses', async () => {
  const { service } = createCourseHarness({
    courses: [
      {
        id: 7,
        ownerId: 12,
        code: 'CS101',
        title: 'Existing',
        semester: 'HK1',
        enrollment_key: 'WEB2026',
        status: 'DRAFT'
      }
    ]
  });

  await assert.rejects(
    service.updateCourse(7, 22, { title: 'Changed' }),
    (error) => error.statusCode === 403
  );
  const updated = await service.updateCourse(7, 12, { title: 'Changed' });
  assert.equal(updated.title, 'Changed');
  const published = await service.publishCourse(7, 12);
  assert.equal(published.status, 'PUBLISHED');
});

test('US-03 archives courses with M1 or module data and soft-deletes only when all checks are clear', async () => {
  const courses = [
    {
      id: 7,
      ownerId: 12,
      code: 'CS101',
      title: 'Has external work',
      semester: 'HK1',
      enrollment_key: 'WEB2026',
      status: 'PUBLISHED'
    },
    {
      id: 8,
      ownerId: 12,
      code: 'CS102',
      title: 'No work',
      semester: 'HK1',
      enrollment_key: 'WEB2027',
      status: 'DRAFT'
    }
  ];
  const { service, state, requestedPorts } = createCourseHarness({
    courses,
    assessmentData: true
  });
  const archived = await service.deleteCourse(7, 12);
  assert.deepEqual(archived, { courseId: 7, status: 'ARCHIVED', archived: true });
  assert.equal(state.courses.get(7).status, 'ARCHIVED');
  assert.equal(state.deletedAt.has(7), false);
  assert.deepEqual(requestedPorts.slice(0, 2), [
    { name: 'assessmentUsage', options: { optional: true } },
    { name: 'quizUsage', options: { optional: true } }
  ]);

  const noDataHarness = createCourseHarness({ courses: [courses[1]] });
  const deleted = await noDataHarness.service.deleteCourse(8, 12);
  assert.equal(deleted.deleted, true);
  assert.equal(noDataHarness.state.deletedAt.get(8).toISOString(), '2026-10-22T00:00:00.000Z');

  const missingPortsHarness = createCourseHarness({
    courses: [courses[1]],
    registeredPorts: false
  });
  const safeArchive = await missingPortsHarness.service.deleteCourse(8, 12);
  assert.equal(safeArchive.status, 'ARCHIVED');
});

test('US-03 archive endpoint is idempotent and archived courses cannot be edited', async () => {
  const { service, state } = createCourseHarness({
    courses: [
      {
        id: 7,
        ownerId: 12,
        code: 'CS101',
        title: 'Course',
        semester: 'HK1',
        enrollment_key: 'WEB2026',
        status: 'PUBLISHED'
      }
    ]
  });

  const archived = await service.archiveCourse(7, { id: 12, role: 'GIANG_VIEN' });
  assert.equal(archived.status, 'ARCHIVED');
  assert.equal((await service.archiveCourse(7, { id: 12, role: 'GIANG_VIEN' })).status, 'ARCHIVED');
  await assert.rejects(
    service.updateCourse(7, 12, { title: 'Changed' }),
    (error) => error.statusCode === 409 && error.code === 'COURSE_ARCHIVED'
  );
  assert.equal(state.courses.get(7).status, 'ARCHIVED');
});

test('US-04 enrolls only into a published case-sensitive key and rejects duplicate enrollment', async () => {
  const { service, state } = createCourseHarness({
    courses: [
      {
        id: 7,
        ownerId: 12,
        code: 'CS101',
        title: 'Published',
        semester: 'HK1',
        enrollment_key: 'WEB2026',
        status: 'PUBLISHED'
      },
      {
        id: 8,
        ownerId: 12,
        code: 'CS102',
        title: 'Draft',
        semester: 'HK1',
        enrollment_key: 'DRAFT01',
        status: 'DRAFT'
      }
    ]
  });

  const result = await service.enrollByCode(33, 'WEB2026');
  assert.deepEqual(result.course, { id: 7, title: 'Published' });
  assert.equal(state.enrollments.has('7:33'), true);
  await assert.rejects(
    service.enrollByCode(33, 'WEB2026'),
    (error) => error.statusCode === 409 && error.code === 'ALREADY_ENROLLED'
  );
  await assert.rejects(service.enrollByCode(34, 'web2026'), (error) => error.statusCode === 404);
  await assert.rejects(service.enrollByCode(34, 'DRAFT01'), (error) => error.statusCode === 404);
  await assert.rejects(service.enrollByCode(34, ''), (error) => error.statusCode === 400);
});

test('US-04 only permits unenrollment when both optional usage Ports confirm no quiz or assessment data', async () => {
  const { service, state, ports } = createCourseHarness({
    courses: [
      {
        id: 7,
        ownerId: 12,
        code: 'CS101',
        title: 'Course',
        semester: 'HK1',
        enrollment_key: 'WEB2026',
        status: 'PUBLISHED'
      }
    ]
  });
  await service.enrollByCode(33, 'WEB2026');

  await service.removeEnrollment(7, 33, { id: 12, role: 'GIANG_VIEN' });
  assert.equal(state.enrollments.size, 0);

  await service.enrollByCode(33, 'WEB2026');
  ports.quizUsage = {
    hasCourseData: async () => false,
    hasUserData: async () => true
  };
  await assert.rejects(
    service.removeEnrollment(7, 33, { id: 12, role: 'GIANG_VIEN' }),
    (error) => error.statusCode === 409 && error.code === 'STUDENT_HAS_COURSEWORK'
  );

  delete ports.assessmentUsage;
  await assert.rejects(
    service.removeEnrollment(7, 33, { id: 12, role: 'GIANG_VIEN' }),
    (error) => error.statusCode === 409 && error.code === 'STUDENT_HAS_COURSEWORK'
  );
  assert.equal(state.enrollments.size, 1);
});

test('courseAccess adapter returns contract-shaped data for its operations', async () => {
  const repository = {
    async findById(id) {
      if (id === 99) {
        return null;
      }
      if (id === 55) {
        return { id: 55, ownerId: 12, title: 'Course', status: 'ARCHIVED' };
      }
      return { id: 7, ownerId: 12, title: 'Course', status: 'PUBLISHED' };
    },
    async isOwner(userId, courseId) {
      return userId === 12 && courseId === 7;
    },
    async isEnrolled(userId, courseId) {
      return userId === 33 && courseId === 7;
    },
    async getEnrolledStudentIds() {
      return [33];
    },
    async listEnrolledStudents() {
      return { items: [{ id: 33, username: 'student', fullName: 'Test Student' }], total: 1 };
    },
    async getUsersBrief() {
      return [{ id: 33, username: 'student', fullName: 'Test Student', role: 'SINH_VIEN' }];
    },
    async getLessonSummary() {
      return { id: 4, courseId: 7 };
    }
  };
  const port = createCourseAccessPort(repository);

  assert.deepEqual(await port.getCourse(7), {
    id: 7,
    ownerId: 12,
    title: 'Course',
    status: 'PUBLISHED'
  });
  const fake = createCourseAccessFake({
    courses: [{ id: 7, ownerId: 12, title: 'Course', status: 'PUBLISHED' }],
    enrolledStudentIds: [33],
    enrolledStudents: [{ id: 33, username: 'student', fullName: 'Test Student' }],
    users: [{ id: 33, username: 'student', fullName: 'Test Student', role: 'SINH_VIEN' }],
    lessonSummary: { courseId: 7 }
  });
  assert.deepEqual(await port.getCourse(7), await fake.getCourse(7));
  assert.equal(await port.isOwner(12, 7), await fake.isOwner(12, 7));
  assert.equal(await port.isEnrolled(33, 7), await fake.isEnrolled(33, 7));
  assert.deepEqual(await port.listEnrolledStudents(7, { page: 1, limit: 20 }), {
    items: [{ id: 33, username: 'student', fullName: 'Test Student' }],
    total: 1
  });
  assert.deepEqual(await port.getUsersBrief([33]), await fake.getUsersBrief([33]));
  assert.deepEqual(await port.getLessonSummary(4), await fake.getLessonSummary(4));
  assert.equal(await port.getCourse(99), null);
  assert.equal(await port.isOwner(12, 7), true);
  assert.equal(await port.isEnrolled(33, 7), true);
  await assert.rejects(port.assertCourseWritable(55), (error) => error.code === 'COURSE_ARCHIVED');
  assert.deepEqual(await port.getEnrolledStudentIds(7), [33]);
  assert.deepEqual(await port.listEnrolledStudents(7, { page: 1, limit: 20 }), {
    items: [{ id: 33, username: 'student', fullName: 'Test Student' }],
    total: 1
  });
  assert.deepEqual(await port.getUsersBrief([33]), [
    { id: 33, username: 'student', fullName: 'Test Student', role: 'SINH_VIEN' }
  ]);
  assert.deepEqual(await port.getLessonSummary(4), { id: 4, courseId: 7 });
});

test('M1 init registers its real courseAccess Port with the loader registry', async () => {
  const m1 = require('../../src/modules/m1-core');
  const registry = createRegistry();
  const originalQuery = db.query;
  db.query = async (sql) => {
    if (sql.includes('FROM courses') && sql.includes('WHERE id = ?')) {
      return [[{ id: 7, ownerId: 12, title: 'Course', status: 'PUBLISHED' }], []];
    }
    throw new Error(`Unexpected courseAccess query: ${sql}`);
  };

  try {
    m1.init({ contracts: registry });
    const port = registry.getPort('courseAccess');
    assert.deepEqual(await port.getCourse(7), {
      id: 7,
      ownerId: 12,
      title: 'Course',
      status: 'PUBLISHED'
    });
  } finally {
    db.query = originalQuery;
  }
});

test('course routes enforce authentication and role access', async () => {
  const service = {
    async listCourses() {
      return [];
    },
    async createCourse(userId) {
      return { id: 7, ownerId: userId, status: 'DRAFT' };
    },
    async enrollByCode(studentId, key) {
      return { course: { id: key === 'WEB2026' ? 7 : 0 }, studentId };
    }
  };
  const app = express();
  app.use(express.json());
  const courseController = new CourseController(service);
  const enrollmentController = new EnrollmentController(service);
  app.use('/api/courses', createCourseRouter({ courseController, enrollmentController }));
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
    const created = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ code: 'CS101', title: 'Course', semester: 'HK1' });
    assert.equal(created.status, 201);

    const forbiddenCreate = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ code: 'CS101', title: 'Course', semester: 'HK1' });
    assert.equal(forbiddenCreate.status, 403);

    for (let requestNumber = 0; requestNumber < 5; requestNumber += 1) {
      const enrolled = await request(app)
        .post('/api/courses/enroll')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ enrollment_key: 'WEB2026' });
      assert.equal(enrolled.status, 201);
      assert.equal(enrolled.body.courseId, 7);
    }
    const rateLimited = await request(app)
      .post('/api/courses/enroll')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ enrollment_key: 'WEB2026' });
    assert.equal(rateLimited.status, 429);
  } finally {
    db.query = originalQuery;
  }
});
