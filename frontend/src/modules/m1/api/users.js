import { api } from '@/shared/api';

/**
 * US-02: Lấy danh sách người dùng có phân trang và bộ lọc (Admin)
 * @param {object} [params] - { search, role, status, page, limit }
 */
export async function listUsers(params = {}) {
  return api.get('/users', { params });
}

/**
 * US-02: Tạo tài khoản người dùng mới (Admin)
 * @param {object} data - { fullName, username, email, role }
 */
export async function createUser(data) {
  return api.post('/users', data);
}

/**
 * US-02, EC-14: Cập nhật trạng thái khóa/mở khóa tài khoản (Admin)
 * @param {number|string} userId
 * @param {'ACTIVE'|'LOCKED'} status
 */
export async function updateUserStatus(userId, status) {
  return api.patch(`/users/${userId}/status`, { status });
}

/**
 * US-02: Cập nhật vai trò người dùng (Admin)
 * @param {number|string} userId
 * @param {'ADMIN'|'GIANG_VIEN'|'SINH_VIEN'} role
 */
export async function updateUserRole(userId, role) {
  return api.patch(`/users/${userId}/role`, { role });
}

/**
 * US-02: Xóa mềm tài khoản người dùng (Admin)
 * @param {number|string} userId
 */
export async function deleteUser(userId) {
  return api.delete(`/users/${userId}`);
}
