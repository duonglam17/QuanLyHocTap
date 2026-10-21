const { ForbiddenError, NotFoundError, ValidationError } = require('../../../common/errors');
const logger = require('../../../common/logger');
const storage = require('../../../common/storage');
const withTransaction = require('../../../common/withTransaction');
const { getPort } = require('../../../contracts');

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

class SubmissionService {
  constructor({
    submissionRepository,
    storageClient = storage,
    transactionRunner = withTransaction,
    clock = null,
    fileSystem = null,
    getPortFn = getPort
  } = {}) {
    this.submissionRepository = submissionRepository;
    this.storage = storageClient;
    this.withTransaction = transactionRunner;
    this.clock = clock || { now: () => new Date() };
    this.fileSystem = fileSystem || require('fs').promises;
    this.getPort = getPortFn;
  }

  async _assertEnrollment(courseId, studentId) {
    const courseAccessPort = this.getPort('courseAccess', { optional: true });
    if (!courseAccessPort || typeof courseAccessPort.validateEnrollment !== 'function') {
      logger.warn('Port "courseAccess" chưa sẵn sàng để xác minh ghi danh.');
      throw new ForbiddenError('Không thể xác minh quyền ghi danh khóa học.');
    }

    const enrollment = await courseAccessPort.validateEnrollment(courseId, studentId);
    if (enrollment !== true && enrollment?.enrolled !== true) {
      throw new ForbiddenError('Sinh viên chưa ghi danh vào khóa học này (BR-05).');
    }

    const courseStatus =
      enrollment?.course?.status || enrollment?.courseStatus || enrollment?.status;
    if (
      courseStatus === 'ARCHIVED' ||
      enrollment?.course?.deleted_at ||
      enrollment?.course?.deletedAt
    ) {
      throw new ForbiddenError('Không thể nộp bài cho khóa học đã lưu trữ.');
    }

    if (typeof courseAccessPort.assertCourseWritable === 'function') {
      await courseAccessPort.assertCourseWritable(courseId);
    } else if (typeof courseAccessPort.isCourseWritable === 'function') {
      if (!(await courseAccessPort.isCourseWritable(courseId))) {
        throw new ForbiddenError('Không thể nộp bài cho khóa học đã lưu trữ hoặc chỉ đọc.');
      }
    } else if (typeof courseAccessPort.getCourse === 'function') {
      const course = await courseAccessPort.getCourse(courseId);
      if (!course || course.status === 'ARCHIVED' || course.deleted_at || course.deletedAt) {
        throw new ForbiddenError('Không thể nộp bài cho khóa học đã lưu trữ.');
      }
    }
  }

  async _removeFile(filePath, reason) {
    try {
      await this.fileSystem.rm(filePath, { force: true });
    } catch (error) {
      logger.error(`Không thể dọn tệp bài nộp ${reason}.`, error);
    }
  }

  async submitAssignment({ assignmentId, studentId, upload }) {
    if (!assignmentId || !studentId) {
      throw new ValidationError('Mã bài tập và mã sinh viên là bắt buộc.');
    }
    if (!upload || !Buffer.isBuffer(upload.buffer) || upload.buffer.length === 0) {
      throw new ValidationError('Vui lòng đính kèm tệp bài làm.');
    }
    if (upload.buffer.length > MAX_UPLOAD_BYTES) {
      throw new ValidationError('Tệp bài nộp không được vượt quá 20MB.');
    }

    const now = this.clock.now();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
      throw new TypeError('Clock provider phải trả về Date hợp lệ.');
    }

    let savedFile = null;
    let previousFilePath = null;
    try {
      const submission = await this.withTransaction(async (connection) => {
        const assignment = await this.submissionRepository.findAssignmentForUpdate(
          assignmentId,
          connection
        );
        if (!assignment) {
          throw new NotFoundError('Không tìm thấy bài tập yêu cầu.');
        }
        if (assignment.status !== 'OPEN') {
          throw new ForbiddenError('Bài tập hiện không nhận bài nộp.');
        }
        await this._assertEnrollment(assignment.course_id, studentId);

        const existing = await this.submissionRepository.findByAssignmentAndStudentForUpdate(
          assignmentId,
          studentId,
          connection
        );
        previousFilePath = existing?.filePath || existing?.file_path || null;

        const deadline = new Date(assignment.deadline);
        if (Number.isNaN(deadline.getTime())) {
          throw new Error(`Bài tập ${assignmentId} có hạn nộp không hợp lệ.`);
        }

        const isLate = now.getTime() > deadline.getTime();
        const allowLate = Boolean(assignment.allow_late_submission ?? assignment.allow_late);
        if (isLate && !allowLate) {
          throw new ForbiddenError('Đã quá hạn nộp bài và bài tập không cho phép nộp trễ (BR-07).');
        }

        savedFile = await this.storage.saveFile({
          buffer: upload.buffer,
          originalName: upload.originalname,
          subdirectory: 'submissions'
        });

        const lateMinutes = isLate
          ? Math.ceil((now.getTime() - deadline.getTime()) / 60_000)
          : 0;
        return this.submissionRepository.upsert(
          {
            assignmentId,
            studentId,
            file: savedFile,
            submittedAt: now,
            isLate,
            lateMinutes,
            status: isLate ? 'SUBMITTED_LATE' : 'SUBMITTED'
          },
          connection
        );
      });

      if (previousFilePath && previousFilePath !== savedFile.filePath) {
        await this._removeFile(previousFilePath, 'cũ sau khi nộp lại');
      }
      return submission;
    } catch (error) {
      if (savedFile?.filePath) {
        await this._removeFile(savedFile.filePath, 'mồ côi sau khi lưu database thất bại');
      }
      throw error;
    }
  }
}

module.exports = SubmissionService;
