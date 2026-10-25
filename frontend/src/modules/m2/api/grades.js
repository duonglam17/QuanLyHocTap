import { api } from '../../../shared/api/client.js';

export async function getMyCourseGrades(courseId) {
  const response = await api.get(`/m2-assessment/courses/${courseId}/my-grades`);
  return response.data;
}

export async function listCoursesForGrades() {
  return api.get('/courses');
}
