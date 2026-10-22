/**
 * =============================================================================
 * MODULE M2: BÀI TẬP TỰ LUẬN, CHẤM ĐIỂM & BẢNG ĐIỂM
 * =============================================================================
 * Phụ trách bởi: Sinh viên 2 (Thành viên B)
 * Phạm vi: Epic E3 (Bài tập tự luận & Chấm điểm), Epic E5 (Bảng điểm & Thống kê)
 * =============================================================================
 */

const { Router } = require('express');
const { router: assignmentRoutes } = require('./routes/assignmentRoutes');
const { router: submissionRoutes } = require('./routes/submissionRoutes');
const { router: gradeRoutes } = require('./routes/gradeRoutes');
const { router: studentGradebookRoutes } = require('./routes/studentGradebookRoutes');
const { createClassGradebookRouter } = require('./routes/classGradebookRoutes');
const ClassGradebookController = require('./controllers/classGradebookController');
const ClassGradebookService = require('./services/classGradebookService');
const ClassGradebookRepository = require('./repositories/classGradebookRepository');
const AssessmentUsageRepository = require('./repositories/assessmentUsageRepository');

const router = Router();

// Route kiểm tra hoạt động của module M2: GET /api/m2-assessment/ping
router.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'ok',
    module: 'm2-assessment',
    message: 'Module M2 (Assessment: Assignment, Submission, Gradebook) is operational',
    timestamp: new Date().toISOString()
  });
});

router.use(assignmentRoutes);
router.use(submissionRoutes);
router.use(gradeRoutes);
router.use(studentGradebookRoutes);
router.use(
  createClassGradebookRouter({
    controller: new ClassGradebookController(
      new ClassGradebookService({
        gradebookRepository: new ClassGradebookRepository()
      })
    )
  })
);

function init(ctx) {
  ctx.contracts.registerPort(
    'assessmentUsage',
    new AssessmentUsageRepository(ctx.db)
  );
}

// Sau này các route nghiệp vụ sẽ được gắn tại đây:
// router.use('/assignments', assignmentRoutes);
// router.use('/submissions', submissionRoutes);
// router.use('/gradebook', gradebookRoutes);

module.exports = { router, init };
