/**
 * LMS Mini - Module M2 Assessment
 * Assignment Service
 * Xử lý toàn bộ logic nghiệp vụ của US-07: Giao bài tập
 */

const { getPort } = require('../../../contracts');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError
} = require('../../../common/errors');
const logger = require('../../../common/logger');
const { sanitizeText } = require('../utils/sanitizer');

function invalidField(field, message) {
  return new ValidationError(message, [{ field, message }]);
}

class AssignmentService {
  constructor({
    assignmentRepository,
    dbClient = null,
    clock = null,
    getPortFn = null
  } = {}) {
    this.assignmentRepository = assignmentRepository;
    this.db = dbClient || require('../../../common/db');
    this.clock = clock || { now: () => new Date() };
    this.getPort = getPortFn || getPort;
  }

  /**
   * Kiểm tra quyền sở hữu khóa học qua Port courseAccess (BR-03)
   */
  async _assertCourseOwner(courseId, instructorId, courseAccessPort) {
    if (
      !courseAccessPort ||
      typeof courseAccessPort.getCourse !== 'function' ||
      typeof courseAccessPort.isOwner !== 'function'
    ) {
      logger.warn('Port "courseAccess" chưa được đăng ký; không thể xác minh quyền sở hữu khóa học.');
      throw new ForbiddenError('Không thể xác minh quyền sở hữu khóa học.');
    }

    const course = await courseAccessPort.getCourse(courseId);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học yêu cầu.');
    }
    if (!(await courseAccessPort.isOwner(instructorId, courseId))) {
      throw new ForbiddenError('Chỉ chủ khóa học mới có quyền thực hiện thao tác này (BR-03).');
    }
  }

  async _assertCourseMember(courseId, userId, courseAccessPort) {
    if (
      !userId ||
      !courseAccessPort ||
      typeof courseAccessPort.getCourse !== 'function' ||
      typeof courseAccessPort.isOwner !== 'function' ||
      typeof courseAccessPort.isEnrolled !== 'function'
    ) {
      throw new ForbiddenError('Không thể xác minh quyền truy cập khóa học.');
    }

    const course = await courseAccessPort.getCourse(courseId);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học yêu cầu.');
    }
    if (
      !(await courseAccessPort.isOwner(userId, courseId)) &&
      !(await courseAccessPort.isEnrolled(userId, courseId))
    ) {
      throw new ForbiddenError('Bạn không phải chủ khóa hoặc sinh viên đã ghi danh.');
    }
  }

  /**
   * Kiểm tra khóa học còn quyền ghi (assertCourseWritable)
   * Không cho phép tạo bài tập trong khóa học đã ARCHIVED hoặc chỉ đọc
   */
  async _assertCourseWritable(courseId, courseAccessPort) {
    if (!courseAccessPort || typeof courseAccessPort.assertCourseWritable !== 'function') {
      throw new ForbiddenError('Không thể xác minh khóa học còn quyền ghi.');
    }
    await courseAccessPort.assertCourseWritable(courseId);
  }

  async _withTransaction(work) {
    const pool = typeof this.db.getPool === 'function' ? this.db.getPool() : null;
    if (!pool || typeof pool.getConnection !== 'function') {
      return work(null);
    }

    const connection = await pool.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (err) {
      if (transactionStarted) {
        try {
          await connection.rollback();
        } catch (rollbackErr) {
          logger.error('Không thể rollback transaction bài tập:', rollbackErr);
        }
      }
      logger.error('Lỗi transaction bài tập:', err);
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * US-07: Giảng viên tạo và giao bài tập tự luận
   */
  async createAssignment({
    courseId,
    instructorId,
    title,
    description = '',
    dueDate,
    deadline,
    maxScore = 10.0,
    allowLateSubmission = false,
    allowLate = false
  }) {
    // 1. Kiểm tra tham số cơ bản
    const numericCourseId = Number(courseId);
    if (!Number.isSafeInteger(numericCourseId) || numericCourseId <= 0) {
      throw invalidField('courseId', 'Mã khóa học là bắt buộc.');
    }
    if (!instructorId) {
      throw new ForbiddenError('Yêu cầu định danh giảng viên.');
    }
    if (!title || typeof title !== 'string' || title.trim() === '') {
      throw invalidField('title', 'Tiêu đề bài tập không được để trống.');
    }

    // 2. Sanitize tiêu đề và mô tả (BR-18)
    const sanitizedTitle = sanitizeText(title);
    if (typeof description !== 'string') {
      throw invalidField('description', 'Mô tả bài tập phải là chuỗi ký tự.');
    }
    const sanitizedDescription = sanitizeText(description);

    if (typeof sanitizedDescription !== 'string') {
      throw invalidField('description', 'Mô tả bài tập phải là chuỗi ký tự.');
    }
    if (sanitizedTitle.length === 0) {
      throw invalidField('title', 'Tiêu đề bài tập không hợp lệ sau khi làm sạch.');
    }
    if (sanitizedTitle.length > 200) {
      throw invalidField('title', 'Tiêu đề bài tập không được vượt quá 200 ký tự.');
    }

    // 3. Kiểm tra hạn nộp (due_date phải sau clock.now())
    const targetDueDate = dueDate || deadline;
    if (!targetDueDate) {
      throw invalidField('due_date', 'Hạn nộp bài tập là bắt buộc.');
    }

    const dueDateObj = new Date(targetDueDate);
    if (isNaN(dueDateObj.getTime())) {
      throw invalidField('due_date', 'Hạn nộp bài tập không đúng định dạng thời gian.');
    }

    const currentTime = this.clock.now();
    if (dueDateObj <= currentTime) {
      throw invalidField('due_date', 'Hạn nộp bài tập phải sau thời điểm hiện tại.');
    }

    // 4. Kiểm tra thang điểm (Mặc định 10.0, trong khoảng [0.25, 10.0])
    const numericMaxScore = maxScore !== undefined && maxScore !== null ? Number(maxScore) : 10.0;
    if (isNaN(numericMaxScore) || numericMaxScore <= 0 || numericMaxScore > 10.0) {
      throw invalidField('max_score', 'Điểm tối đa phải lớn hơn 0 và không vượt quá 10.');
    }

    const lateSubmissionFlag =
      allowLateSubmission !== undefined ? allowLateSubmission : allowLate;
    if (typeof lateSubmissionFlag !== 'boolean') {
      throw invalidField('allow_late_submission', 'Cho phép nộp trễ phải là giá trị có/không.');
    }
    const finalAllowLate = lateSubmissionFlag;

    // 5. Kiểm tra quyền sở hữu & tính khả ghi qua Port courseAccess
    const courseAccessPort = this.getPort('courseAccess', { optional: true });
    await this._assertCourseOwner(numericCourseId, instructorId, courseAccessPort);
    await this._assertCourseWritable(numericCourseId, courseAccessPort);

    // 6. Thực thi ghi dữ liệu trong Database Transaction
    const createdAssignment = await this._withTransaction((connection) =>
      this.assignmentRepository.create(
        {
          courseId: numericCourseId,
          createdBy: instructorId,
          title: sanitizedTitle,
          description: sanitizedDescription,
          dueDate: dueDateObj,
          maxScore: numericMaxScore,
          allowLateSubmission: finalAllowLate,
          status: 'OPEN'
        },
        connection
      )
    );

    // 7. Gọi Port notifications.notifyCourseStudents SAU KHI commit thành công
    const notificationsPort = this.getPort('notifications', { optional: true });
    if (notificationsPort && typeof notificationsPort.notifyCourseStudents === 'function') {
      try {
        await notificationsPort.notifyCourseStudents(numericCourseId, {
          type: 'NEW_ASSIGNMENT',
          title: `Bài tập mới: ${createdAssignment.title}`,
          message: `Giảng viên đã giao bài tập mới "${createdAssignment.title}" với hạn nộp là ${dueDateObj.toISOString()}.`,
          refType: 'ASSIGNMENT',
          refId: createdAssignment.id,
          link: `/courses/${numericCourseId}/assignments/${createdAssignment.id}`
        });
      } catch (notifyErr) {
        logger.warn(`Gửi thông báo bài tập mới qua NotificationsPort thất bại cho khóa học ${courseId}:`, notifyErr);
      }
    } else {
      logger.info('Port "notifications" chưa được đăng ký hoặc không hỗ trợ notifyCourseStudents.');
    }

    return createdAssignment;
  }

  /**
   * Lấy chi tiết bài tập theo ID
   */
  async getAssignmentById(id, user) {
    const assignment = await this.assignmentRepository.findById(id);
    if (!assignment) {
      throw new NotFoundError('Không tìm thấy bài tập yêu cầu.');
    }

    if (user?.role === 'ADMIN') return assignment;
    const courseAccessPort = this.getPort('courseAccess', { optional: true });
    if (user?.role === 'GIANG_VIEN') {
      await this._assertCourseOwner(assignment.courseId, user.id, courseAccessPort);
    } else if (user?.role === 'SINH_VIEN') {
      if (
        !courseAccessPort ||
        typeof courseAccessPort.getCourse !== 'function' ||
        typeof courseAccessPort.isEnrolled !== 'function'
      ) {
        logger.warn('Port "courseAccess" chưa sẵn sàng để xác minh ghi danh.');
        throw new ForbiddenError('Không thể xác minh quyền ghi danh khóa học.');
      }
      const course = await courseAccessPort.getCourse(assignment.courseId);
      if (!course) throw new NotFoundError('Không tìm thấy khóa học yêu cầu.');
      if (!(await courseAccessPort.isEnrolled(user.id, assignment.courseId))) {
        throw new ForbiddenError('Sinh viên chưa ghi danh vào khóa học này.');
      }
    } else {
      throw new ForbiddenError('Bạn không có quyền xem bài tập này.');
    }
    return assignment;
  }

  /**
   * Lấy danh sách bài tập theo khóa học
   */
  async getAssignmentsByCourseId(courseId, user) {
    if (!Number.isSafeInteger(Number(courseId)) || Number(courseId) <= 0) {
      throw invalidField('courseId', 'Mã khóa học là bắt buộc.');
    }

    const courseAccessPort = this.getPort('courseAccess', { optional: true });
    await this._assertCourseMember(Number(courseId), user?.id, courseAccessPort);
    return this.assignmentRepository.findByCourseId(courseId, {
      studentId: user?.role === 'SINH_VIEN' ? user.id : null
    });
  }

  async updateAssignment(assignmentId, instructorId, changes) {
    const assignment = await this.getAssignmentById(assignmentId, {
      id: instructorId,
      role: 'GIANG_VIEN'
    });
    const courseAccessPort = this.getPort('courseAccess', { optional: true });
    await this._assertCourseWritable(assignment.courseId, courseAccessPort);

    const update = {};
    if (Object.hasOwn(changes, 'title')) {
      if (typeof changes.title !== 'string' || changes.title.trim() === '') {
        throw invalidField('title', 'Tiêu đề bài tập không được để trống.');
      }
      const title = sanitizeText(changes.title);
      if (!title || title.length > 200) {
        throw invalidField('title', 'Tiêu đề bài tập phải có tối đa 200 ký tự.');
      }
      update.title = title;
    }
    if (Object.hasOwn(changes, 'description')) {
      if (typeof changes.description !== 'string') {
        throw invalidField('description', 'Mô tả bài tập phải là chuỗi ký tự.');
      }
      update.description = sanitizeText(changes.description);
    }
    if (Object.hasOwn(changes, 'dueDate')) {
      const dueDate = new Date(changes.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        throw invalidField('due_date', 'Hạn nộp bài tập không đúng định dạng thời gian.');
      }
      const previousDueDate = new Date(assignment.dueDate);
      if (
        dueDate.getTime() !== previousDueDate.getTime() &&
        dueDate.getTime() <= this.clock.now().getTime()
      ) {
        throw invalidField('due_date', 'Hạn nộp bài tập phải sau thời điểm hiện tại.');
      }
      update.dueDate = dueDate;
    }
    if (Object.hasOwn(changes, 'maxScore')) {
      const maxScore = Number(changes.maxScore);
      if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 10) {
        throw invalidField('max_score', 'Điểm tối đa phải lớn hơn 0 và không vượt quá 10.');
      }
      update.maxScore = maxScore;
    }
    if (Object.hasOwn(changes, 'allowLateSubmission')) {
      if (typeof changes.allowLateSubmission !== 'boolean') {
        throw invalidField('allow_late_submission', 'Cho phép nộp trễ phải là giá trị có/không.');
      }
      update.allowLateSubmission = changes.allowLateSubmission;
    }
    if (Object.keys(update).length === 0) {
      throw invalidField('assignment', 'Cần cung cấp ít nhất một trường để cập nhật.');
    }

    const updatedFields = {
      title: update.title ?? assignment.title,
      description: update.description ?? assignment.description,
      dueDate: update.dueDate ?? assignment.dueDate,
      maxScore: update.maxScore ?? assignment.maxScore,
      allowLateSubmission:
        update.allowLateSubmission ?? assignment.allowLateSubmission
    };

    return this._withTransaction(async (connection) => {
      const updated = await this.assignmentRepository.update(
        assignment.id,
        updatedFields,
        connection
      );
      if (!updated) {
        throw new NotFoundError('Không tìm thấy bài tập yêu cầu.');
      }
      return this.assignmentRepository.findById(assignment.id, connection);
    });
  }

  /**
   * Xóa bài tập có kiểm tra EC-09:
   * - Nếu bài tập đã có bài nộp: Tuyệt đối không xóa cứng (Hard Delete), chỉ cho phép xóa mềm.
   */
  async deleteAssignment(assignmentId, instructorId) {
    const assignment = await this.getAssignmentById(assignmentId, {
      id: instructorId,
      role: 'GIANG_VIEN'
    });

    // Kiểm tra quyền sở hữu khóa học
    const courseAccessPort = this.getPort('courseAccess', { optional: true });
    await this._assertCourseOwner(assignment.courseId, instructorId, courseAccessPort);
    await this._assertCourseWritable(assignment.courseId, courseAccessPort);

    // Đếm số bài nộp liên quan
    return this._withTransaction(async (connection) => {
      const submissionCount = await this.assignmentRepository.countSubmissions(
        assignmentId,
        connection
      );
      await this.assignmentRepository.softDelete(assignmentId, connection);

      if (submissionCount > 0) {
        logger.info(
          `Bài tập id=${assignmentId} đã có ${submissionCount} bài nộp; áp dụng xóa mềm (EC-09).`
        );
        return {
          id: assignmentId,
          deleted: true,
          softDeleted: true,
          message:
            'Bài tập đã có bài nộp của sinh viên nên được chuyển sang trạng thái lưu trữ (xóa mềm).'
        };
      }

      return {
        id: assignmentId,
        deleted: true,
        softDeleted: true,
        message: 'Đã xóa bài tập thành công.'
      };
    });
  }
}

module.exports = AssignmentService;
