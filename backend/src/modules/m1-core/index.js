/**
 * =============================================================================
 * MODULE M1: NỀN TẢNG, NGƯỜI DÙNG, KHÓA HỌC, BÀI GIẢNG & LỊCH HỌC
 * =============================================================================
 * Phụ trách bởi: Sinh viên 1 (Thành viên A)
 * Phạm vi: Epic E1 (Xác thực & Người dùng), Epic E2 (Khóa học, Bài giảng & Lịch học)
 * =============================================================================
 */

const { Router } = require('express');

const router = Router();

// Route kiểm tra hoạt động của module M1: GET /api/m1-core/ping
router.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'ok',
    module: 'm1-core',
    message: 'Module M1 (Core: Auth, User, Course, Material, Schedule) is operational',
    timestamp: new Date().toISOString()
  });
});

// Sau này các route nghiệp vụ sẽ được gắn tại đây:
// router.use('/auth', authRoutes);
// router.use('/courses', courseRoutes);
// router.use('/schedules', scheduleRoutes);

module.exports = router;

