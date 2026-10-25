class SubmissionController {
  constructor(submissionService) {
    this.submissionService = submissionService;
  }

  getMySubmission = async (req, res, next) => {
    try {
      const submission = await this.submissionService.getMySubmission({
        assignmentId: req.params.assignmentId,
        studentId: req.user.id
      });

      return res.status(200).json({
        success: true,
        data: submission?.toJSON ? submission.toJSON() : submission
      });
    } catch (err) {
      next(err);
    }
  };

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
