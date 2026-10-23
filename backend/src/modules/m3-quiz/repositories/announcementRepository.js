function createAnnouncementRepository(db) {
  return {
    async create(connection, courseId, authorId, title, content) {
      const [result] = await connection.query(
        `INSERT INTO announcements (course_id, author_id, title, content)
         VALUES (?, ?, ?, ?)`,
        [courseId, authorId, title, content]
      );
      const [rows] = await connection.query(
        `SELECT id, course_id AS courseId, author_id AS authorId,
                title, content, created_at AS createdAt, updated_at AS updatedAt
         FROM announcements
         WHERE id = ?`,
        [result.insertId]
      );
      return rows[0];
    },

    async listForCourse(courseId, { page, limit }) {
      const offset = (page - 1) * limit;
      const [[countRows], [rows]] = await Promise.all([
        db.query(
          'SELECT COUNT(*) AS total FROM announcements WHERE course_id = ?',
          [courseId]
        ),
        db.query(
          `SELECT id, course_id AS courseId, author_id AS authorId,
                  title, content, created_at AS createdAt, updated_at AS updatedAt
           FROM announcements
           WHERE course_id = ?
           ORDER BY created_at DESC, id DESC
           LIMIT ? OFFSET ?`,
          [courseId, limit, offset]
        )
      ]);
      return {
        items: rows,
        page,
        limit,
        total: Number(countRows[0].total)
      };
    },

    async findForUpdate(connection, announcementId) {
      const [rows] = await connection.query(
        `SELECT id, course_id AS courseId, author_id AS authorId,
                title, content, created_at AS createdAt
         FROM announcements
         WHERE id = ?
         FOR UPDATE`,
        [announcementId]
      );
      return rows[0] || null;
    },

    async delete(connection, announcementId) {
      const [result] = await connection.query(
        'DELETE FROM announcements WHERE id = ?',
        [announcementId]
      );
      return result.affectedRows === 1;
    }
  };
}

module.exports = createAnnouncementRepository;
