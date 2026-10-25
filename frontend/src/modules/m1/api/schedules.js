import { api } from '@/shared/api';

/**
 * US-17: Lấy danh sách lịch học của khóa học
 * @param {number|string} courseId
 */
export async function listCourseSchedules(courseId) {
  return api.get(`/courses/${courseId}/schedules`);
}

/**
 * US-17, EC-23: Giảng viên tạo buổi học mới cho khóa học
 * @param {number|string} courseId
 * @param {{ title: string, date: string, startTime: string, endTime: string, roomOrLink: string }} data
 */
export async function createSchedule(courseId, data) {
  return api.post(`/courses/${courseId}/schedules`, data);
}

/**
 * US-17, EC-23: Giảng viên cập nhật thông tin buổi học
 * @param {number|string} scheduleId
 * @param {{ title?: string, date?: string, startTime?: string, endTime?: string, roomOrLink?: string }} data
 */
export async function updateSchedule(scheduleId, data) {
  return api.patch(`/schedules/${scheduleId}`, data);
}

/**
 * US-17: Giảng viên hủy buổi học
 * @param {number|string} scheduleId
 */
export async function cancelSchedule(scheduleId) {
  return api.delete(`/schedules/${scheduleId}`);
}

/**
 * US-18: Sinh viên xem thời khóa biểu tổng hợp của các khóa học đã ghi danh
 * @param {{ page?: number, limit?: number }} [params]
 */
export async function listStudentSchedule(params = {}) {
  return api.get('/me/schedule', { params });
}
