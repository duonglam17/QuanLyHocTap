const { Router } = require('express');
const multer = require('multer');
const { z } = require('zod');
const { BadRequestError } = require('../../../common/errors');
const { requireAuth, requireRole, validate } = require('../../../common');
const { ALLOWED_EXTENSIONS, MAX_MATERIAL_BYTES } = require('../services/lessonService');

const userIdPattern = /^[1-9]\d*$/;

function createLessonRouter({ lessonController } = {}) {
  if (!lessonController) {
    throw new TypeError('createLessonRouter yêu cầu LessonController.');
  }
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MATERIAL_BYTES, files: 1, fields: 1 }
  });
  const courseParamSchema = z.object({
    params: z.object({ courseId: z.string().regex(userIdPattern) })
  });
  const lessonParamSchema = z.object({
    params: z.object({ lessonId: z.string().regex(userIdPattern) })
  });
  const materialParamSchema = z.object({
    params: z.object({
      courseId: z.string().regex(userIdPattern),
      materialId: z.string().regex(userIdPattern)
    })
  });
  const lessonInputSchema = z.object({
    params: courseParamSchema.shape.params,
    body: z.object({
      title: z.string().trim().min(1).max(200),
      content: z.string().nullable().optional(),
      orderIndex: z.coerce.number().int().min(1).optional()
    })
  });
  const materialInputSchema = z.object({
    params: lessonParamSchema.shape.params,
    body: z.object({ title: z.string().trim().min(1).max(200) })
  });

  function parseUpload(req, res, next) {
    upload.single('file')(req, res, (error) => {
      if (!error) {
        return next();
      }
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(
          new BadRequestError('Dung lượng tệp vượt quá giới hạn 50MB', {
            maxBytes: MAX_MATERIAL_BYTES
          })
        );
      }
      if (error instanceof multer.MulterError) {
        return next(new BadRequestError('Yêu cầu tải tệp không hợp lệ'));
      }
      return next(error);
    });
  }

  router.get(
    '/courses/:courseId/lessons',
    requireAuth,
    validate(courseParamSchema),
    lessonController.listForCourse.bind(lessonController)
  );
  router.post(
    '/courses/:courseId/lessons',
    requireAuth,
    requireRole('GIANG_VIEN'),
    validate(lessonInputSchema),
    lessonController.create.bind(lessonController)
  );
  router.get(
    '/lessons/:lessonId/materials',
    requireAuth,
    validate(lessonParamSchema),
    lessonController.listMaterials.bind(lessonController)
  );
  router.post(
    '/lessons/:lessonId/materials',
    requireAuth,
    requireRole('GIANG_VIEN'),
    parseUpload,
    validate(materialInputSchema),
    lessonController.addMaterial.bind(lessonController)
  );
  router.get(
    '/courses/:courseId/materials/:materialId/download',
    requireAuth,
    validate(materialParamSchema),
    lessonController.download.bind(lessonController)
  );

  return router;
}

module.exports = { createLessonRouter, ALLOWED_EXTENSIONS };
