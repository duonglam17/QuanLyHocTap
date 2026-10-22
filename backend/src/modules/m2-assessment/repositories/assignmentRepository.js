/**
 * LMS Mini - Module M2 Assessment
 * Assignment Repository
 * Tầng duy nhất chịu trách nhiệm thực thi các truy vấn SQL liên quan tới bài tập (bảng `assignments`).
 */

const Assignment = require('../models/assignment');

class AssignmentRepository {
  constructor(dbClient = null) {
    // dbClient cho phép inject đối tượng database hoặc mặc định dùng common/db
    this.db = dbClient || require('../../../common/db');
  }

  /**
   * Tạo bài tập mới trong cơ sở dữ liệu (sử dụng câu lệnh tham số hóa)
   */
  async create({ courseId, createdBy, title, description, dueDate, maxScore = 10.0, allowLateSubmission = false, status = 'OPEN' }, connection = null) {
    const sql = `
      INSERT INTO \`assignments\` (
        \`course_id\`,
        \`created_by\`,
        \`title\`,
        \`description\`,
        \`deadline\`,
        \`due_date\`,
        \`max_score\`,
        \`allow_late\`,
        \`allow_late_submission\`,
        \`status\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      courseId,
      createdBy,
      title,
      description || null,
      dueDate,
      dueDate,
      maxScore,
      allowLateSubmission ? 1 : 0,
      allowLateSubmission ? 1 : 0,
      status
    ];

    let result;
    if (connection) {
      const [res] = await connection.query(sql, params);
      result = res;
    } else {
      const [res] = await this.db.query(sql, params);
      result = res;
    }

    return this.findById(result.insertId, connection);
  }

  /**
   * Tìm bài tập theo ID (chỉ lấy bài chưa bị xóa mềm)
   */
  async findById(id, connection = null) {
    const sql = `
      SELECT * FROM \`assignments\`
      WHERE \`id\` = ? AND \`deleted_at\` IS NULL
      LIMIT 1
    `;
    const params = [id];

    let rows;
    if (connection) {
      const [res] = await connection.query(sql, params);
      rows = res;
    } else {
      const [res] = await this.db.query(sql, params);
      rows = res;
    }

    if (!rows || rows.length === 0) {
      return null;
    }

    return new Assignment(rows[0]);
  }

  /**
   * Lấy danh sách bài tập của một khóa học
   */
  async findByCourseId(courseId, connection = null) {
    const sql = `
      SELECT * FROM \`assignments\`
      WHERE \`course_id\` = ? AND \`deleted_at\` IS NULL
      ORDER BY \`deadline\` ASC, \`id\` ASC
    `;
    const params = [courseId];

    let rows;
    if (connection) {
      const [res] = await connection.query(sql, params);
      rows = res;
    } else {
      const [res] = await this.db.query(sql, params);
      rows = res;
    }

    return (rows || []).map((row) => new Assignment(row));
  }

  /**
   * Đếm số lượng bài nộp của một bài tập để kiểm tra EC-09
   */
  async countSubmissions(assignmentId, connection = null) {
    const sql = `
      SELECT COUNT(*) AS \`total\`
      FROM \`submissions\`
      WHERE \`assignment_id\` = ?
    `;
    const params = [assignmentId];

    let rows;
    if (connection) {
      const [res] = await connection.query(sql, params);
      rows = res;
    } else {
      const [res] = await this.db.query(sql, params);
      rows = res;
    }

    return rows && rows[0] ? Number(rows[0].total) : 0;
  }

  /**
   * Xóa mềm bài tập (Soft Delete) theo EC-09 và NFR-09
   */
  async softDelete(id, connection = null) {
    const sql = `
      UPDATE \`assignments\`
      SET \`deleted_at\` = NOW(),
          \`status\` = 'CLOSED'
      WHERE \`id\` = ? AND \`deleted_at\` IS NULL
    `;
    const params = [id];

    let result;
    if (connection) {
      const [res] = await connection.query(sql, params);
      result = res;
    } else {
      const [res] = await this.db.query(sql, params);
      result = res;
    }

    return result.affectedRows > 0;
  }

  /**
   * Xóa cứng (chỉ gọi khi tuyệt đối không có bài nộp nào)
   */
  async hardDelete(id, connection = null) {
    const sql = `
      DELETE FROM \`assignments\`
      WHERE \`id\` = ?
    `;
    const params = [id];

    let result;
    if (connection) {
      const [res] = await connection.query(sql, params);
      result = res;
    } else {
      const [res] = await this.db.query(sql, params);
      result = res;
    }

    return result.affectedRows > 0;
  }
}

module.exports = AssignmentRepository;
