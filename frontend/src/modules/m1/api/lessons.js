import { api } from '@/shared/api';

/**
 * US-05: Lấy danh sách bài học và tài liệu của khóa học
 * @param {number|string} courseId
 */
export async function listLessons(courseId) {
  return api.get(`/courses/${courseId}/lessons`);
}

/**
 * US-05: Giảng viên tạo bài học mới cho khóa học
 * @param {number|string} courseId
 * @param {{ title: string, content?: string, orderIndex?: number }} data
 */
export async function createLesson(courseId, data) {
  return api.post(`/courses/${courseId}/lessons`, data);
}

/**
 * US-06: Lấy danh sách tài liệu đính kèm của bài học
 * @param {number|string} lessonId
 */
export async function listMaterials(lessonId) {
  return api.get(`/lessons/${lessonId}/materials`);
}

/**
 * US-06: Giảng viên tải lên tài liệu học tập cho bài học (hỗ trợ .pdf, .docx, .pptx, .zip, .rar <= 50MB)
 * @param {number|string} lessonId
 * @param {{ title: string, file: File }} payload
 * @param {(progress: { loaded: number, total: number, percentage: number }) => void} [onProgress]
 */
export async function uploadMaterial(lessonId, { title, file }, onProgress) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('file', file);
  return api.upload(`/lessons/${lessonId}/materials`, formData, { onProgress });
}

/**
 * US-06, EC-18: Tải tài liệu đính kèm về máy qua stream nhị phân an toàn kèm xác thực
 * @param {number|string} courseId
 * @param {number|string} materialId
 */
export async function downloadMaterial(courseId, materialId) {
  return api.download(`/courses/${courseId}/materials/${materialId}/download`);
}
