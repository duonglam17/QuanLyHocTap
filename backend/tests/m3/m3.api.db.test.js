const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const { ConflictError } = require('../../src/common/errors');
const sanitizeText = require('../../src/common/sanitizeText');
const withTransaction = require('../../src/common/withTransaction');
const createAttemptRepository = require('../../src/modules/m3-quiz/repositories/attemptRepository');
const createAttemptRoutes = require('../../src/modules/m3-quiz/routes/attemptRoutes');
const createAnnouncementRepository = require('../../src/modules/m3-quiz/repositories/announcementRepository');
const createAnnouncementRoutes = require('../../src/modules/m3-quiz/routes/announcementRoutes');
const createDiscussionRepository = require('../../src/modules/m3-quiz/repositories/discussionRepository');
const createDiscussionRoutes = require('../../src/modules/m3-quiz/routes/discussionRoutes');
const createQuizRepository = require('../../src/modules/m3-quiz/repositories/quizRepository');
const createQuizRoutes = require('../../src/modules/m3-quiz/routes/quizRoutes');
const { createAnnouncementService } = require('../../src/modules/m3-quiz/services/announcementService');
const { createAttemptService } = require('../../src/modules/m3-quiz/services/attemptService');
const { createDiscussionService } = require('../../src/modules/m3-quiz/services/discussionService');
const { createQuizService } = require('../../src/modules/m3-quiz/services/quizService');

const initialServerTime = new Date('2026-10-29T10:19:00.000Z');

function createAuthorization(userId, role) {
  const token = jwt.sign(
    { user_id: userId, role, token_version: 1 },
    config.JWT_SECRET
  );
  return `Bearer ${token}`;
}

function createQuizData(title, openTime, closeTime) {
  return {
    title,
    description: 'M3 API integration quiz',
    duration_minutes: 1,
    open_time: openTime,
    close_time: closeTime,
    show_score_immediately: true,
    questions: [
      {
        content: 'Which option is correct?',
        options: [
          { content: 'Correct', is_correct: true },
          { content: 'Incorrect', is_correct: false }
        ]
      }
    ]
  };
}

