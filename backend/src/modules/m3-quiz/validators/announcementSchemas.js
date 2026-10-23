const { z } = require('zod');

const idSchema = z.string().regex(/^[1-9]\d*$/);

const announcementIdSchema = z.object({
  params: z.object({ announcementId: idSchema })
});

const createAnnouncementSchema = z.object({
  params: z.object({ courseId: idSchema }),
  body: z.object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1)
  })
});

const announcementPaginationSchema = z.object({
  params: z.object({ courseId: idSchema }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
  })
});

module.exports = {
  announcementIdSchema,
  announcementPaginationSchema,
  createAnnouncementSchema
};
