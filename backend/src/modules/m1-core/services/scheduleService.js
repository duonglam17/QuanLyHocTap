const {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');
const { logger: defaultLogger, withTransaction: defaultTransaction } = require('../../../common');
const { getPort: defaultGetPort } = require('../../../contracts');
const sanitizeText = require('../../../common/sanitizeText');

const scheduleFields = ['title', 'date', 'startTime', 'endTime', 'roomOrLink'];

function validId(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function normalizeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError('Ngày học phải có định dạng YYYY-MM-DD');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1000 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError('Ngày học không hợp lệ');
  }
  return value;
}

function normalizeTime(value, label) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${label} không hợp lệ`);
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  if (!match) {
    throw new ValidationError(`${label} phải có định dạng HH:mm hoặc HH:mm:ss`);
  }
  return `${match[1]}:${match[2]}:${match[3] || '00'}`;
}

function textField(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${label} không được để trống`);
  }
  const text = sanitizeText(value.trim());
  if (!text || text.length > maxLength) {
    throw new ValidationError(`${label} phải từ 1 đến ${maxLength} ký tự`);
  }
  return text;
}

function validateFields(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Thông tin lịch học không hợp lệ');
  }
  const fields = {};
  for (const field of scheduleFields) {
    if (!Object.hasOwn(input, field)) {
      continue;
    }
    if (field === 'title') {
      fields.title = textField(input.title, 'Tiêu đề buổi học', 200);
    } else if (field === 'roomOrLink') {
      fields.roomOrLink = textField(input.roomOrLink, 'Phòng học hoặc đường dẫn', 255);
    } else if (field === 'date') {
      fields.date = normalizeDate(input.date);
    } else {
      fields[field] = normalizeTime(
        input[field],
        field === 'startTime' ? 'Giờ bắt đầu' : 'Giờ kết thúc'
      );
    }
  }

  if (!partial) {
    for (const field of scheduleFields) {
      if (!Object.hasOwn(fields, field)) {
        throw new ValidationError('Vui lòng nhập đầy đủ thông tin buổi học');
      }
    }
  } else if (Object.keys(fields).length === 0) {
    throw new ValidationError('Cần cung cấp ít nhất một trường để cập nhật');
  }

  if (
    fields.startTime !== undefined &&
    fields.endTime !== undefined &&
    fields.startTime >= fields.endTime
  ) {
    throw new ValidationError('Giờ kết thúc phải sau giờ bắt đầu');
  }
  return fields;
}

class ScheduleService {
  constructor({
    scheduleRepository,
    getPortFn = defaultGetPort,
    transactionRunner = defaultTransaction,
    logger = defaultLogger
  } = {}) {
    this.scheduleRepository = scheduleRepository;
    this.getPort = getPortFn;
    this.withTransaction = transactionRunner;
    this.logger = logger;
  }

  _validateId(value, label) {
    if (!validId(value)) {
      throw new ValidationError(`${label} không hợp lệ`);
    }
    return Number(value);
  }

