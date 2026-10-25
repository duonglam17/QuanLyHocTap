function createQuizRepository(db) {
  async function insertQuestions(connection, quizId, questions) {
    for (const [questionIndex, question] of questions.entries()) {
      const [questionResult] = await connection.query(
        'INSERT INTO questions (quiz_id, content, order_index) VALUES (?, ?, ?)',
        [quizId, question.content, questionIndex + 1]
      );

      for (const [optionIndex, option] of question.options.entries()) {
        await connection.query(
          'INSERT INTO options (question_id, content, is_correct, order_index) VALUES (?, ?, ?, ?)',
          [questionResult.insertId, option.content, option.is_correct, optionIndex + 1]
        );
      }
    }
  }

  return {
    async hasCourseData(courseId) {
      const [rows] = await db.query(
        `SELECT EXISTS (
           SELECT 1 FROM quizzes WHERE course_id = ?
           UNION ALL
           SELECT 1
           FROM attempts a
           INNER JOIN quizzes q ON q.id = a.quiz_id
           WHERE q.course_id = ?
         ) AS hasData`,
        [courseId, courseId]
      );
      return Boolean(rows[0].hasData);
    },

    async hasUserData(userId) {
      const [rows] = await db.query(
        `SELECT EXISTS (
           SELECT 1 FROM attempts WHERE student_id = ?
           UNION ALL
           SELECT 1 FROM quizzes WHERE creator_id = ?
           UNION ALL
           SELECT 1 FROM notifications WHERE user_id = ?
           UNION ALL
           SELECT 1 FROM discussions WHERE author_id = ?
         ) AS hasData`,
        [userId, userId, userId, userId]
      );
      return Boolean(rows[0].hasData);
    },

    async createQuizWithQuestions(connection, courseId, creatorId, quiz, questions) {
      const [result] = await connection.query(
        `INSERT INTO quizzes
          (course_id, creator_id, title, description, duration_minutes, open_time, close_time,
           show_score_immediately, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
        [
          courseId,
          creatorId,
          quiz.title,
          quiz.description ?? null,
          quiz.duration_minutes,
          quiz.open_time,
          quiz.close_time,
          quiz.show_score_immediately
        ]
      );
      await insertQuestions(connection, result.insertId, questions);
      return result.insertId;
    },

    async findQuiz(quizId) {
      const [rows] = await db.query(
        `SELECT q.id, q.course_id AS courseId, q.title, q.description,
                q.duration_minutes AS durationMinutes, q.open_time AS openTime,
                q.close_time AS closeTime,
                q.show_score_immediately AS showScoreImmediately, q.status,
                EXISTS(SELECT 1 FROM attempts a WHERE a.quiz_id = q.id) AS hasAttempts
         FROM quizzes q
         WHERE q.id = ? AND q.deleted_at IS NULL`,
        [quizId]
      );
      return rows[0] || null;
    },

    async listOwnerQuizzes(courseId, { page, limit }) {
      const offset = (page - 1) * limit;
      const [rows] = await db.query(
        `SELECT q.id, q.course_id AS courseId, q.title, q.description,
                q.duration_minutes AS durationMinutes, q.open_time AS openTime,
                q.close_time AS closeTime, q.show_score_immediately AS showScoreImmediately,
                q.status,
                EXISTS(SELECT 1 FROM attempts a WHERE a.quiz_id = q.id) AS hasAttempts,
                COUNT(DISTINCT question.id) AS questionCount
         FROM quizzes q
         LEFT JOIN questions question ON question.quiz_id = q.id
         WHERE q.course_id = ? AND q.deleted_at IS NULL
         GROUP BY q.id
         ORDER BY q.created_at DESC, q.id DESC
         LIMIT ? OFFSET ?`,
        [courseId, limit, offset]
      );
      const [countRows] = await db.query(
        'SELECT COUNT(*) AS total FROM quizzes WHERE course_id = ? AND deleted_at IS NULL',
        [courseId]
      );
      return { items: rows, total: Number(countRows[0].total) };
    },

    async listStudentQuizzes(courseId, studentId, { page, limit, now }) {
      const offset = (page - 1) * limit;
      const [rows] = await db.query(
        `SELECT q.id, q.course_id AS courseId, q.title, q.description,
                q.duration_minutes AS durationMinutes, q.open_time AS openTime,
                q.close_time AS closeTime, q.show_score_immediately AS showScoreImmediately,
                q.status, a.id AS attemptId, a.status AS attemptStatus,
                CASE
                  WHEN q.show_score_immediately = TRUE OR q.status = 'CLOSED' OR q.close_time <= ?
                    THEN a.score
                  ELSE NULL
                END AS score,
                CASE
                  WHEN q.status = 'PUBLISHED' AND q.open_time <= ? AND q.close_time > ?
                       AND a.id IS NULL
                    THEN TRUE
                  ELSE FALSE
                END AS canStart
         FROM quizzes q
         LEFT JOIN attempts a ON a.quiz_id = q.id AND a.student_id = ?
         WHERE q.course_id = ? AND q.deleted_at IS NULL
           AND q.status IN ('PUBLISHED', 'CLOSED')
         ORDER BY q.open_time DESC, q.id DESC
         LIMIT ? OFFSET ?`,
        [now, now, now, studentId, courseId, limit, offset]
      );
      const [countRows] = await db.query(
        `SELECT COUNT(*) AS total
         FROM quizzes
         WHERE course_id = ? AND deleted_at IS NULL AND status IN ('PUBLISHED', 'CLOSED')`,
        [courseId]
      );
      return { items: rows, total: Number(countRows[0].total) };
    },

    async findQuizQuestions(quizId) {
      const [rows] = await db.query(
        `SELECT q.id AS questionId, q.content AS questionContent,
                q.order_index AS questionOrder, o.id AS optionId,
                o.content AS optionContent, o.is_correct AS isCorrect,
                o.order_index AS optionOrder
         FROM questions q
         LEFT JOIN options o ON o.question_id = q.id
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
        if (row.optionId != null) {
          questions.get(row.questionId).options.push({
            id: row.optionId,
            content: row.optionContent,
            isCorrect: Boolean(row.isCorrect),
            orderIndex: row.optionOrder
          });
        }
      }
      return [...questions.values()];
    },

    async findQuizForUpdate(connection, quizId) {
      const [rows] = await connection.query(
        `SELECT id, course_id AS courseId, title, description,
                duration_minutes AS durationMinutes, open_time AS openTime,
                close_time AS closeTime,
                show_score_immediately AS showScoreImmediately,
                status,
                EXISTS(SELECT 1 FROM attempts a WHERE a.quiz_id = quizzes.id) AS hasAttempts
         FROM quizzes
         WHERE id = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [quizId]
      );
      return rows[0] || null;
    },

    async countQuestions(connection, quizId) {
      const [rows] = await connection.query(
        'SELECT COUNT(*) AS total FROM questions WHERE quiz_id = ?',
        [quizId]
      );
      return Number(rows[0].total);
    },

    async hasAttempts(connection, quizId) {
      const [rows] = await connection.query(
        'SELECT COUNT(*) AS total FROM attempts WHERE quiz_id = ?',
        [quizId]
      );
      return Number(rows[0].total) > 0;
    },

    async replaceQuestions(connection, quizId, questions) {
      await connection.query('DELETE FROM questions WHERE quiz_id = ?', [quizId]);
      await insertQuestions(connection, quizId, questions);
    },

    async updateQuiz(connection, quizId, quiz) {
      await connection.query(
        `UPDATE quizzes
         SET title = ?, description = ?, duration_minutes = ?,
             open_time = ?, close_time = ?, show_score_immediately = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          quiz.title,
          quiz.description,
          quiz.durationMinutes,
          quiz.openTime,
          quiz.closeTime,
          quiz.showScoreImmediately,
          quizId
        ]
      );
    },

    async findQuestion(connection, questionId) {
      const [rows] = await connection.query(
        `SELECT q.id, q.quiz_id AS quizId, q.content, z.course_id AS courseId
         FROM questions q
         JOIN quizzes z ON z.id = q.quiz_id
         WHERE q.id = ? AND z.deleted_at IS NULL`,
        [questionId]
      );
      return rows[0] || null;
    },

    async deleteQuestion(connection, questionId, quizId) {
      const [result] = await connection.query(
        'DELETE FROM questions WHERE id = ? AND quiz_id = ?',
        [questionId, quizId]
      );
      return result.affectedRows > 0;
    },

    async publishQuiz(connection, quizId) {
      await connection.query(
        'UPDATE quizzes SET status = \'PUBLISHED\' WHERE id = ? AND status = \'DRAFT\'',
        [quizId]
      );
    },

    async loadQuiz(quizId) {
      const quiz = await this.findQuiz(quizId);
      if (!quiz) {
        return null;
      }
      const questions = await this.findQuizQuestions(quizId);
      return { ...quiz, questions };
    }
  };
}

module.exports = createQuizRepository;
