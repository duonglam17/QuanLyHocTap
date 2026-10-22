const { z } = require('zod');

const idSchema = z.string().regex(/^[1-9]\d*$/);
const clientInstanceIdSchema = z.string().trim().min(1).max(128);

const startAttemptSchema = z.object({
  params: z.object({ quizId: idSchema }),
  body: z.object({
    clientInstanceId: clientInstanceIdSchema,
    takeOver: z.boolean().default(false)
  })
});

const saveAnswerSchema = z.object({
  params: z.object({ attemptId: idSchema }),
  body: z.object({
    questionId: z.coerce.number().int().positive(),
    optionId: z.coerce.number().int().positive(),
    clientInstanceId: clientInstanceIdSchema,
    sessionToken: z.string().min(1).max(64)
  })
});

const submitAttemptSchema = z.object({
  params: z.object({ attemptId: idSchema }),
  body: z.object({
    clientInstanceId: clientInstanceIdSchema,
    sessionToken: z.string().min(1).max(64)
  })
});

module.exports = { startAttemptSchema, saveAnswerSchema, submitAttemptSchema };
