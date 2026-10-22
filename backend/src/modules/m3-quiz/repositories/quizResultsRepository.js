function createQuizResultsRepository(db, clock) {
  function toIsoDate(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    const timestamp = String(value);
    const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
    const zoned = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)
      ? normalized
      : `${normalized}+07:00`;
    return new Date(zoned).toISOString();
  }

  async function getQuizScores(courseId, studentIds) {
    const uniqueStudentIds = [
      ...new Map(studentIds.map((studentId) => [String(studentId), studentId])).values()
    ];
    if (uniqueStudentIds.length === 0) {
      return [];
    }

    const requestedStudents = uniqueStudentIds
      .map(() => 'SELECT ? AS student_id')
      .join(' UNION ALL ');
    const [rows] = await db.query(
      `SELECT requested.student_id AS studentId,
              q.id AS quizId, q.title AS quizTitle, 10 AS maxScore,
              a.score, a.status AS attemptStatus, a.submitted_at AS submittedAt,
              CASE
                WHEN q.show_score_immediately = TRUE OR q.status = 'CLOSED'
                  OR q.close_time <= ? THEN TRUE
                ELSE FALSE
              END AS visibleToStudent
       FROM quizzes q
       JOIN (${requestedStudents}) requested
       LEFT JOIN attempts a
         ON a.quiz_id = q.id AND a.student_id = requested.student_id
       WHERE q.course_id = ? AND q.status IN ('PUBLISHED', 'CLOSED')
         AND q.deleted_at IS NULL
       ORDER BY q.id, requested.student_id`,
      [clock.now(), ...uniqueStudentIds, courseId]
    );

    return rows.map((row) => ({
      studentId: Number(row.studentId),
      quizId: Number(row.quizId),
      quizTitle: row.quizTitle,
      maxScore: 10,
      score: row.score === null ? null : Number(row.score),
      attemptStatus: row.attemptStatus || null,
      submittedAt:
        row.submittedAt == null
          ? null
          : toIsoDate(row.submittedAt),
      visibleToStudent: Boolean(row.visibleToStudent)
    }));
  }

  return {
    getQuizScoresForCourse(courseId, studentIds) {
      if (!Array.isArray(studentIds)) {
        throw new TypeError('studentIds phải là một mảng.');
      }
      return getQuizScores(courseId, studentIds);
    },

    getQuizScoresForStudent(courseId, studentId) {
      return getQuizScores(courseId, [studentId]);
    }
  };
}

module.exports = createQuizResultsRepository;
