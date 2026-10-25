import { api } from '../../../shared/api/client.js';

/** US-10: List quizzes and the current student's attempt state for a course. */
export function listCourseQuizzes(courseId, { page = 1, limit = 20 } = {}) {
  return api.get(`/courses/${encodeURIComponent(courseId)}/quizzes`, {
    params: { page, limit }
  });
}

/** US-10: Read quiz settings and questions for the course owner. */
export function getQuiz(quizId) {
  return api.get(`/quizzes/${encodeURIComponent(quizId)}`);
}

/** US-10: Create a draft quiz with its initial questions. */
export function createQuiz(courseId, values) {
  return api.post(`/courses/${encodeURIComponent(courseId)}/quizzes`, values);
}

/** US-10: Update quiz settings before any attempt exists. */
export function updateQuiz(quizId, values) {
  return api.patch(`/quizzes/${encodeURIComponent(quizId)}`, values);
}

/** US-10: Replace all questions before any attempt exists. */
export function replaceQuizQuestions(quizId, questions) {
  return api.put(`/quizzes/${encodeURIComponent(quizId)}/questions`, { questions });
}

/** US-10: Publish a draft that contains at least one question. */
export function publishQuiz(quizId) {
  return api.post(`/quizzes/${encodeURIComponent(quizId)}/publish`);
}
