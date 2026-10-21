/**
 * =============================================================================
 * MODULE M3: ĐỀ THI TRẮC NGHIỆM, TỰ ĐỘNG CHẤM & TƯƠNG TÁC LỚP HỌC
 * =============================================================================
 * Phụ trách bởi: Sinh viên 3 (Thành viên C)
 * Phạm vi: Epic E4 (Thi trắc nghiệm & Tự động chấm), Epic E6 (Thông báo & Thảo luận)
 * =============================================================================
 */

const { Router } = require('express');

const router = Router();

// Route kiểm tra hoạt động của module M3: GET /api/m3-quiz/ping
router.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'ok',
    module: 'm3-quiz',
    message: 'Module M3 (Quiz Engine, Auto-grading, Announcements, Discussions) is operational',
    timestamp: new Date().toISOString()
  });
});

// Sau này các route nghiệp vụ sẽ được gắn tại đây:
// router.use('/quizzes', quizRoutes);
// router.use('/attempts', attemptRoutes);
// router.use('/announcements', announcementRoutes);
// router.use('/discussions', discussionRoutes);

module.exports = router;

