const assert = require('node:assert/strict');
const test = require('node:test');

const CourseService = require('../../src/modules/m1-core/services/courseService');
const { LessonService } = require('../../src/modules/m1-core/services/lessonService');
const { ScheduleService } = require('../../src/modules/m1-core/services/scheduleService');
const UserService = require('../../src/modules/m1-core/services/userService');
const { createRegistry } = require('../../src/contracts');

test('T4 M1 Coverage: CourseService comprehensive branch coverage', async () => {
  const courses = new Map();
  const enrollments = new Map();

  const repository = {
    async findById(id) {
      return courses.get(Number(id)) || null;
    },
    async findForUser(userId, role) {
      return [...courses.values()];
    },
    async isEnrolled(userId, courseId) {
      return enrollments.has(`${userId}_${courseId}`);
    },
    async updateStatus(id, status) {
      const c = courses.get(Number(id));
      c.status = status;
      return { ...c };
    },
    async hasM1CourseData() {
      return false;
    },
    async softDelete(id) {
      courses.delete(Number(id));
      return true;
    }
  };

  const enrollmentRepository = {
    async findPublishedCourseByKey(key) {
      return [...courses.values()].find((c) => c.enrollment_key === key && c.status === 'PUBLISHED') || null;
    },
    async findEnrollment(courseId, studentId) {
      return enrollments.get(`${studentId}_${courseId}`) || null;
    },
    async create(courseId, studentId) {
      const record = { id: 1, courseId: Number(courseId), studentId: Number(studentId) };
      enrollments.set(`${studentId}_${courseId}`, record);
      return record;
    },
    async delete(courseId, studentId) {
      return enrollments.delete(`${studentId}_${courseId}`);
    }
  };

  const registry = createRegistry();
  registry.registerPort('assessmentUsage', {
    hasCourseData: async () => false,
    hasUserData: async (userId) => Number(userId) === 99
  });
  registry.registerPort('quizUsage', {
    hasCourseData: async () => false,
    hasUserData: async () => false
  });

  const service = new CourseService({
    courseRepository: repository,
    enrollmentRepository,
    getPortFn: (name, opts) => registry.getPort(name, opts),
    clock: { now: () => new Date('2026-03-01T00:00:00.000Z') },
    transactionRunner: async (work) => work({})
  });

  courses.set(10, {
    id: 10,
    code: 'INT1001',
    title: 'Khóa học 10',
    semester: 'HK1-2026',
    ownerId: 2,
    status: 'DRAFT',
    enrollment_key: 'KEY100'
  });
  courses.set(20, {
    id: 20,
    code: 'INT2002',
    title: 'Khóa học 20',
    semester: 'HK1-2026',
    ownerId: 2,
    status: 'ARCHIVED',
    enrollment_key: 'KEY200'
  });

  // 1. Validation branch errors (synchronous)
  assert.throws(
    () => service._validateCourseFields({ code: 'A'.repeat(25), title: 'T', semester: 'S' }),
    /Mã môn học tối đa 20 ký tự/
  );
  assert.throws(
    () => service._validateCourseFields({ code: 'C', title: 'T'.repeat(205), semester: 'S' }),
    /Tên khóa học tối đa 200 ký tự/
  );
  assert.throws(
    () => service._validateCourseFields({ code: 'C', title: 'T', semester: 'S'.repeat(25) }),
    /Học kỳ tối đa 20 ký tự/
  );
  assert.throws(
    () => service._validateCourseFields({ code: 'C', title: 'T', semester: 'S', enrollmentKey: 'bad' }),
    /Mã ghi danh phải gồm 6-8 chữ cái hoặc chữ số/
  );

  // 2. ID validation
  await assert.rejects(() => service._findCourse(-1), /Mã khóa học không hợp lệ/);
  await assert.rejects(() => service._findCourse(9999), /Không tìm thấy khóa học/);

  // 3. Student listCourses and getCourse hides enrollment_key
  const studentList = await service.listCourses({ id: 5, role: 'SINH_VIEN' });
  assert.equal(studentList[0].enrollment_key, undefined);

  // Enrolled student can getCourse, but enrollment_key is hidden
  enrollments.set('5_10', { id: 1 });
  const studentCourse = await service.getCourse(10, { id: 5, role: 'SINH_VIEN' });
  assert.equal(studentCourse.enrollment_key, undefined);

  // Stranger cannot getCourse (403)
  await assert.rejects(
    () => service.getCourse(10, { id: 9, role: 'SINH_VIEN' }),
    /Bạn không có quyền xem khóa học này/
  );

  // 4. Idempotent publish and archive
  await service.publishCourse(10, 2);
  const rePublished = await service.publishCourse(10, 2);
  assert.equal(rePublished.status, 'PUBLISHED');

  const reArchived = await service.archiveCourse(20, { id: 1, role: 'ADMIN' });
  assert.equal(reArchived.status, 'ARCHIVED');

  const deleteArchivedResult = await service.deleteCourse(20, 2);
  assert.equal(deleteArchivedResult.archived, true);

  // 5. Enroll by code edge cases
  await assert.rejects(() => service.enrollByCode(5, ''), /Vui lòng nhập mã ghi danh/);
  await assert.rejects(() => service.enrollByCode(5, 'xyz'), /Mã ghi danh không tồn tại/);
  await assert.rejects(() => service.enrollByCode(5, 'NOSUCHKEY'), /Mã ghi danh không tồn tại/);

  // Already enrolled throws ConflictError
  await assert.rejects(() => service.enrollByCode(5, 'KEY100'), /Bạn đã là thành viên của khóa học này/);

  // 6. Remove enrollment edge cases
  await assert.rejects(() => service.removeEnrollment(10, -5, { id: 2, role: 'GIANG_VIEN' }), /Mã sinh viên không hợp lệ/);
  await assert.rejects(() => service.removeEnrollment(10, 888, { id: 2, role: 'GIANG_VIEN' }), /Không tìm thấy đăng ký khóa học/);

  // Student with assessment data throws 409 STUDENT_HAS_COURSEWORK
  enrollments.set('99_10', { id: 2 });
  await assert.rejects(
    () => service.removeEnrollment(10, 99, { id: 2, role: 'GIANG_VIEN' }),
    /Không thể hủy ghi danh khi sinh viên đã có dữ liệu bài tập hoặc trắc nghiệm/
  );

  // Successful removal
  await service.removeEnrollment(10, 5, { id: 2, role: 'GIANG_VIEN' });
  assert.equal(enrollments.has('5_10'), false);
});

