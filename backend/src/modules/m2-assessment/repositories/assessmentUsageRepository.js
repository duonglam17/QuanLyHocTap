class AssessmentUsageRepository {
  constructor(dbClient = null) {
    this.db = dbClient || require('../../../common/db');
  }

  async hasCourseData(courseId) {
    const [rows] = await this.db.query(
      `SELECT (
         EXISTS (
           SELECT 1
           FROM \`assignments\`
           WHERE \`course_id\` = ?
         )
         OR EXISTS (
           SELECT 1
           FROM \`submissions\` s
           INNER JOIN \`assignments\` a ON a.\`id\` = s.\`assignment_id\`
           WHERE a.\`course_id\` = ?
         )
       ) AS \`has_data\``,
      [courseId, courseId]
    );

    if (!rows?.[0] || rows[0].has_data === undefined) {
      throw new Error('Assessment usage query completed without returning a result.');
    }
    return Number(rows[0].has_data) === 1;
  }

  async hasUserData(userId) {
    const [rows] = await this.db.query(
      `SELECT (
         EXISTS (
           SELECT 1
           FROM \`submissions\`
           WHERE \`student_id\` = ?
         )
         OR EXISTS (
           SELECT 1
           FROM \`assignments\`
           WHERE \`created_by\` = ?
         )
         OR EXISTS (
           SELECT 1
           FROM \`grades\`
           WHERE \`graded_by\` = ?
         )
       ) AS \`has_data\``,
      [userId, userId, userId]
    );

    if (!rows?.[0] || rows[0].has_data === undefined) {
      throw new Error('Assessment usage query completed without returning a result.');
    }
    return Number(rows[0].has_data) === 1;
  }
}

module.exports = AssessmentUsageRepository;
