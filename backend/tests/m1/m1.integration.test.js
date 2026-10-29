const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const { createRegistry } = require('../../src/contracts');
const {
  createAssessmentUsageFake,
  createQuizUsageFake,
  createNotificationsFake,
  createCourseAccessFake
} = require('../../src/contracts/fakes');

const AuthController = require('../../src/modules/m1-core/controllers/authController');
const CourseController = require('../../src/modules/m1-core/controllers/courseController');
const EnrollmentController = require('../../src/modules/m1-core/controllers/enrollmentController');
const UserController = require('../../src/modules/m1-core/controllers/userController');
const LessonController = require('../../src/modules/m1-core/controllers/lessonController');
const ScheduleController = require('../../src/modules/m1-core/controllers/scheduleController');

const AuthService = require('../../src/modules/m1-core/services/authService');
const CourseService = require('../../src/modules/m1-core/services/courseService');
const UserService = require('../../src/modules/m1-core/services/userService');
const { LessonService } = require('../../src/modules/m1-core/services/lessonService');
const { ScheduleService } = require('../../src/modules/m1-core/services/scheduleService');

const { createAuthRouter } = require('../../src/modules/m1-core/routes/authRoutes');
const { createCourseRouter } = require('../../src/modules/m1-core/routes/courseRoutes');
const { createUserRouter } = require('../../src/modules/m1-core/routes/userRoutes');
const { createLessonRouter } = require('../../src/modules/m1-core/routes/lessonRoutes');
const { createScheduleRouter } = require('../../src/modules/m1-core/routes/scheduleRoutes');

function createClock(initialDate = new Date('2026-11-01T08:00:00.000Z')) {
  let current = new Date(initialDate);
  return {
    now() {
      return new Date(current);
    },
    advance(ms) {
      current = new Date(current.getTime() + ms);
    }
  };
}