test('T4 M1 Coverage: LessonService comprehensive branch coverage', async () => {
  const lessons = new Map();
  const materials = new Map();

  const lessonRepository = {
    async findById(id) {
      return lessons.get(Number(id)) || null;
    },
    async listByCourse(courseId) {
      return [...lessons.values()].filter((l) => l.courseId === Number(courseId));
    },
    async create(courseId, input) {
      const l = { id: 101, courseId: Number(courseId), ...input };
      lessons.set(101, l);
      return l;
    }
  };

  const materialRepository = {
    async listByLesson(lessonId) {
      return [...materials.values()].filter((m) => m.lessonId === Number(lessonId));
    },
    async listByLessonIds(lessonIds) {
      return [...materials.values()].filter((m) => lessonIds.includes(m.lessonId));
    },
    async findById(id) {
      return materials.get(Number(id)) || null;
    },
    async findForDownload(courseId, materialId) {
      const m = materials.get(Number(materialId));
      return m && m.courseId === Number(courseId) ? m : null;
    },
    async create(material) {
      materials.set(Number(material.id), material);
      return material;
    },
    async delete(id) {
      return materials.delete(Number(id));
    }
  };

  const courseAccessFake = {
    async getCourse(courseId) {
      if (Number(courseId) === 999) return null;
      return { id: Number(courseId), status: Number(courseId) === 50 ? 'ARCHIVED' : 'PUBLISHED' };
    },
    async isOwner(userId, courseId) {
      return Number(userId) === 2;
    },
    async isEnrolled(userId, courseId) {
      return Number(userId) === 5;
    },
    async getLessonSummary(lessonId) {
      return { id: Number(lessonId), courseId: 10 };
    }
  };

  const registry = createRegistry();
  registry.registerPort('courseAccess', courseAccessFake);

  const service = new LessonService({
    lessonRepository,
    materialRepository,
    getPortFn: (name, opts) => registry.getPort(name, opts),
    storage: {
      saveUpload: async () => ({ storageKey: 'uuid.pdf', size: 1024, mimeType: 'application/pdf' }),
      deleteFile: async () => true
    }
  });

  lessons.set(1, { id: 1, courseId: 10, title: 'Bài 1', orderIndex: 1, courseStatus: 'PUBLISHED' });
  lessons.set(2, { id: 2, courseId: 50, title: 'Bài 2 (Lưu trữ)', orderIndex: 2, courseStatus: 'ARCHIVED' });

  // 1. Validation branches
  await assert.rejects(() => service.listLessons('abc', { id: 2, role: 'GIANG_VIEN' }), /Mã khóa học không hợp lệ/);
  await assert.rejects(() => service.listMaterials('abc', { id: 2, role: 'GIANG_VIEN' }), /Mã bài học không hợp lệ/);
  await assert.rejects(() => service.listMaterials(999, { id: 2, role: 'GIANG_VIEN' }), /Không tìm thấy bài học/);

  // 2. listMaterials
  const matList = await service.listMaterials(1, { id: 2, role: 'GIANG_VIEN' });
  assert.equal(Array.isArray(matList), true);

  // 3. addMaterial edge cases
  await assert.rejects(
    () => service.addMaterial(999, { id: 2, role: 'GIANG_VIEN' }, { title: 'T' }, {}),
    /Không tìm thấy bài học/
  );
  await assert.rejects(
    () => service.addMaterial(2, { id: 2, role: 'GIANG_VIEN' }, { title: 'T' }, { buffer: Buffer.from('abc'), size: 10 }),
    /Khóa học đã lưu trữ và chỉ được xem/
  );
  await assert.rejects(
    () => service.addMaterial(1, { id: 2, role: 'GIANG_VIEN' }, { title: 'T' }, null),
    /Vui lòng chọn tệp tài liệu/
  );
  await assert.rejects(
    () => service.addMaterial(1, { id: 2, role: 'GIANG_VIEN' }, { title: 'T' }, { buffer: Buffer.from('x'), size: 60 * 1024 * 1024 }),
    /Dung lượng tệp vượt quá giới hạn 50MB/
  );

  // 4. downloadMaterial edge cases
  materials.set(500, { id: 500, lessonId: 1, courseId: 10, title: 'Slide', storageKey: 'key.pdf', originalName: 'slide.pdf' });
  materials.set(501, { id: 501, lessonId: 2, courseId: 50, title: 'Slide Cũ', storageKey: 'key2.pdf', originalName: 'old.pdf' });

  await assert.rejects(() => service.downloadMaterial(10, 9999, { id: 2, role: 'GIANG_VIEN' }), /Không tìm thấy tài liệu/);
  await assert.rejects(() => service.downloadMaterial(10, 500, { id: 9, role: 'SINH_VIEN' }), /Bạn không có quyền truy cập khóa học này/);
});

