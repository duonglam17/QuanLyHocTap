class StudentGradebookController {
  constructor(studentGradebookService) {
    this.studentGradebookService = studentGradebookService;
  }

  getMyCourseGrades = async (req, res, next) => {
    try {
      const gradebook = await this.studentGradebookService.getForStudent({
        courseId: req.params.courseId,
        studentId: req.user.id
      });
      return res.status(200).json({
        success: true,
        data: gradebook.toJSON ? gradebook.toJSON() : gradebook
      });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = StudentGradebookController;
