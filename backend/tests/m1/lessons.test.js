const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const LessonController = require('../../src/modules/m1-core/controllers/lessonController');
const CourseRepository = require('../../src/modules/m1-core/repositories/courseRepository');
const { createLessonRouter } = require('../../src/modules/m1-core/routes/lessonRoutes');
const {
  createCourseAccessPort
} = require('../../src/modules/m1-core/services/courseAccessService');
const {
  ALLOWED_EXTENSIONS,
  MAX_MATERIAL_BYTES,
  LessonService
} = require('../../src/modules/m1-core/services/lessonService');

function createLessonHarness({
  course = { id: 7, ownerId: 12, title: 'Course', status: 'PUBLISHED' },
  enrolled = true,
  materialCreateError = null,
  deleteErrors = []
} = {}) {
  const state = {
    lessons: [{ id: 5, courseId: 7, ownerId: 12, courseStatus: course.status, title: 'Lesson' }],
    materials: [],
    storageOptions: null,
    opened: [],
    deleted: [],
    lessonSummaryRequests: [],
    scheduled: null,
    schedulerOptions: null,
    callbacks: []
  };
  const lessonRepository = {
    async create(courseId, lesson) {
      const created = { id: 6, courseId, ...lesson };
      state.lessons.push(created);
      return created;
    },
    async findById(lessonId) {
      return state.lessons.find((lesson) => lesson.id === Number(lessonId)) || null;
    },
    async listByCourse(courseId) {
      return state.lessons.filter((lesson) => lesson.courseId === Number(courseId));
    }
  };
  const materialRepository = {
    async create(lessonId, material) {
      if (materialCreateError) {
        throw materialCreateError;
      }
      const created = { id: 9, lessonId, uploadedAt: new Date(), ...material };
      state.materials.push(created);
      return created;
    },
    async findById(materialId) {
      return state.materials.find((material) => material.id === Number(materialId)) || null;
    },
    async findForDownload(courseId, materialId) {
      if (Number(courseId) !== 7 || Number(materialId) !== 9) {
        return null;
      }
      return {
        id: 9,
        lessonId: 5,
        courseId: 7,
        ownerId: 12,
        courseStatus: course.status,
        title: 'Slides',
        originalName: 'Bài học #1.pdf',
        storedName: '123e4567-e89b-42d3-a456-426614174000.pdf',
        mime: 'application/pdf'
      };
    },
    async listByLesson(lessonId) {
      return state.materials.filter((material) => material.lessonId === Number(lessonId));
    },
    async listByLessonIds(lessonIds) {
      return state.materials.filter((material) => lessonIds.includes(material.lessonId));
    }
  };
  const port = {
    async getCourse(courseId) {
      return Number(courseId) === course.id ? course : null;
    },
    async isOwner(userId, courseId) {
      return Number(userId) === course.ownerId && Number(courseId) === course.id;
    },
    async isEnrolled(userId, courseId) {
      return enrolled && Number(userId) === 33 && Number(courseId) === course.id;
    },
    async getLessonSummary(lessonId) {
      state.lessonSummaryRequests.push(Number(lessonId));
      return Number(lessonId) === 5 ? { id: 5, courseId: course.id } : null;
    }
  };
  const storage = {
    async saveUpload(file, options) {
      state.storageOptions = options;
      return {
        storedName: '123e4567-e89b-42d3-a456-426614174000.pdf',
        originalName: file.originalname,
        mime: 'application/pdf',
        size: file.buffer.length
      };
    },
    openReadStream(storedName) {
      state.opened.push(storedName);
      return Readable.from(['pdf content']);
    },
    async deleteFile(storedName) {
      state.deleted.push(storedName);
      if (deleteErrors.length) {
        throw deleteErrors.shift();
      }
    }
  };
  const service = new LessonService({
    lessonRepository,
    materialRepository,
    storage,
    getPortFn(name) {
      assert.equal(name, 'courseAccess');
      return port;
    },
    clock: { now: () => new Date('2026-10-22T00:00:00.000Z') },
    loggerInstance: { error() {} },
    cronScheduler(expression, callback, options) {
      state.scheduled = expression;
      state.schedulerOptions = options;
      state.callbacks.push(callback);
      return { stop() {} };
    }
  });
  return { state, service, storage };
}

test('US-05 creates lessons only for the owner and lists materials for authorized members', async () => {
  const { service } = createLessonHarness();
  const created = await service.createLesson(
    7,
    { id: 12, role: 'GIANG_VIEN' },
    { title: '<b>Chapter 2</b>', content: '<script>bad()</script>Text', orderIndex: 2 }
  );
  assert.equal(created.title, 'Chapter 2');
  assert.equal(created.content, 'Text');
  assert.equal(created.orderIndex, 2);

  await assert.rejects(
    service.createLesson(7, { id: 99, role: 'GIANG_VIEN' }, { title: 'No access' }),
    (error) => error.statusCode === 403
  );
  const archived = createLessonHarness({
    course: { id: 7, ownerId: 12, title: 'Course', status: 'ARCHIVED' }
  });
  await assert.rejects(
    archived.service.createLesson(7, { id: 12, role: 'GIANG_VIEN' }, { title: 'Archived' }),
    (error) => error.statusCode === 409 && error.code === 'COURSE_ARCHIVED'
  );
});

