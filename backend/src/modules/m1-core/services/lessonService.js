const cron = require('node-cron');
const {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');
const { logger, sanitizeText, storage: defaultStorage } = require('../../../common');
const { getPort: defaultGetPort } = require('../../../contracts');

const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.zip', '.rar'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.rar'
];

function validId(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function publicMaterial(material) {
  const visible = { ...material };
  delete visible.storedName;
  return visible;
}

class LessonService {
  constructor({
    lessonRepository,
    materialRepository,
    storage = defaultStorage,
    getPortFn = defaultGetPort,
    loggerInstance = logger,
    cronScheduler = cron.schedule
  } = {}) {
    this.lessonRepository = lessonRepository;
    this.materialRepository = materialRepository;
    this.storage = storage;
    this.getPort = getPortFn;
    this.logger = loggerInstance;
    this.cronScheduler = cronScheduler;
    this.orphanedFiles = new Set();
    this.cleanupTask = null;
  }

  _validateId(value, label) {
    if (!validId(value)) {
      throw new ValidationError(`${label} không hợp lệ`);
    }
    return Number(value);
  }

  _validateTitle(value, label) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new ValidationError(`${label} không được để trống`);
    }
    const title = sanitizeText(value.trim());
    if (!title || title.length > 200) {
      throw new ValidationError(`${label} phải từ 1 đến 200 ký tự`);
    }
    return title;
  }

  async _getCourseAccess(courseId, user) {
    const port = this.getPort('courseAccess');
    const course = await port.getCourse(courseId);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học');
    }
    const isOwner = await port.isOwner(user.id, courseId);
    const isEnrolled = user.role === 'SINH_VIEN' && (await port.isEnrolled(user.id, courseId));
    const isAdmin = user.role === 'ADMIN';
    if (!isOwner && !isEnrolled && !isAdmin) {
      throw new ForbiddenError('Bạn không có quyền truy cập khóa học này');
    }
    return { course, isOwner, isEnrolled, isAdmin };
  }

  async createLesson(courseId, user, input = {}) {
    const id = this._validateId(courseId, 'Mã khóa học');
    const { course, isOwner } = await this._getCourseAccess(id, user);
    if (user.role !== 'GIANG_VIEN' || !isOwner) {
      throw new ForbiddenError('Chỉ giảng viên chủ khóa học mới được tạo bài học');
    }
    if (course.status === 'ARCHIVED') {
      throw new ConflictError('Khóa học đã lưu trữ và chỉ được xem', null, 'COURSE_ARCHIVED');
    }
    const title = this._validateTitle(input.title, 'Tiêu đề bài học');
    let content = null;
    if (input.content !== undefined && input.content !== null) {
      if (typeof input.content !== 'string') {
        throw new ValidationError('Nội dung bài học không hợp lệ');
      }
      content = sanitizeText(input.content);
    }
    const orderIndex = input.orderIndex === undefined ? 1 : Number(input.orderIndex);
    if (!Number.isSafeInteger(orderIndex) || orderIndex < 1) {
      throw new ValidationError('Thứ tự bài học phải là số nguyên dương');
    }
    return this.lessonRepository.create(id, { title, content, orderIndex });
  }

  async listLessons(courseId, user) {
    const id = this._validateId(courseId, 'Mã khóa học');
    await this._getCourseAccess(id, user);
    const lessons = await this.lessonRepository.listByCourse(id);
    const materials = await this.materialRepository.listByLessonIds(
      lessons.map((lesson) => lesson.id)
    );
    const materialsByLesson = new Map();
    for (const material of materials) {
      const lessonMaterials = materialsByLesson.get(material.lessonId) || [];
      lessonMaterials.push(publicMaterial(material));
      materialsByLesson.set(material.lessonId, lessonMaterials);
    }
    return lessons.map((lesson) => ({
      ...lesson,
      materials: materialsByLesson.get(lesson.id) || []
    }));
  }

  async listMaterials(lessonId, user) {
    const id = this._validateId(lessonId, 'Mã bài học');
    const lesson = await this.lessonRepository.findById(id);
    if (!lesson) {
      throw new NotFoundError('Không tìm thấy bài học');
    }
    await this._getCourseAccess(lesson.courseId, user);
    return (await this.materialRepository.listByLesson(id)).map(publicMaterial);
  }

  async addMaterial(lessonId, user, input = {}, file) {
    const id = this._validateId(lessonId, 'Mã bài học');
    const lesson = await this.lessonRepository.findById(id);
    if (!lesson) {
      throw new NotFoundError('Không tìm thấy bài học');
    }
    const { isOwner } = await this._getCourseAccess(lesson.courseId, user);
    if (user.role !== 'GIANG_VIEN' || !isOwner) {
      throw new ForbiddenError('Chỉ giảng viên chủ khóa học mới được tải tài liệu');
    }
    if (lesson.courseStatus === 'ARCHIVED') {
      throw new ConflictError('Khóa học đã lưu trữ và chỉ được xem', null, 'COURSE_ARCHIVED');
    }
    if (!file || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestError('Vui lòng chọn tệp tài liệu');
    }
    if (file.size > MAX_MATERIAL_BYTES || file.buffer.length > MAX_MATERIAL_BYTES) {
      throw new BadRequestError('Dung lượng tệp vượt quá giới hạn 50MB', {
        maxBytes: MAX_MATERIAL_BYTES
      });
    }
    const title = this._validateTitle(input.title, 'Tiêu đề tài liệu');
    const saved = await this.storage.saveUpload(file, {
      allowedExt: ALLOWED_EXTENSIONS,
      allowedMime: ALLOWED_MIME_TYPES,
      maxBytes: MAX_MATERIAL_BYTES
    });

    try {
      const material = await this.materialRepository.create(id, {
        title,
        originalName: saved.originalName,
        fileUuid: saved.storedName.replace(/\.[^.]+$/, ''),
        storedName: saved.storedName,
        size: saved.size,
        mime: saved.mime
      });
      return publicMaterial(material);
    } catch (databaseError) {
      try {
        await this.storage.deleteFile(saved.storedName);
      } catch (cleanupError) {
        this.orphanedFiles.add(saved.storedName);
        throw new AggregateError(
          [databaseError, cleanupError],
          'Không thể lưu tài liệu và không thể dọn tệp mồ côi.',
          { cause: databaseError }
        );
      }
      throw databaseError;
    }
  }

  async downloadMaterial(courseId, materialId, user) {
    const course = this._validateId(courseId, 'Mã khóa học');
    const material = await this.materialRepository.findForDownload(
      course,
      this._validateId(materialId, 'Mã tài liệu')
    );
    if (!material) {
      throw new NotFoundError('Không tìm thấy tài liệu trong khóa học');
    }

    const lessonSummary = await this.getPort('courseAccess').getLessonSummary(material.lessonId);
    if (!lessonSummary || Number(lessonSummary.courseId) !== course) {
      throw new NotFoundError('Không tìm thấy bài học của tài liệu');
    }
    await this._getCourseAccess(course, user);
    const stream = this.storage.openReadStream(material.storedName);
    return { stream, originalName: material.originalName, mime: material.mime };
  }

  async cleanupOrphanedFiles() {
    for (const storedName of [...this.orphanedFiles]) {
      try {
        await this.storage.deleteFile(storedName);
        this.orphanedFiles.delete(storedName);
      } catch (error) {
        this.logger.error(`Không thể dọn tệp tài liệu mồ côi "${storedName}".`, error);
      }
    }
  }

  startCleanupJob() {
    if (this.cleanupTask) {
      return this.cleanupTask;
    }
    this.cleanupTask = this.cronScheduler('*/30 * * * *', () => this.cleanupOrphanedFiles(), {
      unref: true
    });
    return this.cleanupTask;
  }
}

module.exports = {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_MATERIAL_BYTES,
  LessonService
};
