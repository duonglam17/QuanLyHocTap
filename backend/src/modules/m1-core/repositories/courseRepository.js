const db = require('../../../common/db');

function normalizeCourse(course) {
  if (!course) {
    return null;
  }
  return {
    ...course,
    id: Number(course.id),
    ownerId: Number(course.ownerId)
  };
}

class CourseRepository {
  constructor(dbClient = db) {
    this.db = dbClient;
  }

  async findById(courseId, connection = null) {
    const client = connection || this.db;
    const [rows] = await client.query(
      `SELECT id, code, title, description, semester, instructor_id AS ownerId,
              enrollment_key, status, created_at, updated_at
       FROM courses
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [courseId]
    );
    return normalizeCourse(rows[0]);
  }

  async findForUser(userId, role) {
    if (role === 'ADMIN') {
      const [rows] = await this.db.query(
        `SELECT id, code, title, description, semester, instructor_id AS ownerId,
                enrollment_key, status, created_at, updated_at
         FROM courses
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC, id DESC`
      );
      return rows.map(normalizeCourse);
    }
    const [rows] =
      role === 'SINH_VIEN'
        ? await this.db.query(
            `SELECT c.id, c.code, c.title, c.description, c.semester,
                    c.instructor_id AS ownerId, c.status,
                    c.created_at, c.updated_at
             FROM courses c
             JOIN enrollments e ON e.course_id = c.id
             WHERE e.student_id = ? AND c.deleted_at IS NULL
             ORDER BY c.created_at DESC, c.id DESC`,
            [userId]
          )
        : await this.db.query(
            `SELECT id, code, title, description, semester, instructor_id AS ownerId,
                    enrollment_key, status, created_at, updated_at
             FROM courses
             WHERE instructor_id = ? AND deleted_at IS NULL
             ORDER BY created_at DESC, id DESC`,
            [userId]
          );
    return rows.map(normalizeCourse);
  }

  async create(course, connection = null) {
    const client = connection || this.db;
    const [result] = await client.query(
      `INSERT INTO courses
         (code, title, description, semester, instructor_id, enrollment_key, status)
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT')`,
      [
        course.code,
        course.title,
        course.description,
        course.semester,
        course.ownerId,
        course.enrollmentKey
      ]
    );
    return this.findById(result.insertId, connection);
  }

  async update(courseId, fields, connection = null) {
    const client = connection || this.db;
    const columns = {
      code: 'code',
      title: 'title',
      description: 'description',
      semester: 'semester',
      enrollmentKey: 'enrollment_key'
    };
    const updates = Object.entries(fields).filter(([field]) => columns[field]);
    if (updates.length === 0) {
      return this.findById(courseId, connection);
    }

    const assignments = updates.map(([field]) => `${columns[field]} = ?`).join(', ');
    const values = updates.map(([, value]) => value);
    await client.query(
      `UPDATE courses SET ${assignments}
       WHERE id = ? AND deleted_at IS NULL`,
      [...values, courseId]
    );
    return this.findById(courseId, connection);
  }

  async updateStatus(courseId, status, connection = null) {
    const client = connection || this.db;
    await client.query('UPDATE courses SET status = ? WHERE id = ? AND deleted_at IS NULL', [
      status,
      courseId
    ]);
    return this.findById(courseId, connection);
  }

  async softDelete(courseId, deletedAt, connection = null) {
    const client = connection || this.db;
    const [result] = await client.query(
      'UPDATE courses SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
      [deletedAt, courseId]
    );
    return result.affectedRows > 0;
  }

  async hasM1CourseData(courseId, connection = null) {
    const client = connection || this.db;
    const [rows] = await client.query(
      `SELECT
         EXISTS(SELECT 1 FROM enrollments WHERE course_id = ? LIMIT 1)
         OR EXISTS(SELECT 1 FROM lessons WHERE course_id = ? LIMIT 1) AS has_data`,
      [courseId, courseId]
    );
    return Boolean(rows[0]?.has_data);
  }

  async isOwner(userId, courseId) {
    const [rows] = await this.db.query(
      `SELECT 1
       FROM courses
       WHERE instructor_id = ? AND id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [userId, courseId]
    );
    return rows.length > 0;
  }

  async isEnrolled(userId, courseId) {
    const [rows] = await this.db.query(
      `SELECT 1
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = ? AND e.course_id = ? AND c.deleted_at IS NULL
       LIMIT 1`,
      [userId, courseId]
    );
    return rows.length > 0;
  }

  async getEnrolledStudentIds(courseId) {
    const [rows] = await this.db.query(
      `SELECT e.student_id AS id
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       WHERE e.course_id = ? AND u.deleted_at IS NULL
       ORDER BY e.student_id`,
      [courseId]
    );
    return rows.map((row) => Number(row.id));
  }

  async listEnrolledStudents(courseId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const [[countRows], [students]] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) AS total
         FROM enrollments e
         JOIN users u ON u.id = e.student_id
         WHERE e.course_id = ? AND u.deleted_at IS NULL`,
        [courseId]
      ),
      this.db.query(
        `SELECT u.id, u.username, u.full_name AS fullName
         FROM enrollments e
         JOIN users u ON u.id = e.student_id
         WHERE e.course_id = ? AND u.deleted_at IS NULL
         ORDER BY u.id
         LIMIT ? OFFSET ?`,
        [courseId, limit, offset]
      )
    ]);
    return {
      items: students.map((student) => ({ ...student, id: Number(student.id) })),
      total: Number(countRows[0]?.total || 0)
    };
  }

  async getUsersBrief(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return [];
    }
    const placeholders = userIds.map(() => '?').join(', ');
    const [rows] = await this.db.query(
      `SELECT u.id, u.username, u.full_name AS fullName, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id IN (${placeholders}) AND u.deleted_at IS NULL`,
      userIds
    );
    return rows.map((user) => ({ ...user, id: Number(user.id) }));
  }

  async getLessonSummary(lessonId) {
    const [rows] = await this.db.query(
      `SELECT id, course_id AS courseId
       FROM lessons
       WHERE id = ?
       LIMIT 1`,
      [lessonId]
    );
    return rows[0] ? { id: Number(rows[0].id), courseId: Number(rows[0].courseId) } : null;
  }
}

module.exports = CourseRepository;
