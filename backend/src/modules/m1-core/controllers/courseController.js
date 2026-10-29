class CourseController {
  constructor(courseService) {
    this.courseService = courseService;
  }

  async list(req, res, next) {
    try {
      const courses = await this.courseService.listCourses(req.user);
      return res.status(200).json({ items: courses });
    } catch (error) {
      return next(error);
    }
  }

  async get(req, res, next) {
    try {
      const course = await this.courseService.getCourse(req.params.courseId, req.user);
      return res.status(200).json({ course });
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const course = await this.courseService.createCourse(req.user.id, req.body);
      const enrollmentKey = course.enrollment_key || course.enrollmentKey;
      return res.status(201).json({
        course,
        data: { ...course, enrollmentKey },
        ...course,
        enrollmentKey
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const course = await this.courseService.updateCourse(
        req.params.courseId,
        req.user.id,
        req.body
      );
      return res.status(200).json({ course, data: course, ...course });
    } catch (error) {
      return next(error);
    }
  }

  async publish(req, res, next) {
    try {
      const course = await this.courseService.publishCourse(req.params.courseId, req.user.id);
      return res.status(200).json({ course, data: course, ...course });
    } catch (error) {
      return next(error);
    }
  }

  async archive(req, res, next) {
    try {
      const course = await this.courseService.archiveCourse(req.params.courseId, req.user);
      return res.status(200).json({ course });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await this.courseService.deleteCourse(req.params.courseId, req.user.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = CourseController;