  async _assertOwner(courseId, userId) {
    const port = this.getPort('courseAccess');
    const course = await port.getCourse(courseId);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học');
    }
    if (!(await port.isOwner(userId, courseId))) {
      throw new ForbiddenError('Chỉ giảng viên chủ khóa học mới được quản lý lịch học');
    }
    if (course.status === 'ARCHIVED') {
      throw new ConflictError('Khóa học đã lưu trữ và chỉ được xem', null, 'COURSE_ARCHIVED');
    }
  }

  async _lockWritableCourse(courseId, userId, connection) {
    const course = await this.scheduleRepository.lockCourse(courseId, connection);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học');
    }
    if (course.ownerId !== Number(userId)) {
      throw new ForbiddenError('Chỉ giảng viên chủ khóa học mới được quản lý lịch học');
    }
    if (course.status === 'ARCHIVED') {
      throw new ConflictError('Khóa học đã lưu trữ và chỉ được xem', null, 'COURSE_ARCHIVED');
    }
  }

  async _notifyCourseStudents(courseId, schedule, message) {
    const notifications = this.getPort('notifications', { optional: true });
    if (!notifications) {
      return;
    }
    const payload = {
      type: 'SCHEDULE_CHANGED',
      title: 'Lịch học được cập nhật',
      message,
      refType: 'schedule',
      refId: schedule.id,
      link: `/courses/${courseId}/schedules`
    };
    try {
      await notifications.notifyCourseStudents(courseId, payload);
    } catch (error) {
      this.logger.error('Không thể gửi thông báo thay đổi lịch học.', error);
    }
  }

  async listForCourse(courseId, user) {
    const id = this._validateId(courseId, 'Mã khóa học');
    const port = this.getPort('courseAccess');
    const course = await port.getCourse(id);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học');
    }
    const isOwner = await port.isOwner(user.id, id);
    const isEnrolled = user.role === 'SINH_VIEN' && (await port.isEnrolled(user.id, id));
    if (!isOwner && !isEnrolled) {
      throw new ForbiddenError(
        'Bạn cần là chủ khóa học hoặc ghi danh để xem thời khóa biểu chi tiết'
      );
    }
    return this.scheduleRepository.listByCourse(id);
  }

  async listStudentSchedule(user, pagination = {}) {
    if (user.role !== 'SINH_VIEN') {
      throw new ForbiddenError('Chỉ sinh viên đã ghi danh mới được xem thời khóa biểu tổng hợp');
    }
    const page = Number(pagination.page ?? 1);
    const limit = Number(pagination.limit ?? 20);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * limit)) {
      throw new ValidationError('Số trang phải là số nguyên dương');
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new ValidationError('Kích thước trang phải từ 1 đến 100');
    }
    const result = await this.scheduleRepository.listForStudent(Number(user.id), { page, limit });
    return { ...result, page, limit };
  }

  async createSchedule(courseId, user, input) {
    const id = this._validateId(courseId, 'Mã khóa học');
    const fields = validateFields(input);
    await this._assertOwner(id, user.id);

    const schedule = await this.withTransaction(async (connection) => {
      await this._lockWritableCourse(id, user.id, connection);
      const conflict = await this.scheduleRepository.findConflict(
        id,
        fields.date,
        fields.startTime,
        fields.endTime,
        {},
        connection
      );
      if (conflict) {
        throw new ConflictError(
          'Khung giờ bị trùng với buổi học đã tồn tại trên hệ thống',
          null,
          'SCHEDULE_CONFLICT'
        );
      }
      return this.scheduleRepository.create(id, fields, connection);
    });
    await this._notifyCourseStudents(id, schedule, 'Một buổi học mới đã được thêm vào lịch.');
    return schedule;
  }

  async updateSchedule(scheduleId, user, input) {
    const id = this._validateId(scheduleId, 'Mã buổi học');
    const fields = validateFields(input, { partial: true });
    const existing = await this.scheduleRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Không tìm thấy buổi học');
    }
    await this._assertOwner(existing.courseId, user.id);

    const schedule = await this.withTransaction(async (connection) => {
      await this._lockWritableCourse(existing.courseId, user.id, connection);
      const current = await this.scheduleRepository.findById(id, connection);
      if (!current || current.courseId !== existing.courseId) {
        throw new NotFoundError('Không tìm thấy buổi học');
      }
      if (current.status === 'CANCELLED') {
        throw new ConflictError(
          'Buổi học đã hủy và không thể chỉnh sửa',
          null,
          'SCHEDULE_CANCELLED'
        );
      }

      const updated = { ...current, ...fields };
      if (updated.startTime >= updated.endTime) {
        throw new ValidationError('Giờ kết thúc phải sau giờ bắt đầu');
      }
      const rescheduled =
        updated.date !== current.date ||
        updated.startTime !== current.startTime ||
        updated.endTime !== current.endTime;
      if (rescheduled) {
        const conflict = await this.scheduleRepository.findConflict(
          current.courseId,
          updated.date,
          updated.startTime,
          updated.endTime,
          { excludeId: id },
          connection
        );
        if (conflict) {
          throw new ConflictError(
            'Khung giờ bị trùng với buổi học đã tồn tại trên hệ thống',
            null,
            'SCHEDULE_CONFLICT'
          );
        }
      }

      return this.scheduleRepository.update(
        id,
        current.courseId,
        {
          ...updated,
          status: rescheduled ? 'RESCHEDULED' : current.status
        },
        connection
      );
    });
    await this._notifyCourseStudents(
      schedule.courseId,
      schedule,
      'Thông tin hoặc thời gian của một buổi học đã được cập nhật.'
    );
    return schedule;
  }

  async cancelSchedule(scheduleId, user) {
    const id = this._validateId(scheduleId, 'Mã buổi học');
    const existing = await this.scheduleRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Không tìm thấy buổi học');
    }
    await this._assertOwner(existing.courseId, user.id);

    const result = await this.withTransaction(async (connection) => {
      await this._lockWritableCourse(existing.courseId, user.id, connection);
      const current = await this.scheduleRepository.findById(id, connection);
      if (!current || current.courseId !== existing.courseId) {
        throw new NotFoundError('Không tìm thấy buổi học');
      }
      if (current.status === 'CANCELLED') {
        return { schedule: current, changed: false };
      }
      const schedule = await this.scheduleRepository.setStatus(
        id,
        current.courseId,
        'CANCELLED',
        connection
      );
      return { schedule, changed: true };
    });
    if (result.changed) {
      await this._notifyCourseStudents(
        result.schedule.courseId,
        result.schedule,
        'Một buổi học đã bị hủy.'
      );
    }
    return result.schedule;
  }
}

module.exports = { ScheduleService };
