const crypto = require('node:crypto');
const {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');
const { clock: defaultClock, withTransaction: defaultTransaction } = require('../../../common');
const { getPort: defaultGetPort } = require('../../../contracts');
const sanitizeText = require('../../../common/sanitizeText');

const enrollmentKeyAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const enrollmentKeyPattern = /^[A-Za-z0-9]{6,8}$/;

function isDuplicateEntry(error) {
  return error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062;
}

class CourseService {
  constructor({
    courseRepository,
    enrollmentRepository,
    clock = defaultClock,
    transactionRunner = defaultTransaction,
    getPortFn = defaultGetPort,
    keyGenerator = () =>
      Array.from(
        { length: 6 },
        () => enrollmentKeyAlphabet[crypto.randomInt(enrollmentKeyAlphabet.length)]
      ).join('')
  } = {}) {
    this.courseRepository = courseRepository;
    this.enrollmentRepository = enrollmentRepository;
    this.clock = clock;
    this.withTransaction = transactionRunner;
    this.getPort = getPortFn;
    this.keyGenerator = keyGenerator;
  }

  _validateCourseFields(data, { partial = false } = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ValidationError('Thông tin khóa học không hợp lệ');
    }
    const fields = ['code', 'title', 'description', 'semester', 'enrollmentKey'];
    const result = {};
    for (const field of fields) {
      if (!Object.hasOwn(data, field)) {
        continue;
      }
      const value = data[field];
      if (field === 'description') {
        if (value !== null && typeof value !== 'string') {
          throw new ValidationError('Mô tả khóa học không hợp lệ');
        }
        result.description = value === null ? null : sanitizeText(value.trim());
        continue;
      }
      if (typeof value !== 'string' || !value.trim()) {
        throw new ValidationError(`${field} không được để trống`);
      }
      const normalized = value.trim();
      if (field === 'code' && normalized.length > 20) {
        throw new ValidationError('Mã môn học tối đa 20 ký tự');
      }
      if (field === 'title' && normalized.length > 200) {
        throw new ValidationError('Tên khóa học tối đa 200 ký tự');
      }
      if (field === 'semester' && normalized.length > 20) {
        throw new ValidationError('Học kỳ tối đa 20 ký tự');
      }
      if (field === 'enrollmentKey' && !enrollmentKeyPattern.test(normalized)) {
        throw new ValidationError('Mã ghi danh phải gồm 6-8 chữ cái hoặc chữ số');
      }
      if (field === 'title') {
        const title = sanitizeText(normalized);
        if (!title) {
          throw new ValidationError('Tên khóa học không được để trống');
        }
        result.title = title;
      } else {
        result[field] = normalized;
      }
    }
    if (!partial) {
      for (const field of ['code', 'title', 'semester']) {
        if (!result[field]) {
          throw new ValidationError(`${field} không được để trống`);
        }
      }
    }
    return result;
  }

  async _findCourse(courseId) {
    if (!Number.isSafeInteger(Number(courseId)) || Number(courseId) < 1) {
      throw new ValidationError('Mã khóa học không hợp lệ');
    }
    const course = await this.courseRepository.findById(Number(courseId));
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học');
    }
    return course;
  }

  async _assertOwner(course, userId) {
    if (Number(course.ownerId) !== Number(userId)) {
      throw new ForbiddenError('Chỉ chủ khóa học mới có quyền thực hiện thao tác này');
    }
  }

  _assertNotArchived(course) {
    if (course.status === 'ARCHIVED') {
      throw new ConflictError('Khóa học đã lưu trữ và chỉ được xem', null, 'COURSE_ARCHIVED');
    }
  }

  async listCourses(user) {
    const courses = await this.courseRepository.findForUser(user.id, user.role);
    if (user.role !== 'SINH_VIEN') {
      return courses;
    }
    return courses.map((course) => {
      const visibleCourse = { ...course };
      delete visibleCourse.enrollment_key;
      return visibleCourse;
    });
  }

  async getCourse(courseId, user) {
    const course = await this._findCourse(courseId);
    if (
      user.role !== 'ADMIN' &&
      Number(course.ownerId) !== Number(user.id) &&
      !(await this.courseRepository.isEnrolled(user.id, course.id))
    ) {
      throw new ForbiddenError('Bạn không có quyền xem khóa học này');
    }
    if (user.role === 'SINH_VIEN') {
      const visibleCourse = { ...course };
      delete visibleCourse.enrollment_key;
      return visibleCourse;
    }
    return course;
  }

  async createCourse(instructorId, input) {
    const fields = this._validateCourseFields(input);
    const hasCustomKey = Boolean(fields.enrollmentKey);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const enrollmentKey = fields.enrollmentKey || this.keyGenerator();
      if (!enrollmentKeyPattern.test(enrollmentKey)) {
        throw new TypeError('Bộ sinh mã ghi danh phải tạo mã gồm 6-8 ký tự.');
      }
      try {
        return await this.courseRepository.create({
          ...fields,
          description: fields.description ?? null,
          ownerId: instructorId,
          enrollmentKey
        });
      } catch (error) {
        if (!isDuplicateEntry(error)) {
          throw error;
        }
        if (hasCustomKey) {
          throw new ConflictError('Mã ghi danh đã được sử dụng', null, 'ENROLLMENT_KEY_EXISTS');
        }
      }
    }
    throw new ConflictError(
      'Không thể tạo mã ghi danh duy nhất, vui lòng thử lại',
      null,
      'ENROLLMENT_KEY_GENERATION_FAILED'
    );
  }

  async updateCourse(courseId, instructorId, input) {
    const fields = this._validateCourseFields(input, { partial: true });
    if (Object.keys(fields).length === 0) {
      throw new ValidationError('Cần cung cấp ít nhất một trường để cập nhật');
    }
    const course = await this._findCourse(courseId);
    await this._assertOwner(course, instructorId);
    this._assertNotArchived(course);
    try {
      return await this.courseRepository.update(course.id, fields);
    } catch (error) {
      if (isDuplicateEntry(error) && fields.enrollmentKey) {
        throw new ConflictError('Mã ghi danh đã được sử dụng', null, 'ENROLLMENT_KEY_EXISTS');
      }
      throw error;
    }
  }

  async publishCourse(courseId, instructorId) {
    const course = await this._findCourse(courseId);
    await this._assertOwner(course, instructorId);
    this._assertNotArchived(course);
    if (course.status === 'PUBLISHED') {
      return course;
    }
    return this.courseRepository.updateStatus(course.id, 'PUBLISHED');
  }

  async archiveCourse(courseId, user) {
    const course = await this._findCourse(courseId);
    if (user.role !== 'ADMIN') {
      await this._assertOwner(course, user.id);
    }
    if (course.status === 'ARCHIVED') {
      return course;
    }
    return this.courseRepository.updateStatus(course.id, 'ARCHIVED');
  }

  async deleteCourse(courseId, instructorId) {
    const course = await this._findCourse(courseId);
    await this._assertOwner(course, instructorId);
    if (course.status === 'ARCHIVED') {
      return { courseId: course.id, status: 'ARCHIVED', archived: true };
    }

    const m1HasData = await this.courseRepository.hasM1CourseData(course.id);
    const assessmentUsage = this.getPort('assessmentUsage', { optional: true });
    const quizUsage = this.getPort('quizUsage', { optional: true });
    const otherModuleHasData =
      !assessmentUsage ||
      !quizUsage ||
      (await assessmentUsage.hasCourseData(course.id)) ||
      (await quizUsage.hasCourseData(course.id));

    if (m1HasData || otherModuleHasData) {
      await this.courseRepository.updateStatus(course.id, 'ARCHIVED');
      return { courseId: course.id, status: 'ARCHIVED', archived: true };
    }

    await this.courseRepository.softDelete(course.id, this.clock.now());
    return { courseId: course.id, status: course.status, archived: false, deleted: true };
  }

  async enrollByCode(studentId, enrollmentKey) {
    if (typeof enrollmentKey !== 'string' || !enrollmentKey.trim()) {
      throw new BadRequestError('Vui lòng nhập mã ghi danh');
    }
    const key = enrollmentKey.trim();
    if (!enrollmentKeyPattern.test(key)) {
      throw new NotFoundError('Mã ghi danh không tồn tại hoặc khóa học chưa xuất bản');
    }

    try {
      return await this.withTransaction(async (connection) => {
        const course = await this.enrollmentRepository.findPublishedCourseByKey(key, connection);
        if (!course) {
          throw new NotFoundError('Mã ghi danh không tồn tại hoặc khóa học chưa xuất bản');
        }
        const existing = await this.enrollmentRepository.findEnrollment(
          course.id,
          studentId,
          connection
        );
        if (existing) {
          throw new ConflictError(
            'Bạn đã là thành viên của khóa học này',
            {
              courseId: Number(course.id)
            },
            'ALREADY_ENROLLED'
          );
        }
        const enrollment = await this.enrollmentRepository.create(course.id, studentId, connection);
        return {
          enrollment,
          course: { id: Number(course.id), title: course.title }
        };
      });
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new ConflictError('Bạn đã là thành viên của khóa học này', null, 'ALREADY_ENROLLED');
      }
      throw error;
    }
  }

  async removeEnrollment(courseId, studentId, user) {
    const course = await this._findCourse(courseId);
    if (!Number.isSafeInteger(Number(studentId)) || Number(studentId) < 1) {
      throw new ValidationError('Mã sinh viên không hợp lệ');
    }
    if (user.role !== 'ADMIN') {
      await this._assertOwner(course, user.id);
    }
    const enrollment = await this.enrollmentRepository.findEnrollment(course.id, studentId);
    if (!enrollment) {
      throw new NotFoundError('Không tìm thấy đăng ký khóa học');
    }

    const assessmentUsage = this.getPort('assessmentUsage', { optional: true });
    const quizUsage = this.getPort('quizUsage', { optional: true });
    const studentHasData =
      !assessmentUsage ||
      !quizUsage ||
      (await assessmentUsage.hasUserData(Number(studentId))) ||
      (await quizUsage.hasUserData(Number(studentId)));
    if (studentHasData) {
      throw new ConflictError(
        'Không thể hủy ghi danh khi sinh viên đã có dữ liệu bài tập hoặc trắc nghiệm',
        null,
        'STUDENT_HAS_COURSEWORK'
      );
    }

    const removed = await this.withTransaction((connection) =>
      this.enrollmentRepository.delete(course.id, Number(studentId), connection)
    );
    if (!removed) {
      throw new ConflictError('Đăng ký khóa học đã được thay đổi', null, 'ENROLLMENT_CHANGED');
    }
  }
}

module.exports = CourseService;
