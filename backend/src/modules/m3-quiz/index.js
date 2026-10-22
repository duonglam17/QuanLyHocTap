/**
 * =============================================================================
 * MODULE M3: ĐỀ THI TRẮC NGHIỆM, TỰ ĐỘNG CHẤM & TƯƠNG TÁC LỚP HỌC
 * =============================================================================
 * Phụ trách bởi: Sinh viên 3 (Thành viên C)
 * Phạm vi: Epic E4 (Thi trắc nghiệm & Tự động chấm), Epic E6 (Thông báo & Thảo luận)
 * =============================================================================
 */

const { Router } = require('express');
const createNotificationRepository = require('./repositories/notificationRepository');
const { createNotificationService } = require('./services/notificationService');
const createNotificationRoutes = require('./routes/notificationRoutes');
const createQuizRepository = require('./repositories/quizRepository');
const { createQuizService } = require('./services/quizService');
const createQuizRoutes = require('./routes/quizRoutes');

const router = Router();
let notificationService;
let quizService;

const notificationsPort = {
  notifyUser(...args) {
    return notificationService.notifyUser(...args);
  },
  notifyCourseStudents(...args) {
    return notificationService.notifyCourseStudents(...args);
  },
  getNotifications(...args) {
    return notificationService.getNotifications(...args);
  },
  markNotificationRead(...args) {
    return notificationService.markNotificationRead(...args);
  }
};

const quizRoutesService = {
  createQuiz(...args) {
    return quizService.createQuiz(...args);
  },
  updateQuestions(...args) {
    return quizService.updateQuestions(...args);
  },
  deleteQuestion(...args) {
    return quizService.deleteQuestion(...args);
  },
  publishQuiz(...args) {
    return quizService.publishQuiz(...args);
  }
};

// Route kiểm tra hoạt động của module M3: GET /api/m3-quiz/ping
router.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'ok',
    module: 'm3-quiz',
    message: 'Module M3 (Quiz Engine, Auto-grading, Announcements, Discussions) is operational',
    timestamp: new Date().toISOString()
  });
});

router.use('/notifications', createNotificationRoutes(notificationsPort));
router.use(createQuizRoutes(quizRoutesService));

function init(ctx) {
  const repository = createNotificationRepository(ctx.db);
  notificationService = createNotificationService({
    repository,
    getCourseAccess: () => ctx.contracts.getPort('courseAccess', { optional: true }),
    logger: ctx.logger,
    sanitizeText: ctx.common.sanitizeText
  });

  ctx.contracts.registerPort('notifications', notificationsPort);

  const quizRepository = createQuizRepository(ctx.db);
  quizService = createQuizService({
    repository: quizRepository,
    getCourseAccess: () => ctx.contracts.getPort('courseAccess', { optional: true }),
    withTransaction: ctx.common.withTransaction,
    sanitizeText: ctx.common.sanitizeText
  });
  ctx.contracts.registerPort('quizUsage', {
    hasCourseData(...args) {
      return quizRepository.hasCourseData(...args);
    },
    hasUserData(...args) {
      return quizRepository.hasUserData(...args);
    }
  });
}

// Sau này các route nghiệp vụ sẽ được gắn tại đây:
// router.use('/quizzes', quizRoutes);
// router.use('/attempts', attemptRoutes);
// router.use('/announcements', announcementRoutes);
// router.use('/discussions', discussionRoutes);

module.exports = { router, init };
