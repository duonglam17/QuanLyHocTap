/**
 * Dynamic Module Route Collector
 * Tự động nạp toàn bộ các cấu hình routes từ mọi module `src/modules/<module-name>/routes.{jsx,js}`
 * Giúp các thành viên nhóm (M1, M2, M3) bổ sung trang mới độc lập mà không cần chỉnh sửa router chung.
 *
 * @param {Record<string, any>} [customGlob] - Tuỳ chọn truyền glob object (hữu ích cho Unit Test)
 * @returns {{
 *   adminRoutes: any[],
 *   instructorRoutes: any[],
 *   studentRoutes: any[],
 *   publicRoutes: any[],
 *   allRoutes: any[],
 *   loadedModules: string[]
 * }}
 */
export function collectModuleRoutes(customGlob = null) {
  let moduleFiles = customGlob;

  if (!moduleFiles) {
    try {
      // Vite dynamic import eager glob
      moduleFiles = import.meta.glob('../../modules/**/routes.{jsx,js}', { eager: true });
    } catch (e) {
      moduleFiles = {};
    }
  }

  const adminRoutes = [];
  const instructorRoutes = [];
  const studentRoutes = [];
  const publicRoutes = [];
  const allRoutes = [];
  const loadedModules = [];

  for (const [filePath, mod] of Object.entries(moduleFiles || {})) {
    loadedModules.push(filePath);

    // Lấy mảng routes từ default export hoặc named export `routes`
    const rawRoutes = mod.default || mod.routes || [];
    const routeList = Array.isArray(rawRoutes) ? rawRoutes : Object.values(rawRoutes).flat();

    for (const route of routeList) {
      allRoutes.push(route);
      const role = route.role ? String(route.role).toUpperCase() : null;

      switch (role) {
        case 'ADMIN':
          adminRoutes.push(route);
          break;
        case 'GIANG_VIEN':
        case 'INSTRUCTOR':
          instructorRoutes.push(route);
          break;
        case 'SINH_VIEN':
        case 'STUDENT':
          studentRoutes.push(route);
          break;
        default:
          publicRoutes.push(route);
          break;
      }
    }
  }

  return {
    adminRoutes,
    instructorRoutes,
    studentRoutes,
    publicRoutes,
    allRoutes,
    loadedModules,
  };
}

