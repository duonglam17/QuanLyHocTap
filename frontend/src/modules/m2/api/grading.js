import { api } from '../../../shared/api/client.js';

export async function listCourseSubmissions(courseId, page = 1, pageSize = 20) {
  return api.get(`/courses/${courseId}/grades/submissions`, {
    params: { page, page_size: pageSize }
  });
}

export function downloadSubmission(submissionId) {
  return api.download(`/submissions/${submissionId}/download`);
}

export async function gradeSubmission(submissionId, values) {
  return api.post(`/submissions/${submissionId}/grade`, values);
}
