import { api } from '../../../shared/api/client.js';

/** US-07: List course assignments and the authenticated student's submission status. */
export async function listCourseAssignments(courseId) {
  const response = await api.get(`/courses/${courseId}/assignments`);
  return response.data;
}

/** US-07: Create an assignment in the specified course. */
export async function createAssignment(courseId, values) {
  const response = await api.post(`/courses/${courseId}/assignments`, values);
  return response.data;
}

/** US-07: Update supplied assignment fields. */
export async function updateAssignment(assignmentId, values) {
  const response = await api.patch(`/assignments/${assignmentId}`, values);
  return response.data;
}
