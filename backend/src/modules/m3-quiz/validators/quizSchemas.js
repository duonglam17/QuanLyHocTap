const { z } = require('zod');

const dateTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function isValidDateTime(value) {
  if (!dateTimePattern.test(value)) {
    return false;
  }

  const [date, time] = value.split(' ');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day &&
    candidate.getUTCHours() === hour &&
    candidate.getUTCMinutes() === minute &&
    candidate.getUTCSeconds() === second
  );
}

const dateTimeSchema = z
  .string()
  .refine(isValidDateTime, 'Thời gian phải có định dạng YYYY-MM-DD HH:mm:ss hợp lệ.');

const optionSchema = z.object({
  content: z.string().trim().min(1),
  is_correct: z.boolean()
});

const questionSchema = z
  .object({
    content: z.string().trim().min(1),
    options: z.array(optionSchema).min(2).max(5)
  })
  .superRefine((question, context) => {
    const correctOptions = question.options.filter((option) => option.is_correct);
    if (correctOptions.length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Mỗi câu hỏi phải có đúng một đáp án đúng.'
      });
    }
  });

const quizIdParamsSchema = z.object({
  quizId: z.string().regex(/^[1-9]\d*$/)
});

const questionIdParamsSchema = z.object({
  questionId: z.string().regex(/^[1-9]\d*$/)
});

const createQuizSchema = z
  .object({
    params: z.object({ courseId: z.string().regex(/^[1-9]\d*$/) }),
    body: z.object({
      title: z.string().trim().min(1).max(200),
      description: z.string().nullable().optional(),
      duration_minutes: z.coerce.number().int().positive(),
      open_time: dateTimeSchema,
      close_time: dateTimeSchema,
      show_score_immediately: z.boolean().default(true),
      questions: z.array(questionSchema).default([])
    })
  })
  .superRefine(({ body }, context) => {
    if (body.open_time >= body.close_time) {
      context.addIssue({
        code: 'custom',
        path: ['body', 'close_time'],
        message: 'Thời gian đóng đề phải sau thời gian mở đề.'
      });
    }
  });

const updateQuestionsSchema = z.object({
  params: quizIdParamsSchema,
  body: z.object({ questions: z.array(questionSchema).min(1) })
});

const quizIdSchema = z.object({ params: quizIdParamsSchema });
const questionIdSchema = z.object({ params: questionIdParamsSchema });

module.exports = {
  createQuizSchema,
  updateQuestionsSchema,
  quizIdSchema,
  questionIdSchema,
  isValidDateTime
};
