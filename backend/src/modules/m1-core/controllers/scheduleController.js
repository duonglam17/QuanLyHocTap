class ScheduleController {
  constructor(scheduleService) {
    this.scheduleService = scheduleService;
  }

  async listForCourse(req, res, next) {
    try {
      const schedules = await this.scheduleService.listForCourse(req.params.courseId, req.user);
      return res.status(200).json({ schedules });
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const schedule = await this.scheduleService.createSchedule(
        req.params.courseId,
        req.user,
        req.body
      );
      return res.status(201).json({ schedule });
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const schedule = await this.scheduleService.updateSchedule(
        req.params.scheduleId,
        req.user,
        req.body
      );
      return res.status(200).json({ schedule });
    } catch (error) {
      return next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const schedule = await this.scheduleService.cancelSchedule(req.params.scheduleId, req.user);
      return res.status(200).json({ schedule });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = ScheduleController;
