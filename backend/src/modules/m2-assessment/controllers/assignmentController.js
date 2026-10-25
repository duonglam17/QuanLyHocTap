/**
 * LMS Mini - Module M2 Assessment
 * Assignment Controller
 * Tầng giao tiếp HTTP Request/Response cho các chức năng liên quan tới Bài tập
 */

class AssignmentController {
  constructor(assignmentService) {
    this.assignmentService = assignmentService;
  }

  /**
   * POST /api/courses/:courseId/assignments
   * POST /api/assignments
   * US-07: Giảng viên tạo và giao bài tập mới
   */
  createAssignment = async (req, res, next) => {
    try {
      const courseId = req.params.courseId || req.body.course_id || req.body.courseId;
      const instructorId = req.user ? req.user.id : null;

      const {
        title,
        description,
        due_date,
        dueDate,
        deadline,
        max_score,
        maxScore,
        allow_late_submission,
        allowLateSubmission,
        allow_late,
        allowLate
      } = req.body;

      const created = await this.assignmentService.createAssignment({
        courseId,
        instructorId,
        title,
        description,
        dueDate: due_date || dueDate || deadline,
        maxScore: max_score !== undefined ? max_score : maxScore,
        allowLateSubmission:
          allow_late_submission !== undefined
            ? allow_late_submission
            : allowLateSubmission !== undefined
            ? allowLateSubmission
            : allow_late !== undefined
            ? allow_late
            : allowLate
      });

      return res.status(201).json({
        success: true,
        message: 'Giao bài tập mới thành công.',
        data: created.toJSON ? created.toJSON() : created
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/courses/:courseId/assignments
   * Lấy danh sách bài tập của khóa học
   */
  getCourseAssignments = async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const assignments = await this.assignmentService.getAssignmentsByCourseId(courseId);

      return res.status(200).json({
        success: true,
        count: assignments.length,
        data: assignments.map((a) => (a.toJSON ? a.toJSON() : a))
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/assignments/:id
   * Xem chi tiết bài tập
   */
  getAssignmentDetail = async (req, res, next) => {
    try {
      const { id } = req.params;
      const assignment = await this.assignmentService.getAssignmentById(id, req.user);

      return res.status(200).json({
        success: true,
        data: assignment.toJSON ? assignment.toJSON() : assignment
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /api/assignments/:id
   * Xóa bài tập (EC-09 kiểm tra bài nộp)
   */
  deleteAssignment = async (req, res, next) => {
    try {
      const { id } = req.params;
      const instructorId = req.user ? req.user.id : null;

      const result = await this.assignmentService.deleteAssignment(id, instructorId);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AssignmentController;