test('M3 API uses MySQL repositories for authorization, quiz timing, answers, and grading', async (t) => {
  const testDatabaseName = process.env.M3_TEST_DB_NAME;
  if (!testDatabaseName) {
    t.skip('Set M3_TEST_DB_NAME to a dedicated MySQL database ending in _test.');
    return;
  }
  if (!/_test$/.test(testDatabaseName)) {
    throw new Error('M3_TEST_DB_NAME must identify a dedicated database ending in _test.');
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: testDatabaseName,
      connectTimeout: 2000,
      timezone: '+07:00'
    });
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      t.skip(`MySQL test database is unavailable (${error.code}). Start MySQL and rerun this test.`);
      return;
    }
    throw error;
  }

  const originalQuery = db.query;
  const originalGetPool = db.getPool;

  try {
    await connection.query("SET time_zone = '+07:00'");
    await connection.query(`
      CREATE TEMPORARY TABLE users (
        id BIGINT PRIMARY KEY,
        status ENUM('ACTIVE', 'LOCKED', 'TEMPORARY_LOCKED') NOT NULL,
        token_version INT UNSIGNED NOT NULL,
        deleted_at DATETIME NULL
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TEMPORARY TABLE quizzes (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        course_id BIGINT NOT NULL,
        creator_id BIGINT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT NULL,
        duration_minutes INT NOT NULL,
        open_time DATETIME NOT NULL,
        close_time DATETIME NOT NULL,
        show_score_immediately BOOLEAN NOT NULL DEFAULT TRUE,
        status ENUM('DRAFT', 'PUBLISHED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
        has_attempts BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        UNIQUE KEY uk_quiz_id_course_creator (id, course_id, creator_id)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TEMPORARY TABLE questions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        quiz_id BIGINT NOT NULL,
        content TEXT NOT NULL,
        order_index INT NOT NULL DEFAULT 1
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TEMPORARY TABLE options (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        question_id BIGINT NOT NULL,
        content TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL DEFAULT FALSE,
        order_index INT NOT NULL DEFAULT 1
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TEMPORARY TABLE attempts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        quiz_id BIGINT NOT NULL,
        student_id BIGINT NOT NULL,
        client_instance_id VARCHAR(128) NOT NULL,
        session_token VARCHAR(64) NOT NULL,
        takeover_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
        last_takeover_at DATETIME NULL,
        started_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        submitted_at DATETIME NULL,
        total_questions INT NOT NULL DEFAULT 0,
        correct_answers_count INT NOT NULL DEFAULT 0,
        score DECIMAL(4,2) NULL,
        status ENUM('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED') NOT NULL DEFAULT 'IN_PROGRESS',
        UNIQUE KEY uk_quiz_student (quiz_id, student_id),
        INDEX idx_attempts_status_expires (status, expires_at)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TEMPORARY TABLE attempt_answers (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        attempt_id BIGINT NOT NULL,
        question_id BIGINT NOT NULL,
        selected_option_id BIGINT NULL,
        saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_attempt_question (attempt_id, question_id)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TEMPORARY TABLE announcements (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        course_id BIGINT NOT NULL,
        author_id BIGINT NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TEMPORARY TABLE discussions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        course_id BIGINT NOT NULL,
        lesson_id BIGINT NULL,
        parent_discussion_id BIGINT NULL,
        author_id BIGINT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_discussions_lesson_parent (lesson_id, parent_discussion_id)
      ) ENGINE=InnoDB
    `);
    await connection.query(
      'INSERT INTO users (id, status, token_version) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)',
      [1, 'ACTIVE', 1, 2, 'ACTIVE', 1, 3, 'ACTIVE', 1, 4, 'ACTIVE', 1, 5, 'ACTIVE', 1, 6, 'ACTIVE', 1]
    );

    db.query = (sql, params) => connection.query(sql, params);
    const transactionConnection = {
      query: (sql, params) => connection.query(sql, params),
      beginTransaction: () => connection.beginTransaction(),
      commit: () => connection.commit(),
      rollback: () => connection.rollback(),
      release() {}
    };
    db.getPool = () => ({
      async getConnection() {
        return transactionConnection;
      }
    });

    let serverTime = new Date(initialServerTime);
    const clock = { now: () => new Date(serverTime) };
    const courseAccess = {
      async getCourse(courseId) {
        return Number(courseId) === 1
          ? { id: 1, ownerId: 2, title: 'Test course', status: 'PUBLISHED' }
          : null;
      },
      async isOwner(userId, courseId) {
        return Number(userId) === 2 && Number(courseId) === 1;
      },
      async isEnrolled(userId, courseId) {
        return Number(courseId) === 1 && [3, 5].includes(Number(userId));
      },
      async assertCourseWritable() {},
      async getLessonSummary(lessonId) {
        return Number(lessonId) === 10 ? { id: 10, courseId: 1 } : null;
      },
      async getUsersBrief(userIds) {
        return userIds.map((id) => ({
          id,
          username: `user-${id}`,
          fullName: `Test User ${id}`,
          role: Number(id) === 2 ? 'GIANG_VIEN' : 'SINH_VIEN'
        }));
      }
    };
    const quizRepository = createQuizRepository(db);
    const quizService = createQuizService({
      repository: quizRepository,
      getCourseAccess: () => courseAccess,
      withTransaction: (work) => withTransaction(work, db.getPool()),
      sanitizeText,
      clock
    });
    const attemptRepository = createAttemptRepository(db);
    const attemptService = createAttemptService({
      repository: attemptRepository,
      getCourseAccess: () => courseAccess,
      withTransaction: (work) => withTransaction(work, db.getPool()),
      clock,
      logger: { error() {} },
      createSessionToken: () => 'integration-session-token'
    });
    const announcementService = createAnnouncementService({
      repository: createAnnouncementRepository(db),
      getCourseAccess: () => courseAccess,
      getNotificationsPort: () => ({
        async notifyCourseStudents() {}
      }),
      withTransaction: (work) => withTransaction(work, db.getPool()),
      sanitizeText,
      logger: { error() {} }
    });
    const discussionService = createDiscussionService({
      repository: createDiscussionRepository(db),
      getCourseAccess: () => courseAccess,
      withTransaction: (work) => withTransaction(work, db.getPool()),
      sanitizeText
    });
    const app = express();
    app.use(express.json());
    app.use('/api', createQuizRoutes(quizService));
    app.use('/api', createAttemptRoutes(attemptService));
    app.use('/api', createAnnouncementRoutes(announcementService));
    app.use('/api', createDiscussionRoutes(discussionService));
    app.use(errorHandler);

    const ownerAuth = createAuthorization(2, 'GIANG_VIEN');
    const studentAuth = createAuthorization(3, 'SINH_VIEN');

    const unauthenticated = await request(app).get('/api/quizzes/999');
    assert.equal(unauthenticated.status, 401);

    const malformedJson = await request(app)
      .post('/api/courses/1/quizzes')
      .set('Authorization', ownerAuth)
      .set('Content-Type', 'application/json')
      .send('{"title":');
    assert.equal(malformedJson.status, 400);

    const wrongRole = await request(app)
      .post('/api/courses/1/quizzes')
      .set('Authorization', studentAuth)
      .send(createQuizData('Wrong role', '2026-10-29 17:20:00', '2026-10-29 18:00:00'));
    assert.equal(wrongRole.status, 403);

    const studentAnnouncement = await request(app)
      .post('/api/courses/1/announcements')
      .set('Authorization', studentAuth)
      .send({ title: 'Student post', content: 'Not allowed' });
    assert.equal(studentAnnouncement.status, 403);

    const otherInstructorAnnouncement = await request(app)
      .post('/api/courses/1/announcements')
      .set('Authorization', createAuthorization(6, 'GIANG_VIEN'))
      .send({ title: 'Other instructor post', content: 'Not allowed' });
    assert.equal(otherInstructorAnnouncement.status, 403);

    const announcement = await request(app)
      .post('/api/courses/1/announcements')
      .set('Authorization', ownerAuth)
      .send({
        title: '<b>Course update</b>',
        content: '<script>alert(1)</script>Class starts at 8 AM'
      });
    assert.equal(announcement.status, 201);
    assert.equal(announcement.body.title, 'Course update');
    assert.equal(announcement.body.content.includes('<script>'), false);

    const memberAnnouncements = await request(app)
      .get('/api/courses/1/announcements')
      .set('Authorization', studentAuth);
    assert.equal(memberAnnouncements.status, 200);
    assert.equal(memberAnnouncements.body.items[0].id, announcement.body.id);

    const outsiderAnnouncements = await request(app)
      .get('/api/courses/1/announcements')
      .set('Authorization', createAuthorization(4, 'SINH_VIEN'));
    assert.equal(outsiderAnnouncements.status, 403);

    const discussion = await request(app)
      .post('/api/lessons/10/comments')
      .set('Authorization', studentAuth)
      .send({ content: '<script>alert(1)</script>Question about the lesson' });
    assert.equal(discussion.status, 201);
    assert.equal(discussion.body.content.includes('<script>'), false);
    assert.equal(discussion.body.author.id, 3);

    const outsiderDiscussion = await request(app)
      .post('/api/lessons/10/comments')
      .set('Authorization', createAuthorization(4, 'SINH_VIEN'))
      .send({ content: 'Outsider comment' });
    assert.equal(outsiderDiscussion.status, 403);

    const reply = await request(app)
      .post(`/api/comments/${discussion.body.id}/replies`)
      .set('Authorization', createAuthorization(5, 'SINH_VIEN'))
      .send({ content: 'Enrolled student reply' });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.parentDiscussionId, discussion.body.id);

    const thread = await request(app)
      .get('/api/lessons/10/comments')
      .set('Authorization', studentAuth);
    assert.equal(thread.status, 200);
    assert.equal(thread.body.items[0].replies[0].id, reply.body.id);

    const invalidQuiz = await request(app)
      .post('/api/courses/1/quizzes')
      .set('Authorization', ownerAuth)
      .send(createQuizData('Invalid quiz', '2026-10-29 17:20:00', '2026-10-29 18:00:00'));
    assert.equal(invalidQuiz.status, 201);
    const invalidQuizId = invalidQuiz.body.id;
    const invalidQuestion = await request(app)
      .put(`/api/quizzes/${invalidQuizId}/questions`)
      .set('Authorization', ownerAuth)
      .send({ questions: [{ content: 'Question?', options: [{ content: 'Only option', is_correct: true }] }] });
    assert.equal(invalidQuestion.status, 422);

    const created = await request(app)
      .post('/api/courses/1/quizzes')
      .set('Authorization', ownerAuth)
      .send(createQuizData('Server timed quiz', '2026-10-29 17:20:00', '2026-10-29 18:00:00'));
    assert.equal(created.status, 201);
    const quizId = created.body.id;

    const outsiderStart = await request(app)
      .post(`/api/quizzes/${quizId}/start`)
      .set('Authorization', createAuthorization(4, 'SINH_VIEN'))
      .send({ clientInstanceId: 'outsider-tab' });
    assert.equal(outsiderStart.status, 403);

    const notFound = await request(app)
      .get('/api/quizzes/999')
      .set('Authorization', studentAuth);
    assert.equal(notFound.status, 404);

    const published = await request(app)
      .post(`/api/quizzes/${quizId}/publish`)
      .set('Authorization', ownerAuth);
    assert.equal(published.status, 200);
    assert.equal(published.body.status, 'PUBLISHED');

    const beforeOpen = await request(app)
      .post(`/api/quizzes/${quizId}/start`)
      .set('Authorization', studentAuth)
      .send({ clientInstanceId: 'student-tab' });
    assert.equal(beforeOpen.status, 409);

    serverTime = new Date('2026-10-29T10:20:00.000Z');
    const started = await request(app)
      .post(`/api/quizzes/${quizId}/start`)
      .set('Authorization', studentAuth)
      .send({ clientInstanceId: 'student-tab' });
    assert.equal(started.status, 200);
    assert.equal(started.body.startedAt, serverTime.toISOString());
    assert.equal(started.body.expiresAt, '2026-10-29T10:21:00.000Z');
    assert.equal(JSON.stringify(started.body).includes('isCorrect'), false);

    const session = {
      clientInstanceId: started.body.clientInstanceId,
      sessionToken: started.body.sessionToken
    };
    const questionId = started.body.questions[0].id;
    const correctOptionId = started.body.questions[0].options[0].id;
    const invalidAnswer = await request(app)
      .patch(`/api/attempts/${started.body.attemptId}/save-answer`)
      .set('Authorization', studentAuth)
      .send({
        ...session,
        questionId,
        optionId: 99999
      });
    assert.equal(invalidAnswer.status, 422);

    const idorAnswer = await request(app)
      .patch(`/api/attempts/${started.body.attemptId}/save-answer`)
      .set('Authorization', createAuthorization(5, 'SINH_VIEN'))
      .send({ ...session, questionId, optionId: correctOptionId });
    assert.equal(idorAnswer.status, 403);

    const savedAnswer = await request(app)
      .patch(`/api/attempts/${started.body.attemptId}/save-answer`)
      .set('Authorization', studentAuth)
      .send({ ...session, questionId, optionId: correctOptionId });
    assert.equal(savedAnswer.status, 200);
    assert.equal(savedAnswer.body.saved, true);

    serverTime = new Date('2026-10-29T10:21:00.000Z');
    const originalMarkQuizHasAttempts = attemptRepository.markQuizHasAttempts;
    attemptRepository.markQuizHasAttempts = async () => {
      throw new ConflictError('Simulated failure before transaction commit.');
    };
    let failedSubmit;
    try {
      failedSubmit = await request(app)
        .post(`/api/attempts/${started.body.attemptId}/submit`)
        .set('Authorization', studentAuth)
        .send(session);
    } finally {
      attemptRepository.markQuizHasAttempts = originalMarkQuizHasAttempts;
    }
    assert.equal(failedSubmit.status, 409);

    const [rolledBackAttempt] = await connection.query(
      'SELECT status, score FROM attempts WHERE id = ?',
      [started.body.attemptId]
    );
    const [rolledBackQuiz] = await connection.query(
      'SELECT has_attempts AS hasAttempts FROM quizzes WHERE id = ?',
      [quizId]
    );
    assert.equal(rolledBackAttempt[0].status, 'IN_PROGRESS');
    assert.equal(rolledBackAttempt[0].score, null);
    assert.equal(Boolean(rolledBackQuiz[0].hasAttempts), false);

    const autoSubmitted = await request(app)
      .post(`/api/attempts/${started.body.attemptId}/submit`)
      .set('Authorization', studentAuth)
      .send(session);
    assert.equal(autoSubmitted.status, 200);
    assert.equal(autoSubmitted.body.status, 'AUTO_SUBMITTED');
    assert.equal(autoSubmitted.body.score, 10);

    const result = await request(app)
      .get(`/api/attempts/${started.body.attemptId}/result`)
      .set('Authorization', studentAuth);
    assert.equal(result.status, 200);
    assert.equal(result.body.status, 'AUTO_SUBMITTED');
    assert.equal(result.body.score, 10);

    const idorResult = await request(app)
      .get(`/api/attempts/${started.body.attemptId}/result`)
      .set('Authorization', createAuthorization(5, 'SINH_VIEN'));
    assert.equal(idorResult.status, 403);

    const lockedEdit = await request(app)
      .patch(`/api/quizzes/${quizId}`)
      .set('Authorization', ownerAuth)
      .send({ title: 'Edit after attempt' });
    assert.equal(lockedEdit.status, 409);

    const [persistedRows] = await connection.query(
      'SELECT status, total_questions AS totalQuestions, correct_answers_count AS correctAnswersCount, score FROM attempts WHERE id = ?',
      [started.body.attemptId]
    );
    assert.deepEqual(persistedRows[0], {
      status: 'AUTO_SUBMITTED',
      totalQuestions: 1,
      correctAnswersCount: 1,
      score: '10.00'
    });

    const closeTimeQuiz = await request(app)
      .post('/api/courses/1/quizzes')
      .set('Authorization', ownerAuth)
      .send(createQuizData('Closing boundary quiz', '2026-10-29 17:20:00', '2026-10-29 18:00:00'));
    assert.equal(closeTimeQuiz.status, 201);
    await request(app)
      .post(`/api/quizzes/${closeTimeQuiz.body.id}/publish`)
      .set('Authorization', ownerAuth)
      .expect(200);
    serverTime = new Date('2026-10-29T11:00:00.000Z');
    const atClose = await request(app)
      .post(`/api/quizzes/${closeTimeQuiz.body.id}/start`)
      .set('Authorization', createAuthorization(5, 'SINH_VIEN'))
      .send({ clientInstanceId: 'second-student-tab' });
    assert.equal(atClose.status, 409);
  } finally {
    db.query = originalQuery;
    db.getPool = originalGetPool;
    await connection.end();
  }
});
