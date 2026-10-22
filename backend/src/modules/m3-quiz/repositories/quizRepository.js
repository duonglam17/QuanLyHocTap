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
        `SELECT id, course_id AS courseId, title, description, duration_minutes AS durationMinutes,
                open_time AS openTime, close_time AS closeTime,
                show_score_immediately AS showScoreImmediately, status, has_attempts AS hasAttempts
         FROM quizzes
         WHERE id = ? AND deleted_at IS NULL`,
        [quizId]
      );
      return rows[0] || null;
    },

    async findQuizForUpdate(connection, quizId) {
      const [rows] = await connection.query(
        `SELECT id, course_id AS courseId, status, has_attempts AS hasAttempts
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

      const [questions] = await db.query(
        `SELECT id, content, order_index AS orderIndex
         FROM questions WHERE quiz_id = ? ORDER BY order_index, id`,
        [quizId]
      );

      for (const question of questions) {
        const [options] = await db.query(
          `SELECT id, content, is_correct AS isCorrect, order_index AS orderIndex
           FROM options WHERE question_id = ? ORDER BY order_index, id`,
          [question.id]
        );
        question.options = options;
      }

      return { ...quiz, questions };
    }
  };
}

module.exports = createQuizRepository;
