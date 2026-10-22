const { Router } = require('express');
const { z } = require('zod');
const { rateLimit, requireAuth, requireRole, validate } = require('../../../common');

function createCourseRouter({ courseController, enrollmentController } = {}) {
  if (!courseController || !enrollmentController) {
    throw new TypeError('createCourseRouter yêu cầu CourseController và EnrollmentController.');
  }
  const router = Router();
  const authenticated = requireAuth;
  const instructors = [requireAuth, requireRole('GIANG_VIEN')];
  const instructorsAndAdmins = [requireAuth, requireRole('GIANG_VIEN', 'ADMIN')];
  const listSchema = z.object({
    body: z.object({
      code: z.string().trim().min(1).max(20),
      title: z.string().trim().min(1).max(200),
      description: z.string().nullable().optional(),
      semester: z.string().trim().min(1).max(20),
      enrollmentKey: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9]{6,8}$/)
        .optional()
    })
  });
  const updateSchema = z.object({
    body: z
      .object({
        code: z.string().trim().min(1).max(20).optional(),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().nullable().optional(),
        semester: z.string().trim().min(1).max(20).optional(),
        enrollmentKey: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9]{6,8}$/)
          .optional()
      })
      .refine((body) => Object.keys(body).length > 0)
  });
  const enrollmentSchema = z.object({
    body: z.object({ enrollment_key: z.string() })
  });

  router.post(
    '/enroll',
    rateLimit('m1-course-enroll', {
      windowMs: 60_000,
      max: 5
    }),
    requireAuth,
    requireRole('SINH_VIEN'),
    validate(enrollmentSchema),
    enrollmentController.enroll.bind(enrollmentController)
  );
  router.get('/', authenticated, courseController.list.bind(courseController));
  router.post(
    '/',
    ...instructors,
    validate(listSchema),
    courseController.create.bind(courseController)
  );
  router.get('/:courseId', authenticated, courseController.get.bind(courseController));
  router.patch(
    '/:courseId',
    ...instructors,
    validate(updateSchema),
    courseController.update.bind(courseController)
  );
  router.patch(
    '/:courseId/publish',
    ...instructors,
    courseController.publish.bind(courseController)
  );
  router.patch(
    '/:courseId/archive',
    ...instructorsAndAdmins,
    courseController.archive.bind(courseController)
  );
  router.delete('/:courseId', ...instructors, courseController.delete.bind(courseController));
  router.delete(
    '/:courseId/enrollments/:studentId',
    ...instructorsAndAdmins,
    enrollmentController.remove.bind(enrollmentController)
  );
  return router;
}

module.exports = { createCourseRouter };
