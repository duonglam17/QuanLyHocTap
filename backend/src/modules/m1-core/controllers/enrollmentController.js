class EnrollmentController {
  constructor(courseService) {
    this.courseService = courseService;
  }

  async enroll(req, res, next) {
    try {
      const result = await this.courseService.enrollByCode(req.user.id, req.body.enrollment_key);
      return res.status(201).json({
        message: 'Ghi danh khóa học thành công',
        courseId: result.course.id
      });
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await this.courseService.removeEnrollment(
        req.params.courseId,
        req.params.studentId,
        req.user
      );
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = EnrollmentController;
