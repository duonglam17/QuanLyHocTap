import { api } from '@/shared/api';

/**
 * US-03, US-04: Lấy danh sách khóa học của người dùng hiện tại
 */
export async function listCourses() {
  return api.get('/courses');
}

/**
 * US-03, US-04: Lấy thông tin chi tiết một khóa học
 */
export async function getCourse(courseId) {
  return api.get(`/courses/${courseId}`);
}

/**
 * US-03: Giảng viên tạo khóa học mới
 */
export async function createCourse(data) {
  return api.post('/courses', data);
}

/**
 * US-03: Giảng viên cập nhật thông tin khóa học
 */
export async function updateCourse(courseId, data) {
  return api.patch(`/courses/${courseId}`, data);
}

/**
 * US-03: Giảng viên xuất bản khóa học để mở ghi danh
 */
export async function publishCourse(courseId) {
  return api.patch(`/courses/${courseId}/publish`);
}

/**
 * US-03, EC-09: Giảng viên lưu trữ khóa học
 */
export async function archiveCourse(courseId) {
  return api.patch(`/courses/${courseId}/archive`);
}

/**
 * US-03, EC-09: Xóa mềm khóa rỗng hoặc tự động lưu trữ khóa có dữ liệu
 */
export async function deleteOrArchiveCourse(courseId) {
  return api.delete(`/courses/${courseId}`);
}

/**
 * US-04, EC-22: Sinh viên ghi danh vào khóa học bằng Enrollment Key
 */
export async function enrollByCode(enrollmentKey) {
  return api.post('/courses/enroll', { enrollment_key: enrollmentKey });
}
