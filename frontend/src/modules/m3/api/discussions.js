import { api } from '../../../shared/api/client.js';

/** US-16: List discussion threads for a lesson. */
export function listLessonDiscussions(lessonId, { page = 1, limit = 20 } = {}) {
  return api.get(`/lessons/${encodeURIComponent(lessonId)}/comments`, {
    params: { page, limit }
  });
}

/** US-16: Create a root discussion comment for a lesson. */
export function createLessonDiscussion(lessonId, content) {
  return api.post(`/lessons/${encodeURIComponent(lessonId)}/comments`, { content });
}

/** US-16: Reply to a discussion thread. */
export function replyToDiscussion(commentId, content) {
  return api.post(`/comments/${encodeURIComponent(commentId)}/replies`, { content });
}