test('T4 M1 Coverage: ScheduleService and UserService branch coverage', async () => {
  const schedules = new Map();
  const scheduleRepository = {
    async findById(id) {
      return schedules.get(Number(id)) || null;
    },
    async listByCourse(courseId) {
      return [...schedules.values()].filter((s) => s.courseId === Number(courseId));
    },
    async update(id, fields) {
      const s = schedules.get(Number(id));
      Object.assign(s, fields);
      return s;
    },
    async updateStatus(id, status) {
      const s = schedules.get(Number(id));
      s.status = status;
      return s;
    },
    async setStatus(id, courseId, status) {
      const s = schedules.get(Number(id));
      s.status = status;
      return { ...s };
    },
    async lockCourse(courseId) {
      if (Number(courseId) === 999) return null;
      return { id: Number(courseId), ownerId: 2, status: Number(courseId) === 88 ? 'ARCHIVED' : 'PUBLISHED' };
    },
    async hasOverlap() {
      return false;
    }
  };

  const courseAccessFake = {
    async getCourse(courseId) {
      if (Number(courseId) === 999) return null;
      return { id: Number(courseId), status: Number(courseId) === 88 ? 'ARCHIVED' : 'PUBLISHED' };
    },
    async isOwner(userId, courseId) {
      return Number(userId) === 2;
    },
    async isEnrolled(userId, courseId) {
      return Number(userId) === 5;
    },
    async getLessonSummary(lessonId) {
      return { id: Number(lessonId), courseId: 10 };
    }
  };

  const registry = createRegistry();
  registry.registerPort('courseAccess', courseAccessFake);

  const schedService = new ScheduleService({
    scheduleRepository,
    getPortFn: (name, opts) => registry.getPort(name, opts),
    transactionRunner: async (work) => work({})
  });

  schedules.set(10, {
    id: 10,
    courseId: 1,
    title: 'Buổi 1',
    date: '2026-03-05',
    startTime: '08:00:00',
    endTime: '10:00:00',
    roomOrLink: 'P.101',
    status: 'SCHEDULED'
  });

  // 1. Course not found / stranger in schedule
  await assert.rejects(() => schedService.listForCourse(999, { id: 2, role: 'GIANG_VIEN' }), /Không tìm thấy khóa học/);
  await assert.rejects(() => schedService.listForCourse(1, { id: 9, role: 'SINH_VIEN' }), /Bạn cần là chủ khóa học hoặc ghi danh/);

  // 2. Schedule not found on update / cancel
  await assert.rejects(
    () => schedService.updateSchedule(999, { id: 2, role: 'GIANG_VIEN' }, { title: 'New' }),
    /Không tìm thấy buổi học/
  );
  await assert.rejects(
    () => schedService.cancelSchedule(999, { id: 2, role: 'GIANG_VIEN' }),
    /Không tìm thấy buổi học/
  );

  // Cancel already cancelled schedule is idempotent
  await schedService.cancelSchedule(10, { id: 2, role: 'GIANG_VIEN' });
  const reCancelled = await schedService.cancelSchedule(10, { id: 2, role: 'GIANG_VIEN' });
  assert.equal(reCancelled.status, 'CANCELLED');

  // 3. UserService edge cases
  const users = new Map();
  const userRepository = {
    async findById(id) {
      return users.get(Number(id)) || null;
    },
    async updateStatus(id, status) {
      const u = users.get(Number(id));
      if (!u) return null;
      u.status = status;
      return u;
    },
    async updateRole(id, role) {
      const u = users.get(Number(id));
      if (!u) return null;
      u.role = role;
      return u;
    },
    async softDelete(id) {
      return users.delete(Number(id));
    }
  };

  const userService = new UserService({
    userRepository,
    passwordHasher: { hash: async (p) => `hash_${p}` },
    clock: { now: () => new Date('2026-03-01T00:00:00.000Z') }
  });

  users.set(1, { id: 1, role: 'ADMIN', status: 'ACTIVE' });
  users.set(2, { id: 2, role: 'GIANG_VIEN', status: 'ACTIVE' });

  // Self-action rejection
  await assert.rejects(() => userService.updateUserStatus(1, 'LOCKED', 1), /Bạn không thể tự khóa tài khoản của mình/);

  // User not found
  await assert.rejects(() => userService.updateUserStatus(999, 'LOCKED', 1), /Không tìm thấy tài khoản/);
  await assert.rejects(() => userService.updateUserRole(999, 'GIANG_VIEN'), /Không tìm thấy tài khoản/);
  await assert.rejects(() => userService.deleteUser(999), /Không tìm thấy tài khoản/);
});
