const Grade = require('../models/grade');

class GradeRepository {
  constructor(dbClient = null) {
    this.db = dbClient || require('../../../common/db');
  }

  async findSubmissionForGradeForUpdate(submissionId, connection) {
    const client = connection || this.db;
    const lockClause = connection ? 'FOR UPDATE' : '';
    const [rows] = await client.query(
      `SELECT s.\`id\`, s.\`assignment_id\`, s.\`student_id\`, s.\`status\`, a.\`course_id\`
       FROM \`submissions\` s
       INNER JOIN \`assignments\` a ON a.\`id\` = s.\`assignment_id\`
       WHERE s.\`id\` = ?
       LIMIT 1
       ${lockClause}`,
      [submissionId]
    );
    return rows[0] || null;
  }

  async upsert({ submissionId, graderId, score, feedback }, connection) {
    await connection.query(
      `INSERT INTO \`grades\` (\`submission_id\`, \`graded_by\`, \`score\`, \`feedback\`)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`graded_by\` = VALUES(\`graded_by\`),
         \`score\` = VALUES(\`score\`),
         \`feedback\` = VALUES(\`feedback\`),
         \`updated_at\` = CURRENT_TIMESTAMP`,
      [submissionId, graderId, score, feedback]
    );

    const [rows] = await connection.query(
      'SELECT * FROM `grades` WHERE `submission_id` = ? LIMIT 1',
      [submissionId]
    );
    if (!rows[0]) {
      throw new Error('Grade upsert completed without returning the saved row.');
    }
    return new Grade(rows[0]);
  }

  async markSubmissionGraded(submissionId, connection) {
    await connection.query(
      'UPDATE `submissions` SET `status` = \'GRADED\' WHERE `id` = ?',
      [submissionId]
    );
  }
}

module.exports = GradeRepository;
