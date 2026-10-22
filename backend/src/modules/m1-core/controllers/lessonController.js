class LessonController {
  constructor(lessonService) {
    this.lessonService = lessonService;
  }

  async listForCourse(req, res, next) {
    try {
      const items = await this.lessonService.listLessons(req.params.courseId, req.user);
      return res.status(200).json({ items });
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const lesson = await this.lessonService.createLesson(req.params.courseId, req.user, req.body);
      return res.status(201).json({ lesson });
    } catch (error) {
      return next(error);
    }
  }

  async listMaterials(req, res, next) {
    try {
      const items = await this.lessonService.listMaterials(req.params.lessonId, req.user);
      return res.status(200).json({ items });
    } catch (error) {
      return next(error);
    }
  }

  async addMaterial(req, res, next) {
    try {
      const material = await this.lessonService.addMaterial(
        req.params.lessonId,
        req.user,
        req.body,
        req.file
      );
      return res.status(201).json({ material });
    } catch (error) {
      return next(error);
    }
  }

  async download(req, res, next) {
    try {
      const result = await this.lessonService.downloadMaterial(
        req.params.courseId,
        req.params.materialId,
        req.user
      );
      result.stream.once('error', (error) => {
        if (res.headersSent) {
          res.destroy(error);
          return;
        }
        next(error);
      });
      res.type(result.mime);
      res.attachment(result.originalName);
      return result.stream.pipe(res);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = LessonController;