test('US-05 saves allowlisted files with a 50 MiB limit and cleans the file if DB persistence fails', async () => {
  const { state, service } = createLessonHarness();
  const uploaded = await service.addMaterial(
    5,
    { id: 12, role: 'GIANG_VIEN' },
    { title: '<b>Lecture slides</b>' },
    { originalname: 'Bài học #1.pdf', buffer: Buffer.from('%PDF-1.4'), size: 8 }
  );

  assert.deepEqual(ALLOWED_EXTENSIONS, ['.pdf', '.docx', '.pptx', '.zip', '.rar']);
  assert.equal(MAX_MATERIAL_BYTES, 50 * 1024 * 1024);
  assert.equal(state.storageOptions.maxBytes, MAX_MATERIAL_BYTES);
  assert.deepEqual(state.storageOptions.allowedExt, ALLOWED_EXTENSIONS);
  assert.equal(uploaded.title, 'Lecture slides');
  assert.equal(uploaded.originalName, 'Bài học #1.pdf');
  assert.equal(Object.hasOwn(uploaded, 'storedName'), false);
  assert.equal(state.materials[0].fileUuid, '123e4567-e89b-42d3-a456-426614174000');

  const dbError = new Error('DB insert failed');
  const failing = createLessonHarness({ materialCreateError: dbError });
  await assert.rejects(
    failing.service.addMaterial(
      5,
      { id: 12, role: 'GIANG_VIEN' },
      { title: 'Slides' },
      { originalname: 'slides.pdf', buffer: Buffer.from('%PDF-1.4'), size: 8 }
    ),
    (error) => error === dbError
  );
  assert.equal(failing.state.deleted.length, 1);
  assert.equal(failing.state.deleted[0], '123e4567-e89b-42d3-a456-426614174000.pdf');
});

test('US-05 scheduled cleanup retries only known M1 orphan files after immediate cleanup fails', async () => {
  const failing = createLessonHarness({
    materialCreateError: new Error('DB insert failed'),
    deleteErrors: [new Error('disk unavailable')]
  });
  await assert.rejects(
    failing.service.addMaterial(
      5,
      { id: 12, role: 'GIANG_VIEN' },
      { title: 'Slides' },
      { originalname: 'slides.pdf', buffer: Buffer.from('%PDF-1.4'), size: 8 }
    ),
    AggregateError
  );
  assert.equal(failing.service.orphanedFiles.size, 1);
  failing.service.startCleanupJob();
  failing.service.startCleanupJob();
  assert.equal(failing.state.scheduled, '*/30 * * * *');
  assert.deepEqual(failing.state.schedulerOptions, { unref: true });
  assert.equal(failing.state.callbacks.length, 1);
  await failing.state.callbacks[0]();
  assert.equal(failing.service.orphanedFiles.size, 0);
  assert.equal(failing.state.deleted.length, 2);
});

test('US-06 verifies membership and the course association before opening a download stream', async () => {
  const denied = createLessonHarness({ enrolled: false });
  await assert.rejects(
    denied.service.downloadMaterial(7, 9, { id: 33, role: 'SINH_VIEN' }),
    (error) => error.statusCode === 403
  );
  assert.deepEqual(denied.state.opened, []);

  const allowed = createLessonHarness();
  const downloaded = await allowed.service.downloadMaterial(7, 9, {
    id: 33,
    role: 'SINH_VIEN'
  });
  assert.deepEqual(allowed.state.lessonSummaryRequests, [5]);
  assert.deepEqual(allowed.state.opened, ['123e4567-e89b-42d3-a456-426614174000.pdf']);
  assert.equal(downloaded.originalName, 'Bài học #1.pdf');
  assert.equal(downloaded.mime, 'application/pdf');
});

test('courseAccess.getLessonSummary reads the real lesson-to-course association', async () => {
  const repository = new CourseRepository({
    async query(sql, parameters) {
      assert.match(sql, /FROM lessons/);
      return [parameters[0] === 5 ? [{ id: 5, courseId: 7 }] : [], []];
    }
  });
  const courseAccess = createCourseAccessPort(repository);

  assert.deepEqual(await courseAccess.getLessonSummary(5), { id: 5, courseId: 7 });
  assert.equal(await courseAccess.getLessonSummary(999), null);
});

test('lesson routes authenticate users and stream downloads with the original filename', async () => {
  const service = {
    async listLessons() {
      return [];
    },
    async createLesson(courseId, user, input) {
      return { id: 5, courseId: Number(courseId), ownerId: user.id, title: input.title };
    },
    async listMaterials() {
      return [];
    },
    async addMaterial(lessonId, user, input, file) {
      return {
        id: 9,
        lessonId: Number(lessonId),
        title: input.title,
        originalName: file.originalname
      };
    },
    async downloadMaterial() {
      return {
        stream: Readable.from(['file bytes']),
        originalName: 'Bài học #1.pdf',
        mime: 'application/pdf'
      };
    }
  };
  const app = express();
  app.use(express.json());
  app.use(createLessonRouter({ lessonController: new LessonController(service) }));
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
    const unauthenticated = await request(app).get('/courses/7/lessons');
    assert.equal(unauthenticated.status, 401);

    const created = await request(app)
      .post('/courses/7/lessons')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ title: 'Lesson 1' });
    assert.equal(created.status, 201);

    const uploaded = await request(app)
      .post('/lessons/5/materials')
      .set('Authorization', `Bearer ${instructorToken}`)
      .field('title', 'Slides')
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'slides.pdf',
        contentType: 'application/pdf'
      });
    assert.equal(uploaded.status, 201);
    assert.equal(uploaded.body.material.originalName, 'slides.pdf');

    const download = await request(app)
      .get('/courses/7/materials/9/download')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(download.status, 200);
    assert.match(download.headers['content-disposition'], /filename\*=UTF-8''/);
    assert.equal(download.headers['content-type'], 'application/pdf');
    assert.equal(download.body.toString(), 'file bytes');
  } finally {
    db.query = originalQuery;
  }
});
