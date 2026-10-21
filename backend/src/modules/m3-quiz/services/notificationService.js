const NOTIFICATION_TYPES = new Set([
  'NEW_ASSIGNMENT',
  'ASSIGNMENT_GRADED',
  'ANNOUNCEMENT',
  'SCHEDULE_CHANGED'
]);
const { NotFoundError } = require('../../../common/errors');

function normalizeNotification(payload, sanitizeText) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Notification payload must be an object.');
  }
  if (!NOTIFICATION_TYPES.has(payload.type)) {
    throw new TypeError(`Unsupported notification type: ${payload.type}`);
  }
  if (typeof payload.title !== 'string' || payload.title.length > 200) {
    throw new TypeError('Notification title must be a string up to 200 characters.');
  }
  if (typeof payload.message !== 'string') {
    throw new TypeError('Notification message must be a string.');
  }
  if (payload.refType != null && typeof payload.refType !== 'string') {
    throw new TypeError('Notification refType must be a string or null.');
  }
  if (
    payload.refId != null &&
    typeof payload.refId !== 'string' &&
    typeof payload.refId !== 'number'
  ) {
    throw new TypeError('Notification refId must be a string, number, or null.');
  }
  if (payload.link != null && typeof payload.link !== 'string') {
    throw new TypeError('Notification link must be a string or null.');
  }

  return {
    type: payload.type,
    title: sanitizeText(payload.title),
    message: sanitizeText(payload.message),
    refType: payload.refType ?? null,
    refId: payload.refId == null ? null : String(payload.refId),
    link: payload.link ?? null
  };
}

function createNotificationService({ repository, getCourseAccess, logger, sanitizeText }) {
  return {
    async notifyUser(userId, payload) {
      try {
        const notification = normalizeNotification(payload, sanitizeText);
        if (userId == null || userId === '') {
          throw new TypeError('Notification userId is required.');
        }
        await repository.createForUser(userId, null, notification);
        return { userId, notifiedCount: 1 };
      } catch (error) {
        logger.error('Không thể lưu thông báo cho người dùng.', error);
        return { userId, notifiedCount: 0 };
      }
    },

    async notifyCourseStudents(courseId, payload) {
      try {
        const notification = normalizeNotification(payload, sanitizeText);
        if (courseId == null || courseId === '') {
          throw new TypeError('Notification courseId is required.');
        }

        const courseAccess = getCourseAccess();
        if (!courseAccess || typeof courseAccess.getEnrolledStudentIds !== 'function') {
          throw new Error('courseAccess.getEnrolledStudentIds is not available.');
        }

        const studentIds = await courseAccess.getEnrolledStudentIds(courseId);
        if (!Array.isArray(studentIds)) {
          throw new TypeError('courseAccess.getEnrolledStudentIds must return an array.');
        }
        const uniqueStudentIds = [...new Set(studentIds)];
        const notifiedCount = await repository.createForUsers(
          uniqueStudentIds,
          courseId,
          notification
        );
        return { courseId, notifiedCount };
      } catch (error) {
        logger.error('Không thể lưu thông báo cho sinh viên trong khóa học.', error);
        return { courseId, notifiedCount: 0 };
      }
    },

    async getNotifications(userId, pagination) {
      return repository.listForUser(userId, pagination);
    },

    async markNotificationRead(notificationId, userId) {
      const found = await repository.markReadForUser(notificationId, userId);
      if (!found) {
        throw new NotFoundError('Không tìm thấy thông báo.');
      }
      return { id: notificationId, isRead: true };
    }
  };
}

module.exports = { createNotificationService, normalizeNotification };
