class ClassGradebookRepository {
  constructor(dbClient = null) {
    this.db = dbClient || require('../../../common/db');
  }

  async findCourseAssignments(courseId) {
    const [rows] = await this.db.query(
      `SELECT \`id\`, \`title\`, \`max_score\`
       FROM \`assignments\`
       WHERE \`course_id\` = ? AND \`deleted_at\` IS NULL
       ORDER BY \`id\` ASC`,
      [courseId]
    );
    return rows;
  }

  async findAssignmentScoresForStudents(courseId, students, assignmentIds) {
    if (students.length === 0 || assignmentIds.length === 0) {
      return [];
    }

    const pairs = [];
    const params = [];
    for (const student of students) {
      for (const assignmentId of assignmentIds) {
        pairs.push('(?, ?)');
        params.push(assignmentId, student.id);
      }
    }

    const [rows] = await this.db.query(
      `SELECT s.\`assignment_id\`, s.\`student_id\`, g.\`score\`
       FROM \`submissions\` s
       INNER JOIN \`assignments\` a
         ON a.\`id\` = s.\`assignment_id\` AND a.\`course_id\` = ?
       LEFT JOIN \`grades\` g ON g.\`submission_id\` = s.\`id\`
       WHERE (s.\`assignment_id\`, s.\`student_id\`) IN (${pairs.join(', ')})`,
      [courseId, ...params]
    );
    return rows;
  }
}

module.exports = ClassGradebookRepository;
