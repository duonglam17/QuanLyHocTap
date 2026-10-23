function createDiscussionRepository(db) {
  return {
    async create(connection, { courseId, lessonId, parentDiscussionId, authorId, content }) {
      const [result] = await connection.query(
        `INSERT INTO discussions
          (course_id, lesson_id, parent_discussion_id, author_id, content)
         VALUES (?, ?, ?, ?, ?)`,
        [courseId, lessonId, parentDiscussionId, authorId, content]
      );
      const [rows] = await connection.query(
        `SELECT id, course_id AS courseId, lesson_id AS lessonId,
                parent_discussion_id AS parentDiscussionId, author_id AS authorId,
                content, created_at AS createdAt, updated_at AS updatedAt
         FROM discussions
         WHERE id = ?`,
        [result.insertId]
      );
      return rows[0];
    },

    async findById(discussionId) {
      const [rows] = await db.query(
        `SELECT id, course_id AS courseId, lesson_id AS lessonId,
                parent_discussion_id AS parentDiscussionId, author_id AS authorId,
                content, created_at AS createdAt, updated_at AS updatedAt
         FROM discussions
         WHERE id = ?`,
        [discussionId]
      );
      return rows[0] || null;
    },

    async listRootDiscussions(lessonId, { page, limit }) {
      const offset = (page - 1) * limit;
      const [[countRows], [roots]] = await Promise.all([
        db.query(
          `SELECT COUNT(*) AS total
           FROM discussions
           WHERE lesson_id = ? AND parent_discussion_id IS NULL`,
          [lessonId]
        ),
        db.query(
          `SELECT id, course_id AS courseId, lesson_id AS lessonId,
                  author_id AS authorId, content, created_at AS createdAt,
                  updated_at AS updatedAt
           FROM discussions
           WHERE lesson_id = ? AND parent_discussion_id IS NULL
           ORDER BY created_at DESC, id DESC
           LIMIT ? OFFSET ?`,
          [lessonId, limit, offset]
        )
      ]);

      if (roots.length === 0) {
        return { items: [], page, limit, total: Number(countRows[0].total) };
      }

      const ids = roots.map((root) => root.id);
      const placeholders = ids.map(() => '?').join(', ');
      const [replies] = await db.query(
        `SELECT id, course_id AS courseId, lesson_id AS lessonId,
                parent_discussion_id AS parentDiscussionId, author_id AS authorId,
                content, created_at AS createdAt, updated_at AS updatedAt
         FROM discussions
         WHERE parent_discussion_id IN (${placeholders})
         ORDER BY created_at, id`,
        ids
      );
      const repliesByRoot = new Map(ids.map((id) => [String(id), []]));
      for (const reply of replies) {
        repliesByRoot.get(String(reply.parentDiscussionId))?.push(reply);
      }

      return {
        items: roots.map((root) => ({
          ...root,
          replies: repliesByRoot.get(String(root.id)) || []
        })),
        page,
        limit,
        total: Number(countRows[0].total)
      };
    }
  };
}

module.exports = createDiscussionRepository;
