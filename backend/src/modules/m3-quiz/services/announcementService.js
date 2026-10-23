const {
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');

function createAnnouncementService({
  repository,
  getCourseAccess,
  getNotificationsPort,
  withTransaction,
  sanitizeText,
  logger
}) {
  function normalizePortId(id) {
    const numericId = Number(id);
    return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : id;
  }

  async function getAuthorizedCourse(courseId, userId, role, { write = false } = {}) {
    const courseAccess = getCourseAccess();
    if (
      !courseAccess ||
      typeof courseAccess.getCourse !== 'function' ||
      typeof courseAccess.isOwner !== 'function' ||
      typeof courseAccess.isEnrolled !== 'function'
    ) {
      throw new InternalServerError('Port courseAccess chưa sẵn sàng.');
    }

    const portCourseId = normalizePortId(courseId);
    const course = await courseAccess.getCourse(portCourseId);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học.');
    }

    if (write) {
      const isAdmin = role === 'ADMIN';
      const isOwner = await courseAccess.isOwner(userId, portCourseId);
      if (!isAdmin && !isOwner) {
        throw new ForbiddenError('Chỉ chủ khóa học hoặc Admin mới được quản lý thông báo.');
      }
      if (typeof courseAccess.assertCourseWritable !== 'function') {
        throw new InternalServerError('Port courseAccess.assertCourseWritable chưa sẵn sàng.');
      }
      await courseAccess.assertCourseWritable(portCourseId);
      return course;
    }

    const isOwner = await courseAccess.isOwner(userId, portCourseId);
    const isEnrolled = await courseAccess.isEnrolled(userId, portCourseId);
    if (role !== 'ADMIN' && !isOwner && !isEnrolled) {
      throw new ForbiddenError('Bạn không có quyền xem thông báo của khóa học này.');
    }
    return course;
  }

  function sanitizeAnnouncement(data) {
    if (
      !data ||
      typeof data.title !== 'string' ||
      typeof data.content !== 'string'
    ) {
      throw new ValidationError('Tiêu đề và nội dung thông báo là bắt buộc.');
    }
    const title = sanitizeText(data.title);
    const content = sanitizeText(data.content);
    if (!title.trim() || title.length > 200 || !content.trim()) {
      throw new ValidationError('Tiêu đề phải có tối đa 200 ký tự và nội dung không được để trống.');
    }
    return { title, content };
  }

  async function notifyStudents(courseId, announcement) {
    try {
      const notifications = getNotificationsPort();
      if (!notifications || typeof notifications.notifyCourseStudents !== 'function') {
        throw new InternalServerError('Port notifications chưa sẵn sàng.');
      }
      await notifications.notifyCourseStudents(courseId, {
        type: 'ANNOUNCEMENT',
        title: announcement.title,
        message: announcement.content,
        refType: 'announcement',
        refId: announcement.id,
        link: `/courses/${courseId}`
      });
    } catch (error) {
      logger.error('Không thể gửi thông báo mới của khóa học.', error);
    }
  }

  return {
    async create(courseId, userId, role, data) {
      await getAuthorizedCourse(courseId, userId, role, { write: true });
      const { title, content } = sanitizeAnnouncement(data);
      const announcement = await withTransaction((connection) =>
        repository.create(connection, courseId, userId, title, content)
      );
      await notifyStudents(courseId, announcement);
      return announcement;
    },

    async list(courseId, userId, role, pagination) {
      await getAuthorizedCourse(courseId, userId, role);
      return repository.listForCourse(courseId, pagination);
    },

    async delete(announcementId, userId, role) {
      return withTransaction(async (connection) => {
        const announcement = await repository.findForUpdate(connection, announcementId);
        if (!announcement) {
          throw new NotFoundError('Không tìm thấy thông báo khóa học.');
        }
        await getAuthorizedCourse(
          announcement.courseId,
          userId,
          role,
          { write: true }
        );
        await repository.delete(connection, announcementId);
        return { id: announcementId, deleted: true };
      });
    }
  };
}

module.exports = { createAnnouncementService };
