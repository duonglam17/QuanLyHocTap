const db = require('../../../common/db');

class LessonRepository {
  constructor(dbClient = db) {
    this.db = dbClient;
  }

  async create(courseId, { title, content = null, orderIndex = 1 }) {
    const [result] = await this.db.query(
      `INSERT INTO lessons (course_id, title, content, order_index)
       VALUES (?, ?, ?, ?)`,
      [courseId, title, content, orderIndex]
    );
    return this.findById(result.insertId);
  }

  async findById(lessonId) {
    const [rows] = await this.db.query(
      `SELECT l.id, l.course_id AS courseId, l.title, l.content,
              l.order_index AS orderIndex, l.created_at AS createdAt,
              l.updated_at AS updatedAt, c.instructor_id AS ownerId, c.status AS courseStatus
       FROM lessons l
       JOIN courses c ON c.id = l.course_id
       WHERE l.id = ?
       LIMIT 1`,
      [lessonId]
    );
    return rows[0]
      ? { ...rows[0], id: Number(rows[0].id), courseId: Number(rows[0].courseId) }
      : null;
  }

  async listByCourse(courseId) {
    const [rows] = await this.db.query(
      `SELECT id, course_id AS courseId, title, content,
              order_index AS orderIndex, created_at AS createdAt, updated_at AS updatedAt
       FROM lessons
       WHERE course_id = ?
       ORDER BY order_index, id`,
      [courseId]
    );
    return rows.map((lesson) => ({
      ...lesson,
      id: Number(lesson.id),
      courseId: Number(lesson.courseId)
    }));
  }
}

module.exports = LessonRepository;
