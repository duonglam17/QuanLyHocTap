class SubmissionController {
  constructor(submissionService) {
    this.submissionService = submissionService;
  }

  submitAssignment = async (req, res, next) => {
    try {
      const submission = await this.submissionService.submitAssignment({
        assignmentId: req.params.assignmentId,
        studentId: req.user.id,
        upload: req.file
      });
      const data = submission.toJSON ? submission.toJSON() : submission;

      return res.status(data.submission_count > 1 ? 200 : 201).json({
        success: true,
        message: data.is_late ? 'Đã nộp bài (ghi nhận nộp trễ).' : 'Nộp bài tập thành công.',
        data
      });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = SubmissionController;
