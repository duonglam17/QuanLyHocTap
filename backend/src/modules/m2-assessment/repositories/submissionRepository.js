const Submission = require('../models/submission');

class SubmissionRepository {
  constructor(dbClient = null) {
    this.db = dbClient || require('../../../common/db');
  }

  async findAssignmentForUpdate(assignmentId, connection) {
    const [rows] = await connection.query(
      `SELECT \`id\`, \`course_id\`, \`deadline\`, \`allow_late\`, \`status\`, \`deleted_at\`
       FROM \`assignments\`
       WHERE \`id\` = ? AND \`deleted_at\` IS NULL
       LIMIT 1
       FOR UPDATE`,
      [assignmentId]
    );
    return rows[0] || null;
  }

  async findAssignment(assignmentId) {
    const [rows] = await this.db.query(
      `SELECT \`id\`, \`course_id\`, \`deadline\`, \`allow_late\`,
              \`allow_late_submission\`, \`status\`, \`deleted_at\`
       FROM \`assignments\`
       WHERE \`id\` = ? AND \`deleted_at\` IS NULL
       LIMIT 1`,
      [assignmentId]
    );
    return rows[0] || null;
  }

  async findByAssignmentAndStudent(assignmentId, studentId) {
    const [rows] = await this.db.query(
      `SELECT *
       FROM \`submissions\`
       WHERE \`assignment_id\` = ? AND \`student_id\` = ?
       LIMIT 1`,
      [assignmentId, studentId]
    );
    return rows[0] ? new Submission(rows[0]) : null;
  }

  async findByAssignmentAndStudentForUpdate(assignmentId, studentId, connection) {
    const [rows] = await connection.query(
      `SELECT *
       FROM \`submissions\`
       WHERE \`assignment_id\` = ? AND \`student_id\` = ?
       LIMIT 1
       FOR UPDATE`,
      [assignmentId, studentId]
    );
    return rows[0] ? new Submission(rows[0]) : null;
  }

  async upsert({
    assignmentId,
    studentId,
    file,
    submittedAt,
    isLate,
    lateMinutes,
    status
  }, connection) {
    await connection.query(
      `INSERT INTO \`submissions\` (
         \`assignment_id\`,
         \`student_id\`,
         \`original_filename\`,
         \`file_uuid\`,
         \`file_path\`,
         \`file_size_bytes\`,
         \`mime_type\`,
         \`submitted_at\`,
         \`is_late\`,
         \`late_minutes\`,
         \`submission_count\`,
         \`status\`
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE
         \`original_filename\` = VALUES(\`original_filename\`),
         \`file_uuid\` = VALUES(\`file_uuid\`),
         \`file_path\` = VALUES(\`file_path\`),
         \`file_size_bytes\` = VALUES(\`file_size_bytes\`),
         \`mime_type\` = VALUES(\`mime_type\`),
         \`submitted_at\` = VALUES(\`submitted_at\`),
         \`is_late\` = VALUES(\`is_late\`),
         \`late_minutes\` = VALUES(\`late_minutes\`),
         \`submission_count\` = \`submission_count\` + 1,
         \`status\` = VALUES(\`status\`)`,
      [
        assignmentId,
        studentId,
        file.originalFilename,
        file.fileUuid,
        file.filePath,
        file.fileSizeBytes,
        file.mimeType,
        submittedAt,
        isLate ? 1 : 0,
        lateMinutes,
        status
      ]
    );

    const [rows] = await connection.query(
      `SELECT *
       FROM \`submissions\`
       WHERE \`assignment_id\` = ? AND \`student_id\` = ?
       LIMIT 1`,
      [assignmentId, studentId]
    );
    if (!rows[0]) {
      throw new Error('Submission upsert completed without returning the saved row.');
    }
    return new Submission(rows[0]);
  }
}

module.exports = SubmissionRepository;
