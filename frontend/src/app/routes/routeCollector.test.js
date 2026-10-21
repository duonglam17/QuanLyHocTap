import { describe, it, expect } from 'vitest';
import { collectModuleRoutes } from './routeCollector';

describe('RouteCollector - Chứng minh cơ chế tự nạp route độc lập giữa các module', () => {
  it('1. Tự nạp và nhận diện đủ các routes từ các module thực tế (M1, M2, M3)', () => {
    const { adminRoutes, instructorRoutes, studentRoutes, allRoutes, loadedModules } =
      collectModuleRoutes();

    // Phải nạp đủ 3 tệp routes từ m1, m2, m3
    expect(loadedModules.length).toBeGreaterThanOrEqual(3);
    expect(loadedModules.some((path) => path.includes('m1/routes'))).toBe(true);
    expect(loadedModules.some((path) => path.includes('m2/routes'))).toBe(true);
    expect(loadedModules.some((path) => path.includes('m3/routes'))).toBe(true);

    // Kiểm tra tổng số routes được nạp
    expect(allRoutes.length).toBeGreaterThanOrEqual(14);

    // Kiểm tra phân loại theo vai trò RBAC
    expect(adminRoutes.length).toBeGreaterThanOrEqual(2);
    expect(instructorRoutes.length).toBeGreaterThanOrEqual(6);
    expect(studentRoutes.length).toBeGreaterThanOrEqual(6);
  });

  it('2. Chứng minh: khi một module mới thêm route, hệ thống tự nạp mà KHÔNG cần sửa file router chung', () => {
    // Giả lập một module mới được thêm vào hệ thống (ví dụ: m_analytics hoặc feature mới)
    const mockModuleGlob = {
      '../../modules/m1/routes.jsx': {
        default: [
          { path: '/admin/users', role: 'ADMIN' },
          { path: '/instructor/courses', role: 'GIANG_VIEN' },
        ],
      },
      '../../modules/m2/routes.jsx': {
        default: [{ path: '/student/assignments', role: 'SINH_VIEN' }],
      },
      // Giả sử có một module mới được thêm độc lập
      '../../modules/m_new_feature/routes.jsx': {
        default: [
          { path: '/admin/audit-logs', role: 'ADMIN' },
          { path: '/instructor/analytics', role: 'GIANG_VIEN' },
          { path: '/student/portfolio', role: 'SINH_VIEN' },
        ],
      },
    };

    const result = collectModuleRoutes(mockModuleGlob);

    // Kiểm tra route mới của module mới xuất hiện ngay lập tức
    expect(result.loadedModules).toContain('../../modules/m_new_feature/routes.jsx');

    const adminPaths = result.adminRoutes.map((r) => r.path);
    const instructorPaths = result.instructorRoutes.map((r) => r.path);
    const studentPaths = result.studentRoutes.map((r) => r.path);

    expect(adminPaths).toContain('/admin/audit-logs');
    expect(instructorPaths).toContain('/instructor/analytics');
    expect(studentPaths).toContain('/student/portfolio');

    expect(result.allRoutes.length).toBe(6);
  });
});

