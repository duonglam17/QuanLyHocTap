const StudentGradebook = require('../models/studentGradebook');

class StudentGradebookRepository {
  constructor(dbClient = null) {
    this.db = dbClient || require('../../../common/db');
  }

  async findByCourseAndStudent(courseId, studentId) {
    const [rows] = await this.db.query(
      `SELECT a.\`id\` AS \`assignment_id\`,
              a.\`title\`,
              a.\`max_score\`,
              s.\`id\` AS \`submission_id\`,
              s.\`status\` AS \`submission_status\`,
              s.\`submitted_at\`,
              g.\`score\`,
              g.\`feedback\`,
              g.\`graded_at\`
       FROM \`assignments\` a
       LEFT JOIN \`submissions\` s
         ON s.\`assignment_id\` = a.\`id\` AND s.\`student_id\` = ?
       LEFT JOIN \`grades\` g ON g.\`submission_id\` = s.\`id\`
       WHERE a.\`course_id\` = ? AND a.\`deleted_at\` IS NULL
       ORDER BY a.\`deadline\` ASC, a.\`id\` ASC`,
      [studentId, courseId]
    );

    return rows.map((row) => ({
      type: 'ASSIGNMENT',
      id: Number(row.assignment_id),
      title: row.title,
      score: row.score === null || row.score === undefined ? null : Number(row.score),
      maxScore: Number(row.max_score),
      feedback: row.feedback ?? null,
      status: row.submission_status || 'NOT_SUBMITTED',
      submittedAt: row.submitted_at ?? null,
      gradedAt: row.graded_at ?? null,
      visibleToStudent:
        row.visible_to_student === undefined ? true : Boolean(row.visible_to_student)
    }));
  }

  createGradebook({ courseId, studentId, assignments, quizzes }) {
    return new StudentGradebook({ courseId, studentId, assignments, quizzes });
  }
}

module.exports = StudentGradebookRepository;
