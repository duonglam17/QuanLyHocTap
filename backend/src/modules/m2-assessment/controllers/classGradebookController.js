const { Readable } = require('stream');
const logger = require('../../../common/logger');
const { toCsvStream } = require('../utils/csv');

class ClassGradebookController {
  constructor(classGradebookService) {
    this.classGradebookService = classGradebookService;
  }

  getCourseGradebook = async (req, res, next) => {
    try {
      const result = await this.classGradebookService.getCourseGradebook({
        courseId: req.params.courseId,
        instructorId: req.user.id,
        page: req.query.page
      });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  };

  exportCourseGradebookCsv = async (req, res, next) => {
    try {
      const rows = await this.classGradebookService.streamCourseGradebookCsv({
        courseId: req.params.courseId,
        instructorId: req.user.id
      });
      res.status(200);
      res.type('text/csv; charset=utf-8');
      res.attachment(`BangDiem_${req.params.courseId}.csv`);
      const stream = Readable.from(toCsvStream(rows));
      stream.once('error', (error) => {
        if (res.headersSent) {
          logger.error('Lỗi stream CSV bảng điểm lớp.', error);
          res.destroy(error);
        } else {
          next(error);
        }
      });
      return stream.pipe(res);
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = ClassGradebookController;
