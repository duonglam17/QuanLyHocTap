class GradebookRepository {
  constructor(dbClient = null) {
    this.db = dbClient || require('../../../common/db');
  }

  async countSubmissionsByCourse(courseId, connection = null) {
    const client = connection || this.db;
    const [rows] = await client.query(
      `SELECT COUNT(*) AS \`total\`
       FROM \`submissions\` s
       INNER JOIN \`assignments\` a ON a.\`id\` = s.\`assignment_id\`
       WHERE a.\`course_id\` = ?`,
      [courseId]
    );
    return Number(rows[0]?.total || 0);
  }

  async findSubmissionsByCourse(courseId, { limit, offset }, connection = null) {
    const client = connection || this.db;
    const [rows] = await client.query(
      `SELECT s.\`id\`, s.\`assignment_id\`, s.\`student_id\`,
              s.\`original_filename\`, s.\`file_size_bytes\`, s.\`mime_type\`,
              s.\`submitted_at\`, s.\`is_late\`, s.\`late_minutes\`,
              s.\`submission_count\`, s.\`status\`,
              g.\`score\`, g.\`feedback\`, g.\`graded_at\`, g.\`updated_at\` AS \`grade_updated_at\`
       FROM \`submissions\` s
       INNER JOIN \`assignments\` a ON a.\`id\` = s.\`assignment_id\`
       LEFT JOIN \`grades\` g ON g.\`submission_id\` = s.\`id\`
       WHERE a.\`course_id\` = ?
       ORDER BY s.\`submitted_at\` DESC, s.\`id\` DESC
       LIMIT ? OFFSET ?`,
      [courseId, limit, offset]
    );
    return rows;
  }
}

module.exports = GradebookRepository;
