function createAttemptRepository(db) {
  return {
    async findQuizForAttempt(quizId) {
      const [rows] = await db.query(
        `SELECT id, course_id AS courseId, duration_minutes AS durationMinutes,
                open_time AS openTime, close_time AS closeTime, status
         FROM quizzes
         WHERE id = ? AND deleted_at IS NULL`,
        [quizId]
      );
      return rows[0] || null;
    },

    async findAttempt(quizId, studentId) {
      const [rows] = await db.query(
        `SELECT id, quiz_id AS quizId, student_id AS studentId,
                client_instance_id AS clientInstanceId, session_token AS sessionToken,
                started_at AS startedAt, expires_at AS expiresAt, status,
                takeover_count AS takeoverCount
         FROM attempts
         WHERE quiz_id = ? AND student_id = ?`,
        [quizId, studentId]
      );
      return rows[0] || null;
    },

    async findAttemptById(attemptId) {
      const [rows] = await db.query(
        `SELECT id, quiz_id AS quizId, student_id AS studentId,
                client_instance_id AS clientInstanceId, session_token AS sessionToken,
                started_at AS startedAt, expires_at AS expiresAt, status,
                takeover_count AS takeoverCount
         FROM attempts
         WHERE id = ?`,
        [attemptId]
      );
      return rows[0] || null;
    },

    async findAttemptForUpdate(connection, attemptId) {
      const [rows] = await connection.query(
        `SELECT a.id, a.quiz_id AS quizId, a.student_id AS studentId,
                a.client_instance_id AS clientInstanceId, a.session_token AS sessionToken,
                a.started_at AS startedAt, a.expires_at AS expiresAt, a.submitted_at AS submittedAt,
                a.total_questions AS totalQuestions,
                a.correct_answers_count AS correctAnswersCount, a.score,
                a.status, a.takeover_count AS takeoverCount,
                q.title AS quizTitle, q.show_score_immediately AS showScoreImmediately,
                q.close_time AS quizCloseTime, q.status AS quizStatus
         FROM attempts a
         JOIN quizzes q ON q.id = a.quiz_id
         WHERE a.id = ?
         FOR UPDATE`,
        [attemptId]
      );
      return rows[0] || null;
    },

    async listExpiredAttemptIds(now, limit = 100) {
      const [rows] = await db.query(
        `SELECT id
         FROM attempts
         WHERE status = 'IN_PROGRESS' AND expires_at <= ?
         ORDER BY expires_at, id
         LIMIT ?`,
        [now, limit]
      );
      return rows.map((row) => row.id);
    },

    async gradeAttempt(connection, quizId, attemptId) {
      const [rows] = await connection.query(
        `SELECT COUNT(DISTINCT q.id) AS totalQuestions,
                COALESCE(SUM(CASE WHEN o.is_correct = TRUE THEN 1 ELSE 0 END), 0)
                  AS correctAnswersCount
         FROM questions q
         LEFT JOIN attempt_answers aa
           ON aa.question_id = q.id AND aa.attempt_id = ?
         LEFT JOIN options o
           ON o.id = aa.selected_option_id AND o.question_id = q.id
         WHERE q.quiz_id = ?`,
        [attemptId, quizId]
      );
      const totalQuestions = Number(rows[0].totalQuestions);
      const correctAnswersCount = Number(rows[0].correctAnswersCount);
      const score =
        totalQuestions === 0
          ? 0
          : Math.round((correctAnswersCount / totalQuestions) * 1000) / 100;
      return { totalQuestions, correctAnswersCount, score };
    },

    async completeAttempt(connection, attemptId, result) {
      const [updateResult] = await connection.query(
        `UPDATE attempts
         SET status = ?, submitted_at = ?, total_questions = ?,
             correct_answers_count = ?, score = ?
         WHERE id = ? AND status = 'IN_PROGRESS'`,
        [
          result.status,
          result.submittedAt,
          result.totalQuestions,
          result.correctAnswersCount,
          result.score,
          attemptId
        ]
      );
      return updateResult.affectedRows === 1;
    },

    async markQuizHasAttempts(connection, quizId) {
      await connection.query(
        'UPDATE quizzes SET has_attempts = TRUE WHERE id = ?',
        [quizId]
      );
    },

    async createAttempt(connection, attempt) {
      const [result] = await connection.query(
        `INSERT INTO attempts
          (quiz_id, student_id, client_instance_id, session_token,
           started_at, expires_at, status)
         VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS')`,
        [
          attempt.quizId,
          attempt.studentId,
          attempt.clientInstanceId,
          attempt.sessionToken,
          attempt.startedAt,
          attempt.expiresAt
        ]
      );
      return result.insertId;
    },

    async takeOverAttempt(
      connection,
      { attemptId, previousSessionToken, clientInstanceId, sessionToken, now }
    ) {
      const [result] = await connection.query(
        `UPDATE attempts
         SET client_instance_id = ?, session_token = ?,
             takeover_count = takeover_count + 1, last_takeover_at = ?
         WHERE id = ? AND status = 'IN_PROGRESS' AND expires_at > ?
           AND session_token = ? AND client_instance_id <> ?
           AND takeover_count < 5`,
        [
          clientInstanceId,
          sessionToken,
          now,
          attemptId,
          now,
          previousSessionToken,
          clientInstanceId
        ]
      );
      return result.affectedRows === 1;
    },

    async listQuestions(quizId) {
      const [rows] = await db.query(
        `SELECT q.id AS questionId, q.content AS questionContent,
                q.order_index AS questionOrder,
                o.id AS optionId, o.content AS optionContent,
                o.order_index AS optionOrder
         FROM questions q
         JOIN options o ON o.question_id = q.id
         WHERE q.quiz_id = ?
         ORDER BY q.order_index, q.id, o.order_index, o.id`,
        [quizId]
      );
      const questions = new Map();
      for (const row of rows) {
        if (!questions.has(row.questionId)) {
          questions.set(row.questionId, {
            id: row.questionId,
            content: row.questionContent,
            orderIndex: row.questionOrder,
            options: []
          });
        }
        questions.get(row.questionId).options.push({
          id: row.optionId,
          content: row.optionContent,
          orderIndex: row.optionOrder
        });
      }
      return [...questions.values()];
    },

    async listSavedAnswers(attemptId) {
      const [rows] = await db.query(
        `SELECT question_id AS questionId, selected_option_id AS optionId
         FROM attempt_answers
         WHERE attempt_id = ?
         ORDER BY question_id`,
        [attemptId]
      );
      return rows;
    },

    async optionBelongsToQuestion(connection, quizId, questionId, optionId) {
      const [rows] = await connection.query(
        `SELECT EXISTS (
           SELECT 1
           FROM questions q
           JOIN options o ON o.question_id = q.id
           WHERE q.id = ? AND q.quiz_id = ? AND o.id = ?
         ) AS isValid`,
        [questionId, quizId, optionId]
      );
      return Boolean(rows[0].isValid);
    },

    async upsertAnswer(connection, attemptId, questionId, optionId) {
      await connection.query(
        `INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE selected_option_id = VALUES(selected_option_id)`,
        [attemptId, questionId, optionId]
      );
    }
  };
}

module.exports = createAttemptRepository;
