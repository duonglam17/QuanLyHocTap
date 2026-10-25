import { api } from '../../../shared/api/client.js';

/** US-12: Read the authenticated student's attempt result. */
export function getAttemptResult(attemptId) {
  return api.get(`/attempts/${encodeURIComponent(attemptId)}/result`);
}
