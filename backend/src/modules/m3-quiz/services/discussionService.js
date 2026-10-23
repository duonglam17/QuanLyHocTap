const {
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');

function createDiscussionService({
  repository,
  getCourseAccess,
  withTransaction,
  sanitizeText
}) {
  function normalizeId(id) {
    const numericId = Number(id);
    return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : id;
  }

  async function requireLessonAccess(lessonId, userId) {
    const courseAccess = getCourseAccess();
    if (
      !courseAccess ||
      typeof courseAccess.getLessonSummary !== 'function' ||
      typeof courseAccess.getCourse !== 'function' ||
      typeof courseAccess.isOwner !== 'function' ||
      typeof courseAccess.isEnrolled !== 'function'
    ) {
      throw new InternalServerError('Port courseAccess chưa sẵn sàng.');
    }

    const lesson = await courseAccess.getLessonSummary(normalizeId(lessonId));
    if (!lesson) {
      throw new NotFoundError('Không tìm thấy bài học.');
    }
    const courseId = normalizeId(lesson.courseId);
    const course = await courseAccess.getCourse(courseId);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học.');
    }
    const [isOwner, isEnrolled] = await Promise.all([
      courseAccess.isOwner(userId, courseId),
      courseAccess.isEnrolled(userId, courseId)
    ]);
    if (!isOwner && !isEnrolled) {
      throw new ForbiddenError('Bạn không phải thành viên hoặc chủ khóa học.');
    }
    return { lesson, courseId };
  }

  function sanitizeContent(content) {
    if (typeof content !== 'string') {
      throw new ValidationError('Nội dung bình luận là bắt buộc.');
    }
    const safeContent = sanitizeText(content);
    if (!safeContent.trim()) {
      throw new ValidationError('Nội dung bình luận sau khi làm sạch không được để trống.');
    }
    return safeContent;
  }

  async function requireDiscussion(discussionId) {
    const discussion = await repository.findById(discussionId);
    if (!discussion) {
      throw new NotFoundError('Không tìm thấy bình luận.');
    }
    if (discussion.parentDiscussionId != null) {
      const root = await repository.findById(discussion.parentDiscussionId);
      if (!root) {
        throw new NotFoundError('Không tìm thấy chủ đề thảo luận.');
      }
      return { discussion, root };
    }
    return { discussion, root: discussion };
  }

  async function attachAuthors(items) {
    const courseAccess = getCourseAccess();
    if (!courseAccess || typeof courseAccess.getUsersBrief !== 'function') {
      throw new InternalServerError('Port courseAccess.getUsersBrief chưa sẵn sàng.');
    }
    const allItems = items.flatMap((item) => [item, ...(item.replies || [])]);
    const authorIds = [
      ...new Map(
        allItems.map((item) => [String(item.authorId), normalizeId(item.authorId)])
      ).values()
    ];
    if (authorIds.length === 0) {
      return items;
    }
    const users = await courseAccess.getUsersBrief(authorIds);
    if (!Array.isArray(users)) {
      throw new InternalServerError('Port courseAccess.getUsersBrief trả dữ liệu không hợp lệ.');
    }
    const usersById = new Map(users.map((user) => [String(user.id), user]));
    const getAuthor = (authorId) => {
      const author = usersById.get(String(authorId));
      if (!author) {
        throw new InternalServerError('Port courseAccess.getUsersBrief thiếu thông tin tác giả.');
      }
      return author;
    };
    return items.map((item) => ({
      ...item,
      author: getAuthor(item.authorId),
      replies: (item.replies || []).map((reply) => ({
        ...reply,
        author: getAuthor(reply.authorId)
      }))
    }));
  }

  async function attachAuthor(item) {
    const [decorated] = await attachAuthors([item]);
    return decorated;
  }

  return {
    async create(lessonId, authorId, content) {
      const { lesson, courseId } = await requireLessonAccess(lessonId, authorId);
      const safeContent = sanitizeContent(content);
      const discussion = await withTransaction((connection) =>
        repository.create(connection, {
          courseId,
          lessonId: lesson.id,
          parentDiscussionId: null,
          authorId,
          content: safeContent
        })
      );
      return attachAuthor(discussion);
    },

    async reply(discussionId, authorId, content) {
      const { root } = await requireDiscussion(discussionId);
      const { lesson, courseId } = await requireLessonAccess(root.lessonId, authorId);
      const safeContent = sanitizeContent(content);
      const reply = await withTransaction((connection) =>
        repository.create(connection, {
          courseId,
          lessonId: lesson.id,
          parentDiscussionId: root.id,
          authorId,
          content: safeContent
        })
      );
      return attachAuthor(reply);
    },

    async list(lessonId, userId, pagination) {
      await requireLessonAccess(lessonId, userId);
      const page = await repository.listRootDiscussions(
        normalizeId(lessonId),
        pagination
      );
      return { ...page, items: await attachAuthors(page.items) };
    }
  };
}

module.exports = { createDiscussionService };
