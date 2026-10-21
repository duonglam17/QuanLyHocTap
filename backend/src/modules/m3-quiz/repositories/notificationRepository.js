const { mapNotificationRow } = require('../models/notification');

function createNotificationRepository(db) {
  return {
    async createForUser(userId, courseId, notification) {
      await db.query(
        `INSERT INTO notifications
          (user_id, course_id, title, content, type, ref_type, ref_id, link)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          courseId,
          notification.title,
          notification.message,
          notification.type,
          notification.refType,
          notification.refId,
          notification.link
        ]
      );
    },

    async createForUsers(userIds, courseId, notification) {
      if (userIds.length === 0) {
        return 0;
      }

      const valuePlaceholders = userIds.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = userIds.flatMap((userId) => [
        userId,
        courseId,
        notification.title,
        notification.message,
        notification.type,
        notification.refType,
        notification.refId,
        notification.link
      ]);
      const [result] = await db.query(
        `INSERT INTO notifications
          (user_id, course_id, title, content, type, ref_type, ref_id, link)
         VALUES ${valuePlaceholders}`,
        values
      );

      return result.affectedRows;
    },

    async listForUser(userId, { page, limit }) {
      const offset = (page - 1) * limit;
      const [[countRows], [rows]] = await Promise.all([
        db.query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?', [userId]),
        db.query(
          `SELECT id, user_id AS userId, course_id AS courseId, title, content AS message,
                  type, ref_type AS refType, ref_id AS refId, link,
                  is_read AS isRead, created_at AS createdAt
           FROM notifications
           WHERE user_id = ?
           ORDER BY created_at DESC, id DESC
           LIMIT ? OFFSET ?`,
          [userId, limit, offset]
        )
      ]);

      return {
        items: rows.map(mapNotificationRow),
        page,
        limit,
        total: Number(countRows[0].total)
      };
    },

    async markReadForUser(notificationId, userId) {
      const [rows] = await db.query(
        'SELECT id, is_read AS isRead FROM notifications WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );
      if (rows.length === 0) {
        return false;
      }

      if (!rows[0].isRead) {
        await db.query(
          'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
          [notificationId, userId]
        );
      }
      return true;
    }
  };
}

module.exports = createNotificationRepository;
