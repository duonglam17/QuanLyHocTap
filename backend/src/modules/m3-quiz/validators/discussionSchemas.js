const { z } = require('zod');

const idSchema = z.string().regex(/^[1-9]\d*$/);

const replyDiscussionSchema = z.object({
  params: z.object({ commentId: idSchema }),
  body: z.object({
    content: z.string().trim().min(1)
  })
});

const createDiscussionSchema = z.object({
  params: z.object({ lessonId: idSchema }),
  body: z.object({
    content: z.string().trim().min(1)
  })
});

const discussionPaginationSchema = z.object({
  params: z.object({ lessonId: idSchema }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
  })
});

module.exports = {
  createDiscussionSchema,
  discussionPaginationSchema,
  replyDiscussionSchema
};
