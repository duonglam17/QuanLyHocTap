const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole, validate } = require('../../../common');

const idPattern = /^[1-9]\d*$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function createScheduleRouter({ scheduleController } = {}) {
  if (!scheduleController) {
    throw new TypeError('createScheduleRouter yêu cầu ScheduleController.');
  }
  const router = Router();
  const courseParams = z.object({ courseId: z.string().regex(idPattern) });
  const scheduleParams = z.object({ scheduleId: z.string().regex(idPattern) });
  const scheduleBody = z.object({
    title: z.string().trim().min(1).max(200),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(timePattern),
    endTime: z.string().regex(timePattern),
    roomOrLink: z.string().trim().min(1).max(255)
  });
  const createSchema = z.object({
    params: courseParams,
    body: scheduleBody
  });
  const updateSchema = z.object({
    params: scheduleParams,
    body: z
      .object({
        title: scheduleBody.shape.title.optional(),
        date: scheduleBody.shape.date.optional(),
        startTime: scheduleBody.shape.startTime.optional(),
        endTime: scheduleBody.shape.endTime.optional(),
        roomOrLink: scheduleBody.shape.roomOrLink.optional()
      })
      .refine((body) => Object.keys(body).length > 0)
  });
  const paginationSchema = z.object({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20)
    })
  });

  router.get(
    '/courses/:courseId/schedules',
    requireAuth,
    validate(z.object({ params: courseParams })),
    scheduleController.listForCourse.bind(scheduleController)
  );
  router.get(
    '/me/schedule',
    requireAuth,
    requireRole('SINH_VIEN'),
    validate(paginationSchema),
    scheduleController.listForStudent.bind(scheduleController)
  );
  router.post(
    '/courses/:courseId/schedules',
    requireAuth,
    requireRole('GIANG_VIEN'),
    validate(createSchema),
    scheduleController.create.bind(scheduleController)
  );
  router.patch(
    '/schedules/:scheduleId',
    requireAuth,
    requireRole('GIANG_VIEN'),
    validate(updateSchema),
    scheduleController.update.bind(scheduleController)
  );
  router.delete(
    '/schedules/:scheduleId',
    requireAuth,
    requireRole('GIANG_VIEN'),
    validate(z.object({ params: scheduleParams })),
    scheduleController.cancel.bind(scheduleController)
  );
  return router;
}

module.exports = { createScheduleRouter };
