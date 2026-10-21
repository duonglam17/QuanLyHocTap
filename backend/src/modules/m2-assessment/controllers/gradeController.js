const fs = require('fs');
const { NotFoundError } = require('../../../common/errors');
const logger = require('../../../common/logger');

class GradeController {
  constructor({ gradeService, fileSystem = fs } = {}) {
    this.gradeService = gradeService;
    this.fileSystem = fileSystem;
  }

  listCourseSubmissions = async (req, res, next) => {
    try {
      const result = await this.gradeService.listCourseSubmissions({
        courseId: req.params.courseId,
        graderId: req.user.id,
        page: req.query.page,
        pageSize: req.query.page_size
      });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  };

  downloadSubmission = async (req, res, next) => {
    try {
      const file = await this.gradeService.getSubmissionDownload({
        submissionId: req.params.submissionId,
        graderId: req.user.id
      });

      await this.fileSystem.promises.access(file.filePath);
      const stream = this.fileSystem.createReadStream(file.filePath);
      stream.once('error', (error) => {
        if (res.headersSent) {
          logger.error('Lỗi stream tệp bài nộp sau khi gửi header.', error);
          res.destroy(error);
        } else if (error.code === 'ENOENT') {
          next(new NotFoundError('Không tìm thấy tệp bài nộp.'));
        } else {
          next(error);
        }
      });
      res.type(file.mimeType);
      res.attachment(file.originalFilename);
      return stream.pipe(res);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return next(new NotFoundError('Không tìm thấy tệp bài nộp.'));
      }
      return next(error);
    }
  };

  gradeSubmission = async (req, res, next) => {
    try {
      const grade = await this.gradeService.gradeSubmission({
        submissionId: req.params.submissionId,
        graderId: req.user.id,
        score: req.body?.score,
        feedback: req.body?.feedback
      });
      return res.status(200).json({
        success: true,
        message: 'Lưu điểm thành công.',
        data: grade.toJSON ? grade.toJSON() : grade
      });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = GradeController;
