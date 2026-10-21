const {
  ForbiddenError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');
const logger = require('../../../common/logger');
const sanitizeText = require('../../../common/sanitizeText');
const withTransaction = require('../../../common/withTransaction');
const { getPort } = require('../../../contracts');

class GradeService {
  constructor({
    gradeRepository,
    gradebookRepository = null,
    transactionRunner = withTransaction,
    getPortFn = getPort
  } = {}) {
    this.gradeRepository = gradeRepository;
    this.gradebookRepository = gradebookRepository;
    this.withTransaction = transactionRunner;
    this.getPort = getPortFn;
  }

  async _assertCourseOwner(courseId, graderId) {
    const courseAccess = this.getPort('courseAccess', { optional: true });
    if (!courseAccess) {
      logger.warn('Port "courseAccess" chưa sẵn sàng để xác minh quyền chấm bài.');
      throw new ForbiddenError('Không thể xác minh quyền sở hữu khóa học.');
    }

    let isOwner;
    if (typeof courseAccess.isOwner === 'function') {
      isOwner = await courseAccess.isOwner(courseId, graderId);
    } else if (typeof courseAccess.validateCourseOwner === 'function') {
      const result = await courseAccess.validateCourseOwner(courseId, graderId);
      isOwner = result === true || result?.isOwner === true;
    } else {
      logger.warn('Port "courseAccess" không hỗ trợ xác minh chủ khóa học.');
      throw new ForbiddenError('Không thể xác minh quyền sở hữu khóa học.');
    }

    if (!isOwner) {
      throw new ForbiddenError('Chỉ chủ khóa học mới có quyền truy cập bài nộp và chấm điểm.');
    }
  }

  async _findSubmission(submissionId) {
    if (!submissionId) {
      throw new ValidationError('Mã bài nộp là bắt buộc.');
    }
    const submission = await this.gradeRepository.findSubmissionForGradeForUpdate(
      submissionId,
      null
    );
    if (!submission) {
      throw new NotFoundError('Không tìm thấy bài nộp yêu cầu.');
    }
    return submission;
  }

  async _getSubmissionForOwner(submissionId, graderId) {
    const submission = await this._findSubmission(submissionId);
    await this._assertCourseOwner(submission.course_id, graderId);
    return submission;
  }

  async listCourseSubmissions({ courseId, graderId, page = 1, pageSize = 20 }) {
    const pageNumber = Number(page);
    const size = Number(pageSize);
    if (
      !courseId ||
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > 100
    ) {
      throw new ValidationError('Thông số phân trang hoặc mã khóa học không hợp lệ.');
    }

    await this._assertCourseOwner(courseId, graderId);
    const repository = this.gradebookRepository || this.gradeRepository;
    const total = await repository.countSubmissionsByCourse(courseId);
    const rows = await repository.findSubmissionsByCourse(courseId, {
      limit: size,
      offset: (pageNumber - 1) * size
    });

    const studentIds = [...new Set(rows.map((row) => row.student_id))];
    const courseAccess = this.getPort('courseAccess', { optional: true });
    let users = [];
    if (studentIds.length > 0 && typeof courseAccess?.getUsersBrief === 'function') {
      const usersResult = await courseAccess.getUsersBrief(studentIds);
      users = Array.isArray(usersResult) ? usersResult : [];
    } else if (studentIds.length > 0) {
      logger.warn('Port "courseAccess.getUsersBrief" chưa sẵn sàng; trả về ID sinh viên thay tên.');
    }

    const userById = new Map(users.map((user) => [String(user.id), user]));
    const submissions = rows.map((row) => {
      const user = userById.get(String(row.student_id));
      return {
        ...row,
        student_name: user?.fullName || user?.full_name || user?.name || null
      };
    });

    return {
      data: submissions,
      pagination: {
        page: pageNumber,
        page_size: size,
        total,
        total_pages: Math.ceil(total / size)
      }
    };
  }

  async getSubmissionDownload({ submissionId, graderId }) {
    const submission = await this._getSubmissionForOwner(submissionId, graderId);
    return {
      filePath: submission.file_path,
      originalFilename: submission.original_filename,
      mimeType: submission.mime_type
    };
  }

  async gradeSubmission({ submissionId, graderId, score, feedback = '' }) {
    if (
      typeof score === 'string' &&
      !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(score.trim())
    ) {
      throw new ValidationError('Điểm phải là số thập phân hợp lệ.');
    }
    const numericScore = typeof score === 'number' ? score : Number(score);
    if (
      score === '' ||
      score === null ||
      score === undefined ||
      !Number.isFinite(numericScore) ||
      numericScore < 0 ||
      numericScore > 10 ||
      Math.abs(numericScore * 4 - Math.round(numericScore * 4)) > 1e-8
    ) {
      throw new ValidationError('Điểm phải nằm trong khoảng 0–10 và theo bước 0.25 (BR-08).');
    }
    if (typeof feedback !== 'string') {
      throw new ValidationError('Nhận xét phải là chuỗi ký tự.');
    }
    if (!submissionId || !graderId) {
      throw new ValidationError('Mã bài nộp và mã người chấm là bắt buộc.');
    }
    const sanitizedFeedback = sanitizeText(feedback).trim();

    let submission;
    let grade;
    await this.withTransaction(async (connection) => {
      submission = await this.gradeRepository.findSubmissionForGradeForUpdate(
        submissionId,
        connection
      );
      if (!submission) {
        throw new NotFoundError('Không tìm thấy bài nộp yêu cầu.');
      }
      await this._assertCourseOwner(submission.course_id, graderId);
      grade = await this.gradeRepository.upsert(
        {
          submissionId,
          graderId,
          score: numericScore,
          feedback: sanitizedFeedback
        },
        connection
      );
      await this.gradeRepository.markSubmissionGraded(submissionId, connection);
    });

    const notifications = this.getPort('notifications', { optional: true });
    if (typeof notifications?.notifyUser === 'function') {
      try {
        await notifications.notifyUser(submission.student_id, {
          type: 'ASSIGNMENT_GRADED',
          title: 'Bài tập đã được chấm',
          content: `Bài tập của bạn đã được chấm: ${numericScore}/10.`,
          metadata: {
            submissionId: Number(submissionId),
            assignmentId: Number(submission.assignment_id),
            score: numericScore
          }
        });
      } catch (error) {
        logger.warn(
          `Không thể gửi thông báo đã chấm bài cho sinh viên ${submission.student_id}.`,
          { message: error.message }
        );
      }
    } else {
      logger.warn('Port "notifications.notifyUser" chưa sẵn sàng; không gửi được thông báo chấm bài.');
    }

    return grade;
  }
}

module.exports = GradeService;