function buildToken(payload) {
  return jwt.sign(
    {
      user_id: payload.id,
      role: payload.role,
      token_version: payload.token_version ?? 1,
      ...payload
    },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

test('T2 M1 Integration: phân quyền 3 loại (đúng vai trò, sai vai trò, người ngoài khóa) & IDOR', async () => {
  const clock = createClock();
  const registry = createRegistry();
  registry.registerPort('assessmentUsage', createAssessmentUsageFake());
  registry.registerPort('quizUsage', createQuizUsageFake());
  const notificationsFake = createNotificationsFake();
  registry.registerPort('notifications', notificationsFake);

  const coursesDb = new Map();
  const enrollmentsDb = new Map();
  const lessonsDb = new Map();
  const materialsDb = new Map();
  const schedulesDb = new Map();

  const courseAccessFake = createCourseAccessFake({
    courses: [{ id: 100, ownerId: 2, title: 'Lập trình căn bản', status: 'PUBLISHED' }],
    enrolledStudentIds: [10],
    lessonSummary: { id: 200, courseId: 100 }
  });
  registry.registerPort('courseAccess', courseAccessFake);

  let nextCourseId = 100;
  let nextLessonId = 200;
  let nextMaterialId = 300;
  let nextScheduleId = 400;

  coursesDb.set(100, {
    id: 100,
    code: 'INT101',
    title: 'Lập trình căn bản',
    description: 'Mô tả',
    semester: '2026-1',
    ownerId: 2, // Giảng viên A (id: 2)
    enrollmentKey: 'KEY101',
    status: 'PUBLISHED',
    createdAt: clock.now(),
    updatedAt: clock.now()
  });

  // Sinh viên 1 (id: 10) đã ghi danh vào khóa 100
  enrollmentsDb.set('100:10', {
    id: 1,
    courseId: 100,
    studentId: 10,
    status: 'ACTIVE',
    enrolledAt: clock.now()
  });

  lessonsDb.set(200, {
    id: 200,
    courseId: 100,
    title: 'Bài 1: Giới thiệu',
    content: 'Nội dung',
    orderIndex: 1
  });

  materialsDb.set(300, {
    id: 300,
    lessonId: 200,
    title: 'Slide bài giảng',
    storedName: 'test-slide.pdf',
    originalName: 'slide.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024
  });

  schedulesDb.set(400, {
    id: 400,
    courseId: 100,
    title: 'Buổi học trực tiếp',
    date: '2026-11-05',
    startTime: '08:00',
    endTime: '10:00',
    roomOrLink: 'https://meet.google.com/abc',
    status: 'SCHEDULED'
  });

  const courseRepo = {
    async create(data) {
      const id = ++nextCourseId;
      const course = { id, ...data, status: 'DRAFT', createdAt: clock.now(), updatedAt: clock.now() };
      coursesDb.set(id, course);
      return course;
    },
    async findById(id) {
      return coursesDb.get(Number(id)) || null;
    },
    async update(id, data) {
      const existing = coursesDb.get(Number(id));
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: clock.now() };
      coursesDb.set(Number(id), updated);
      return updated;
    },
    async updateStatus(id, status) {
      const existing = coursesDb.get(Number(id));
      if (!existing) return null;
      existing.status = status;
      return existing;
    },
    async list({ ownerId, status } = {}) {
      return Array.from(coursesDb.values()).filter((c) => {
        if (ownerId && c.ownerId !== ownerId) return false;
        if (status && c.status !== status) return false;
        return true;
      });
    },
    async findByEnrollmentKey(key) {
      return Array.from(coursesDb.values()).find((c) => c.enrollmentKey === key) || null;
    }
  };

  const enrollmentRepo = {
    async findPublishedCourseByKey(key) {
      const course = Array.from(coursesDb.values()).find(
        (c) => c.enrollmentKey === key && c.status === 'PUBLISHED'
      );
      return course || null;
    },
    async findEnrollment(courseId, studentId) {
      return enrollmentsDb.get(`${courseId}:${studentId}`) || null;
    },
    async findByCourseAndStudent(courseId, studentId) {
      return enrollmentsDb.get(`${courseId}:${studentId}`) || null;
    },
    async create(courseId, studentId) {
      const record = { id: Date.now(), courseId, studentId, status: 'ACTIVE', enrolledAt: clock.now() };
      enrollmentsDb.set(`${courseId}:${studentId}`, record);
      return record;
    },
    async listByStudent(studentId) {
      return Array.from(enrollmentsDb.values()).filter((e) => e.studentId === studentId && e.status === 'ACTIVE');
    },
    async countActiveByCourse(courseId) {
      return Array.from(enrollmentsDb.values()).filter((e) => e.courseId === courseId && e.status === 'ACTIVE').length;
    }
  };

  const lessonRepo = {
    async findById(id) {
      return lessonsDb.get(Number(id)) || null;
    },
    async listByCourse(courseId) {
      return Array.from(lessonsDb.values()).filter((l) => l.courseId === Number(courseId));
    },
    async create(data) {
      const id = ++nextLessonId;
      const lesson = { id, ...data };
      lessonsDb.set(id, lesson);
      return lesson;
    }
  };

  const materialRepo = {
    async findById(id) {
      return materialsDb.get(Number(id)) || null;
    },
    async findForDownload(courseId, materialId) {
      const mat = materialsDb.get(Number(materialId));
      if (!mat) return null;
      const lesson = lessonsDb.get(mat.lessonId);
      if (!lesson || lesson.courseId !== Number(courseId)) return null;
      return {
        id: mat.id,
        lessonId: mat.lessonId,
        storedName: mat.storedName,
        originalName: mat.originalName,
        mime: mat.mimeType
      };
    },
    async listByLesson(lessonId) {
      return Array.from(materialsDb.values()).filter((m) => m.lessonId === Number(lessonId));
    },
    async create(data) {
      const id = ++nextMaterialId;
      const mat = { id, ...data };
      materialsDb.set(id, mat);
      return mat;
    }
  };

  const scheduleRepo = {
    async findById(id) {
      return schedulesDb.get(Number(id)) || null;
    },
    async lockCourse(courseId) {
      const course = coursesDb.get(Number(courseId));
      return course ? { id: course.id, ownerId: course.ownerId, status: course.status } : null;
    },
    async listByCourse(courseId) {
      return Array.from(schedulesDb.values()).filter((s) => s.courseId === Number(courseId));
    },
    async listByStudentEnrolledCourses(studentId, { page = 1, limit = 20 } = {}) {
      const enrolled = Array.from(enrollmentsDb.values())
        .filter((e) => e.studentId === studentId && e.status === 'ACTIVE')
        .map((e) => e.courseId);
      const items = Array.from(schedulesDb.values()).filter((s) => enrolled.includes(s.courseId));
      return { items, total: items.length, page, limit };
    },
    async findConflict(courseId, date, startTime, endTime, { excludeScheduleId } = {}) {
      for (const s of schedulesDb.values()) {
        if (s.courseId !== courseId || s.status === 'CANCELLED') continue;
        if (excludeScheduleId && s.id === excludeScheduleId) continue;
        if (s.date === date && s.startTime < endTime && s.endTime > startTime) {
          return s;
        }
      }
      return null;
    },
    async create(courseId, fields) {
      const id = ++nextScheduleId;
      const record = { id, courseId, ...fields, status: 'SCHEDULED' };
      schedulesDb.set(id, record);
      return record;
    },
    async update(id, data) {
      const existing = schedulesDb.get(Number(id));
      if (!existing) return null;
      Object.assign(existing, data);
      return existing;
    }
  };

  const getPortFn = (name) => registry.getPort(name);

  const courseService = new CourseService({
    courseRepository: courseRepo,
    enrollmentRepository: enrollmentRepo,
    clock,
    transactionRunner: async (fn) => fn({}),
    getPortFn
  });
  const lessonService = new LessonService({
    lessonRepository: lessonRepo,
    materialRepository: materialRepo,
    courseRepository: courseRepo,
    enrollmentRepository: enrollmentRepo,
    storage: {
      openReadStream() {
        const { Readable } = require('node:stream');
        return Readable.from(['fake file content']);
      }
    },
    getPortFn
  });
  const scheduleService = new ScheduleService({
    scheduleRepository: scheduleRepo,
    courseRepository: courseRepo,
    enrollmentRepository: enrollmentRepo,
    clock,
    transactionRunner: async (fn) => fn({}),
    getPortFn
  });

  const app = express();
  app.use(express.json());

  app.use(
    '/api/courses',
    createCourseRouter({
      courseController: new CourseController(courseService),
      enrollmentController: new EnrollmentController(courseService)
    })
  );
  app.use(
    '/api',
    createLessonRouter({
      lessonController: new LessonController(lessonService)
    })
  );
  app.use(
    '/api',
    createScheduleRouter({
      scheduleController: new ScheduleController(scheduleService)
    })
  );
  app.use(errorHandler);

  // Mock token verification in db for requireAuth
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }], []];

  try {
    const instructorToken = buildToken({ id: 2, role: 'GIANG_VIEN' });
    const otherInstructorToken = buildToken({ id: 99, role: 'GIANG_VIEN' }); // Người ngoài khóa
    const enrolledStudentToken = buildToken({ id: 10, role: 'SINH_VIEN' }); // Sinh viên trong khóa
    const strangerStudentToken = buildToken({ id: 88, role: 'SINH_VIEN' }); // Sinh viên ngoài khóa

    // --- 1. Tạo khóa học: GIANG_VIEN (đúng vai trò) -> 201, SINH_VIEN (sai vai trò) -> 403
    const createRes = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ code: 'CS202', title: 'Cấu trúc dữ liệu', semester: '2026-2' });
    assert.equal(createRes.status, 201);

    const wrongRoleCreate = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${enrolledStudentToken}`)
      .send({ code: 'CS203', title: 'Hệ điều hành', semester: '2026-2' });
    assert.equal(wrongRoleCreate.status, 403);

    // --- 2. Sửa khóa học 100: Chủ khóa (id: 2) -> 200, Giảng viên khác (id: 99 - IDOR) -> 403
    const editOwner = await request(app)
      .patch('/api/courses/100')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ title: 'Lập trình căn bản (Đã cập nhật)' });
    assert.equal(editOwner.status, 200);

    const editStranger = await request(app)
      .patch('/api/courses/100')
      .set('Authorization', `Bearer ${otherInstructorToken}`)
      .send({ title: 'Cố tình sửa lén (IDOR)' });
    assert.equal(editStranger.status, 403);

    // --- 3. Ghi danh: Sinh viên ngoài khóa (id: 88) ghi danh -> 201; Giảng viên (sai vai trò) -> 403
    const studentEnroll = await request(app)
      .post('/api/courses/enroll')
      .set('Authorization', `Bearer ${strangerStudentToken}`)
      .send({ enrollment_key: 'KEY101' });
    assert.equal(studentEnroll.status, 201);

    const instructorEnroll = await request(app)
      .post('/api/courses/enroll')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ enrollment_key: 'KEY101' });
    assert.equal(instructorEnroll.status, 403);

    // Thử ghi danh lại cùng một khóa -> 409 Conflict
    const duplicateEnroll = await request(app)
      .post('/api/courses/enroll')
      .set('Authorization', `Bearer ${enrolledStudentToken}`)
      .send({ enrollment_key: 'KEY101' });
    assert.equal(duplicateEnroll.status, 409);

    // --- 4. Tải tài liệu 300: Sinh viên trong khóa (id: 10) -> 200; Người ngoài chưa ghi danh -> 403 (IDOR)
    const downloadEnrolled = await request(app)
      .get('/api/courses/100/materials/300/download')
      .set('Authorization', `Bearer ${enrolledStudentToken}`);
    assert.equal(downloadEnrolled.status, 200);

    const unregisteredStudent = buildToken({ id: 999, role: 'SINH_VIEN' });
    const downloadStranger = await request(app)
      .get('/api/courses/100/materials/300/download')
      .set('Authorization', `Bearer ${unregisteredStudent}`);
    assert.equal(downloadStranger.status, 403);

    // Không có token -> 401 Unauthorized
    const unauthDownload = await request(app).get('/api/courses/100/materials/300/download');
    assert.equal(unauthDownload.status, 401);

    // Tải tài liệu không tồn tại -> 404 Not Found
    const notFoundMaterial = await request(app)
      .get('/api/courses/100/materials/9999/download')
      .set('Authorization', `Bearer ${instructorToken}`);
    assert.equal(notFoundMaterial.status, 404);

    // --- 5. Lịch học: Sinh viên trong khóa xem lịch -> 200; Người ngoài xem lịch chi tiết -> 403 (IDOR)
    const viewScheduleEnrolled = await request(app)
      .get('/api/courses/100/schedules')
      .set('Authorization', `Bearer ${enrolledStudentToken}`);
    assert.equal(viewScheduleEnrolled.status, 200);

    const viewScheduleStranger = await request(app)
      .get('/api/courses/100/schedules')
      .set('Authorization', `Bearer ${unregisteredStudent}`);
    assert.equal(viewScheduleStranger.status, 403);

    // Tạo lịch học trùng giờ (EC-23) -> 409 Conflict
    const conflictSchedule = await request(app)
      .post('/api/courses/100/schedules')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        title: 'Buổi học trùng lặp',
        date: '2026-11-05',
        startTime: '09:00',
        endTime: '11:00',
        roomOrLink: 'https://meet.google.com/xyz'
      });
    assert.equal(conflictSchedule.status, 409);

    // Giờ kết thúc <= giờ bắt đầu -> 400 hoặc 422
    const invalidTimeSchedule = await request(app)
      .post('/api/courses/100/schedules')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        title: 'Giờ kết thúc nhỏ hơn bắt đầu',
        date: '2026-11-05',
        startTime: '10:00',
        endTime: '09:00',
        roomOrLink: 'https://meet.google.com/xyz'
      });
    assert.ok(invalidTimeSchedule.status === 400 || invalidTimeSchedule.status === 422);
  } finally {
    db.query = originalQuery;
  }
});

test('T2 M1 Integration: Admin Users API (US-02, BR-01, BR-02) - phân quyền, ràng buộc dữ liệu & IDOR', async () => {
  const usersDb = new Map();
  let nextUserId = 10;

  usersDb.set(1, {
    id: 1,
    username: 'admin',
    email: 'admin@lms.edu.vn',
    fullName: 'Quản trị viên',
    role: 'ADMIN',
    status: 'ACTIVE',
    tokenVersion: 1
  });

  usersDb.set(2, {
    id: 2,
    username: 'gv_mai',
    email: 'mai@lms.edu.vn',
    fullName: 'Nguyễn Thị Mai',
    role: 'GIANG_VIEN',
    status: 'ACTIVE',
    tokenVersion: 1
  });

  const userRepo = {
    async create(data) {
      if (Array.from(usersDb.values()).some((u) => u.username === data.username)) {
        const err = new Error('Duplicate username');
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
      if (Array.from(usersDb.values()).some((u) => u.email === data.email)) {
        const err = new Error('Duplicate email');
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
      const id = ++nextUserId;
      const record = { id, ...data, tokenVersion: 1 };
      usersDb.set(id, record);
      return record;
    },
    async findById(id) {
      return usersDb.get(Number(id)) || null;
    },
    async updateStatus(id, status) {
      const u = usersDb.get(Number(id));
      if (!u) return null;
      u.status = status;
      return u;
    },
    async updateRole(id, role) {
      const u = usersDb.get(Number(id));
      if (!u) return null;
      u.role = role;
      return u;
    },
    async list({ page = 1, limit = 20, search, role, status } = {}) {
      let list = Array.from(usersDb.values());
      if (search) list = list.filter((u) => u.username.includes(search) || u.email.includes(search));
      if (role) list = list.filter((u) => u.role === role);
      if (status) list = list.filter((u) => u.status === status);
      return { items: list, total: list.length, page, limit };
    }
  };

  const userService = new UserService({
    userRepository: userRepo,
    passwordHasher: { hash: async () => 'hashed_pw' }
  });

  const app = express();
  app.use(express.json());
  app.use('/api/admin/users', createUserRouter({ userController: new UserController(userService) }));
  app.use(errorHandler);

  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }], []];

  try {
    const adminToken = buildToken({ id: 1, role: 'ADMIN' });
    const teacherToken = buildToken({ id: 2, role: 'GIANG_VIEN' });
    const studentToken = buildToken({ id: 3, role: 'SINH_VIEN' });

    // 1. Phân quyền: ADMIN -> 201; GIANG_VIEN / SINH_VIEN -> 403 Forbidden
    const createSuccess = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'gv_nam',
        email: 'nam@lms.edu.vn',
        fullName: 'Nguyễn Văn Nam',
        role: 'GIANG_VIEN'
      });
    assert.equal(createSuccess.status, 201);

    const teacherCreate = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ username: 'sv_test', email: 'test@lms.edu.vn', fullName: 'Test', role: 'SINH_VIEN' });
    assert.equal(teacherCreate.status, 403);

    const studentCreate = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ username: 'sv_test', email: 'test@lms.edu.vn', fullName: 'Test', role: 'SINH_VIEN' });
    assert.equal(studentCreate.status, 403);

    // Không có token -> 401 Unauthorized
    const unauthCreate = await request(app)
      .post('/api/admin/users')
      .send({ username: 'sv_test', email: 'test@lms.edu.vn', fullName: 'Test', role: 'SINH_VIEN' });
    assert.equal(unauthCreate.status, 401);

    // 2. Ràng buộc dữ liệu: Email sai định dạng -> 422
    const invalidEmail = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'invalid_user',
        email: 'not-an-email',
        fullName: 'Invalid Email',
        role: 'SINH_VIEN'
      });
    assert.equal(invalidEmail.status, 422);

    // 3. Trùng username/email -> 409 Conflict
    const duplicateUser = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'gv_nam', // đã tồn tại
        email: 'unique_nam@lms.edu.vn',
        fullName: 'Trùng username',
        role: 'GIANG_VIEN'
      });
    assert.equal(duplicateUser.status, 409);

    // 4. Admin tự khóa chính mình -> 403 Forbidden (không được phép tự khóa)
    const selfLock = await request(app)
      .patch('/api/admin/users/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'LOCKED' });
    assert.equal(selfLock.status, 403);

    // 5. Admin khóa người dùng khác (id: 2) -> 200 OK
    const lockOther = await request(app)
      .patch('/api/admin/users/2/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'LOCKED' });
    assert.equal(lockOther.status, 200);

    // 6. Admin mở khóa người dùng (id: 2) -> 200 OK
    const unlockOther = await request(app)
      .patch('/api/admin/users/2/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' });
    assert.equal(unlockOther.status, 200);

    // 7. Khóa user không tồn tại -> 404 Not Found
    const lockNotFound = await request(app)
      .patch('/api/admin/users/99999/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'LOCKED' });
    assert.equal(lockNotFound.status, 404);
  } finally {
    db.query = originalQuery;
  }
});

test('T2 M1 Integration: Authentication API (US-01, BR-01, BR-02, EC-08) - lockout 15 phút, clock simulation', async () => {
  process.env.RATE_LIMIT_LOGIN_MAX = '50';
  const clock = createClock(new Date('2026-11-01T10:00:00.000Z'));
  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash('MatKhau@123', 10);

  const userRecord = {
    id: 50,
    username: 'test_student',
    email: 'student50@lms.edu.vn',
    password_hash: passwordHash,
    role: 'SINH_VIEN',
    status: 'ACTIVE',
    token_version: 1,
    failed_login_attempts: 0,
    failed_login_window_started_at: null,
    lockout_until: null
  };

  const authRepo = {
    async findByIdentifier(identifier) {
      if (identifier === userRecord.username || identifier === userRecord.email) {
        return { ...userRecord };
      }
      return null;
    },
    async findById(userId) {
      return Number(userId) === Number(userRecord.id) ? { ...userRecord } : null;
    },
    async releaseExpiredLockout() {
      const until = userRecord.lockout_until ? new Date(userRecord.lockout_until) : null;
      if (
        userRecord.status === 'TEMPORARY_LOCKED' &&
        until &&
        until.getTime() <= clock.now().getTime()
      ) {
        userRecord.status = 'ACTIVE';
        userRecord.failed_login_attempts = 0;
        userRecord.failed_login_window_started_at = null;
        userRecord.lockout_until = null;
        return true;
      }
      return false;
    },
    async recordFailedLogin() {
      const now = clock.now();
      const windowStartedAt = userRecord.failed_login_window_started_at;
      const withinWindow =
        windowStartedAt && now.getTime() - new Date(windowStartedAt).getTime() < 10 * 60_000;
      userRecord.failed_login_attempts = withinWindow ? userRecord.failed_login_attempts + 1 : 1;
      if (!withinWindow) {
        userRecord.failed_login_window_started_at = now;
      }
      if (userRecord.failed_login_attempts >= 5) {
        userRecord.status = 'TEMPORARY_LOCKED';
        userRecord.lockout_until = new Date(now.getTime() + 15 * 60_000);
      }
      return { status: userRecord.status };
    },
    async createRefreshToken(userId) {
      if (userRecord.status !== 'ACTIVE' || Number(userId) !== Number(userRecord.id)) {
        return null;
      }
      userRecord.failed_login_attempts = 0;
      userRecord.failed_login_window_started_at = null;
      userRecord.lockout_until = null;
      return { ...userRecord };
    }
  };

  const authService = new AuthService({
    authRepository: authRepo,
    clock,
    config
  });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ authController: new AuthController(authService) }));
  app.use(errorHandler);

  // 1. Nhập sai 5 lần liên tiếp trong 10 phút
  for (let attempt = 1; attempt <= 4; attempt++) {
    const failRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test_student', password: 'WrongPassword!' });
    assert.equal(failRes.status, 401);
  }

  // Lần thứ 5 sai -> Tự động khóa tạm thời 15 phút (EC-08)
  const fifthFailRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test_student', password: 'WrongPassword!' });
  assert.equal(fifthFailRes.status, 403);
  assert.match(fifthFailRes.body.message, /tạm khóa/i);

  // Thử đăng nhập bằng MẬT KHẨU ĐÚNG trong thời gian 15 phút -> Vẫn bị chặn 403
  clock.advance(5 * 60 * 1000); // Tiến thêm 5 phút (vẫn trong khoảng 15 phút khóa)
  const lockedAttempt = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test_student', password: 'MatKhau@123' });
  assert.equal(lockedAttempt.status, 403);
  assert.match(lockedAttempt.body.message, /tạm khóa/i);

  // Tiến đồng hồ thêm 11 phút nữa (tổng cộng 16 phút > 15 phút) -> Mở khóa tự động
  clock.advance(11 * 60 * 1000);
  const successAfterLock = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test_student', password: 'MatKhau@123' });
  assert.equal(successAfterLock.status, 200);
  assert.ok(successAfterLock.body.accessToken);
});
