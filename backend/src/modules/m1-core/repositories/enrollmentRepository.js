const db = require('../../../common/db');

class EnrollmentRepository {
  constructor(dbClient = db) {
    this.db = dbClient;
  }

  async findPublishedCourseByKey(enrollmentKey, connection = this.db) {
    const [rows] = await connection.query(
      `SELECT id, title
       FROM courses
       WHERE enrollment_key = BINARY ?
         AND status = 'PUBLISHED'
         AND deleted_at IS NULL
       LIMIT 1`,
      [enrollmentKey]
    );
    return rows[0] || null;
  }

  async findEnrollment(courseId, studentId, connection = this.db) {
    const [rows] = await connection.query(
      `SELECT id, course_id AS courseId, student_id AS studentId, enrolled_at AS enrolledAt
       FROM enrollments
       WHERE course_id = ? AND student_id = ?
       LIMIT 1`,
      [courseId, studentId]
    );
    return rows[0] || null;
  }

  async create(courseId, studentId, connection) {
    const [result] = await connection.query(
      'INSERT INTO enrollments (course_id, student_id) VALUES (?, ?)',
      [courseId, studentId]
    );
    return {
      id: Number(result.insertId),
      courseId: Number(courseId),
      studentId: Number(studentId)
    };
  }

  async delete(courseId, studentId, connection) {
    const [result] = await connection.query(
      'DELETE FROM enrollments WHERE course_id = ? AND student_id = ?',
      [courseId, studentId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = EnrollmentRepository;
