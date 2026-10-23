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
const createAttemptRepository = require('./repositories/attemptRepository');
const { createAttemptService } = require('./services/attemptService');
const createAttemptRoutes = require('./routes/attemptRoutes');
const createQuizResultsRepository = require('./repositories/quizResultsRepository');
const createAnnouncementRepository = require('./repositories/announcementRepository');
const { createAnnouncementService } = require('./services/announcementService');
const createAnnouncementRoutes = require('./routes/announcementRoutes');
const createDiscussionRepository = require('./repositories/discussionRepository');
const { createDiscussionService } = require('./services/discussionService');
const createDiscussionRoutes = require('./routes/discussionRoutes');
const cron = require('node-cron');

const router = Router();
let notificationService;
let quizService;
let attemptService;
let autoSubmitTask;
let announcementService;
let discussionService;

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
router.use(createAttemptRoutes({
  startAttempt(...args) {
    return attemptService.startAttempt(...args);
  },
  saveAnswer(...args) {
    return attemptService.saveAnswer(...args);
  },
  submitAttempt(...args) {
    return attemptService.submitAttempt(...args);
  }
}));
router.use(createAnnouncementRoutes({
  create(...args) {
    return announcementService.create(...args);
  },
  list(...args) {
    return announcementService.list(...args);
  },
  delete(...args) {
    return announcementService.delete(...args);
  }
}));
router.use(createDiscussionRoutes({
  create(...args) {
    return discussionService.create(...args);
  },
  reply(...args) {
    return discussionService.reply(...args);
  },
  list(...args) {
    return discussionService.list(...args);
  }
}));

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

  const attemptRepository = createAttemptRepository(ctx.db);
  attemptService = createAttemptService({
    repository: attemptRepository,
    getCourseAccess: () => ctx.contracts.getPort('courseAccess', { optional: true }),
    withTransaction: ctx.common.withTransaction,
    clock: ctx.common.clock,
    logger: ctx.logger
  });

  if (autoSubmitTask) {
    autoSubmitTask.stop();
  }
  const scheduler = ctx.cron || cron;
  autoSubmitTask = scheduler.schedule('* * * * *', async () => {
    try {
      await attemptService.autoSubmitExpiredAttempts();
    } catch (error) {
      ctx.logger.error('Không thể quét các lượt thi hết hạn.', error);
    }
  });

  const quizResultsRepository = createQuizResultsRepository(ctx.db, ctx.common.clock);
  ctx.contracts.registerPort('quizResults', {
    getQuizScoresForCourse(...args) {
      return quizResultsRepository.getQuizScoresForCourse(...args);
    },
    getQuizScoresForStudent(...args) {
      return quizResultsRepository.getQuizScoresForStudent(...args);
    }
  });

  const announcementRepository = createAnnouncementRepository(ctx.db);
  announcementService = createAnnouncementService({
    repository: announcementRepository,
    getCourseAccess: () => ctx.contracts.getPort('courseAccess', { optional: true }),
    getNotificationsPort: () => ctx.contracts.getPort('notifications', { optional: true }),
    withTransaction: ctx.common.withTransaction,
    sanitizeText: ctx.common.sanitizeText,
    logger: ctx.logger
  });

  const discussionRepository = createDiscussionRepository(ctx.db);
  discussionService = createDiscussionService({
    repository: discussionRepository,
    getCourseAccess: () => ctx.contracts.getPort('courseAccess', { optional: true }),
    withTransaction: ctx.common.withTransaction,
    sanitizeText: ctx.common.sanitizeText
  });
}

// Sau này các route nghiệp vụ sẽ được gắn tại đây:
// router.use('/quizzes', quizRoutes);
// router.use('/attempts', attemptRoutes);
// router.use('/announcements', announcementRoutes);
// router.use('/discussions', discussionRoutes);

module.exports = { router, init };
