import { api } from '../../../shared/api/client.js';

/** US-15: List announcements for a course. */
export function listCourseAnnouncements(courseId, { page = 1, limit = 20 } = {}) {
  return api.get(`/courses/${encodeURIComponent(courseId)}/announcements`, {
    params: { page, limit }
  });
}

/** US-15: Publish an announcement for a course. */
export function createCourseAnnouncement(courseId, values) {
  return api.post(`/courses/${encodeURIComponent(courseId)}/announcements`, values);
}

/** US-15: Delete an announcement. */
export function deleteCourseAnnouncement(announcementId) {
  return api.delete(`/announcements/${encodeURIComponent(announcementId)}`);
}
