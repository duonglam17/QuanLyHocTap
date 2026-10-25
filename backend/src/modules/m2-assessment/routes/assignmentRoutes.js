/**
 * LMS Mini - Module M2 Assessment
 * Assignment Routes (US-07: Giao bài tập)
 */

const { Router } = require('express');
const { requireAuth, requireRole } = require('../../../common');
const AssignmentRepository = require('../repositories/assignmentRepository');
const AssignmentService = require('../services/assignmentService');
const AssignmentController = require('../controllers/assignmentController');

const router = Router();

// Khởi tạo các tầng theo Dependency Injection
const assignmentRepository = new AssignmentRepository();
const assignmentService = new AssignmentService({ assignmentRepository });
const assignmentController = new AssignmentController(assignmentService);

// 1. Tạo bài tập mới (Chỉ dành cho Giảng viên và Admin)
router.post(
  '/courses/:courseId/assignments',
  requireAuth,
  requireRole(['GIANG_VIEN', 'ADMIN']),
  assignmentController.createAssignment
);

router.post(
  '/assignments',
  requireAuth,
  requireRole(['GIANG_VIEN', 'ADMIN']),
  assignmentController.createAssignment
);

// 2. Lấy danh sách bài tập của khóa học
router.get(
  '/courses/:courseId/assignments',
  requireAuth,
  assignmentController.getCourseAssignments
);

router.patch(
  '/assignments/:id',
  requireAuth,
  requireRole(['GIANG_VIEN', 'ADMIN']),
  assignmentController.updateAssignment
);

// 3. Xem chi tiết bài tập
router.get(
  '/assignments/:id',
  requireAuth,
  requireRole(['GIANG_VIEN', 'SINH_VIEN', 'ADMIN']),
  assignmentController.getAssignmentDetail
);

// 4. Xóa bài tập (Áp dụng EC-09 kiểm tra bài nộp)
router.delete(
  '/assignments/:id',
  requireAuth,
  requireRole(['GIANG_VIEN', 'ADMIN']),
  assignmentController.deleteAssignment
);

module.exports = {
  router,
  assignmentController,
  assignmentService,
  assignmentRepository
};
