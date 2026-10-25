import { api } from '../../../shared/api/client.js';

/** US-11: Start or resume a quiz attempt in this browser tab. */
export function startQuizAttempt(quizId, { clientInstanceId, takeOver = false }) {
  return api.post(`/quizzes/${encodeURIComponent(quizId)}/start`, {
    clientInstanceId,
    takeOver
  });
}

/** US-11: Save one selected option for an active attempt session. */
export function saveQuizAnswer(attemptId, answer) {
  return api.patch(
    `/attempts/${encodeURIComponent(attemptId)}/save-answer`,
    answer
  );
}

/** US-12: Submit an active attempt or return its existing submission result. */
export function submitQuizAttempt(attemptId, { clientInstanceId, sessionToken }) {
  return api.post(`/attempts/${encodeURIComponent(attemptId)}/submit`, {
    clientInstanceId,
    sessionToken
  });
}
