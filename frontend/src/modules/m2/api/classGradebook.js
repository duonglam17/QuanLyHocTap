import { api } from '../../../shared/api/client.js';

export async function getClassGradebook(courseId, page = 1) {
  return api.get(`/m2-assessment/courses/${courseId}/grades`, {
    params: { page }
  });
}

export function downloadClassGradebook(courseId) {
  return api.download(`/m2-assessment/courses/${courseId}/grades/export-csv`);
}
