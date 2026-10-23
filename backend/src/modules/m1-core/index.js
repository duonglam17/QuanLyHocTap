/**
 * =============================================================================
 * MODULE M1: NỀN TẢNG, NGƯỜI DÙNG, KHÓA HỌC, BÀI GIẢNG & LỊCH HỌC
 * =============================================================================
 * Phụ trách bởi: Sinh viên 1 (Thành viên A)
 * Phạm vi: Epic E1 (Xác thực & Người dùng), Epic E2 (Khóa học, Bài giảng & Lịch học)
 * =============================================================================
 */

const { Router } = require('express');
const AuthController = require('./controllers/authController');
const CourseController = require('./controllers/courseController');
const EnrollmentController = require('./controllers/enrollmentController');
const UserController = require('./controllers/userController');
const LessonController = require('./controllers/lessonController');
const ScheduleController = require('./controllers/scheduleController');
const AuthRepository = require('./repositories/authRepository');
const CourseRepository = require('./repositories/courseRepository');
const EnrollmentRepository = require('./repositories/enrollmentRepository');
const UserRepository = require('./repositories/userRepository');
const LessonRepository = require('./repositories/lessonRepository');
const MaterialRepository = require('./repositories/materialRepository');
const ScheduleRepository = require('./repositories/scheduleRepository');
const { createCourseRouter } = require('./routes/courseRoutes');
const { createAuthRouter } = require('./routes/authRoutes');
const { createUserRouter } = require('./routes/userRoutes');
const { createLessonRouter } = require('./routes/lessonRoutes');
const { createScheduleRouter } = require('./routes/scheduleRoutes');
const AuthService = require('./services/authService');
const CourseService = require('./services/courseService');
const UserService = require('./services/userService');
const { LessonService } = require('./services/lessonService');
const { ScheduleService } = require('./services/scheduleService');
const {
  createCourseAccessPort,
  getPortAtRequestTime,
  setCourseAccessPortResolver
} = require('./services/courseAccessService');

const router = Router();
const authService = new AuthService({ authRepository: new AuthRepository() });
const userService = new UserService({ userRepository: new UserRepository() });
const lessonService = new LessonService({
  lessonRepository: new LessonRepository(),
  materialRepository: new MaterialRepository(),
  getPortFn: getPortAtRequestTime
});
const scheduleService = new ScheduleService({
  scheduleRepository: new ScheduleRepository(),
  getPortFn: getPortAtRequestTime
});
const courseRepository = new CourseRepository();
const courseService = new CourseService({
  courseRepository,
  enrollmentRepository: new EnrollmentRepository(),
  getPortFn: getPortAtRequestTime
});
const courseController = new CourseController(courseService);
const enrollmentController = new EnrollmentController(courseService);
router.use('/auth', createAuthRouter({ authController: new AuthController(authService) }));
router.use('/users', createUserRouter({ userController: new UserController(userService) }));
router.use('/', createLessonRouter({ lessonController: new LessonController(lessonService) }));
router.use(
  '/',
  createScheduleRouter({ scheduleController: new ScheduleController(scheduleService) })
);
router.use('/courses', createCourseRouter({ courseController, enrollmentController }));

// Route kiểm tra hoạt động của module M1: GET /api/m1-core/ping
router.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'ok',
    module: 'm1-core',
    message: 'Module M1 (Core: Auth, User, Course, Material, Schedule) is operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  router,
  init(ctx) {
    setCourseAccessPortResolver(ctx.contracts.getPort);
    ctx.contracts.registerPort('courseAccess', createCourseAccessPort(courseRepository));
    lessonService.startCleanupJob();
  }
};
