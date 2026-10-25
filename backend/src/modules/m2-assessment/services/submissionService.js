const {
  ForbiddenError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');
const logger = require('../../../common/logger');
const storage = require('../../../common/storage');
const withTransaction = require('../../../common/withTransaction');
const { getPort } = require('../../../contracts');

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.zip', '.rar'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/vnd.rar'
];

class SubmissionService {
  constructor({
    submissionRepository,
    storageClient = storage,
    transactionRunner = withTransaction,
    clock = null,
    getPortFn = getPort
  } = {}) {
    this.submissionRepository = submissionRepository;
    this.storage = storageClient;
    this.withTransaction = transactionRunner;
    this.clock = clock || { now: () => new Date() };
    this.getPort = getPortFn;
  }

  async _assertEnrollment(courseId, studentId, { writable = true } = {}) {
    const numericCourseId = Number(courseId);
    const courseAccessPort = this.getPort('courseAccess', { optional: true });
    if (
      !courseAccessPort ||
      typeof courseAccessPort.getCourse !== 'function' ||
      typeof courseAccessPort.isEnrolled !== 'function' ||
      (writable && typeof courseAccessPort.assertCourseWritable !== 'function')
    ) {
      logger.warn('Port "courseAccess" chưa sẵn sàng để xác minh ghi danh.');
      throw new ForbiddenError('Không thể xác minh quyền ghi danh khóa học.');
    }

    const course = await courseAccessPort.getCourse(numericCourseId);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học yêu cầu.');
    }
    if (!(await courseAccessPort.isEnrolled(Number(studentId), numericCourseId))) {
      throw new ForbiddenError('Sinh viên chưa ghi danh vào khóa học này (BR-05).');
    }
    if (writable) await courseAccessPort.assertCourseWritable(numericCourseId);
  }

  async getMySubmission({ assignmentId, studentId }) {
    const numericAssignmentId = Number(assignmentId);
    const numericStudentId = Number(studentId);
    if (
      !Number.isSafeInteger(numericAssignmentId) ||
      numericAssignmentId <= 0 ||
      !Number.isSafeInteger(numericStudentId) ||
      numericStudentId <= 0
    ) {
      throw new ValidationError('Mã bài tập và mã sinh viên là bắt buộc.');
    }

    const assignment = await this.submissionRepository.findAssignment(numericAssignmentId);
    if (!assignment) throw new NotFoundError('Không tìm thấy bài tập yêu cầu.');
    await this._assertEnrollment(assignment.course_id, numericStudentId, { writable: false });
    return this.submissionRepository.findByAssignmentAndStudent(
      numericAssignmentId,
      numericStudentId
    );
  }

  async _removeFile(storedName, reason) {
    try {
      await this.storage.deleteFile(storedName);
    } catch (error) {
      logger.error(`Không thể dọn tệp bài nộp ${reason}.`, error);
    }
  }

  async submitAssignment({ assignmentId, studentId, upload }) {
    const numericAssignmentId = Number(assignmentId);
    const numericStudentId = Number(studentId);
    if (
      !Number.isSafeInteger(numericAssignmentId) ||
      numericAssignmentId <= 0 ||
      !Number.isSafeInteger(numericStudentId) ||
      numericStudentId <= 0
    ) {
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
          numericAssignmentId,
          connection
        );
        if (!assignment) {
          throw new NotFoundError('Không tìm thấy bài tập yêu cầu.');
        }
        if (assignment.status !== 'OPEN') {
          throw new ForbiddenError('Bài tập hiện không nhận bài nộp.');
        }
        await this._assertEnrollment(assignment.course_id, numericStudentId);

        const existing = await this.submissionRepository.findByAssignmentAndStudentForUpdate(
          numericAssignmentId,
          numericStudentId,
          connection
        );
        previousFilePath = existing?.filePath || existing?.file_path || null;

        const deadline = new Date(assignment.deadline);
        if (Number.isNaN(deadline.getTime())) {
          throw new Error(`Bài tập ${numericAssignmentId} có hạn nộp không hợp lệ.`);
        }

        const isLate = now.getTime() > deadline.getTime();
        const allowLate = Boolean(assignment.allow_late_submission ?? assignment.allow_late);
        if (isLate && !allowLate) {
          throw new ForbiddenError('Đã quá hạn nộp bài và bài tập không cho phép nộp trễ (BR-07).');
        }

        const storedFile = await this.storage.saveUpload(upload, {
          allowedExt: ALLOWED_EXTENSIONS,
          allowedMime: ALLOWED_MIME_TYPES,
          maxBytes: MAX_UPLOAD_BYTES
        });
        savedFile = {
          originalFilename: storedFile.originalName,
          fileUuid: storedFile.storedName.slice(0, storedFile.storedName.lastIndexOf('.')),
          filePath: storedFile.storedName,
          fileSizeBytes: storedFile.size,
          mimeType: storedFile.mime
        };

        const lateMinutes = isLate
          ? Math.ceil((now.getTime() - deadline.getTime()) / 60_000)
          : 0;
        return this.submissionRepository.upsert(
          {
            assignmentId: numericAssignmentId,
            studentId: numericStudentId,
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
