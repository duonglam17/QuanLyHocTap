import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../shared/components/atoms/Button';

/**
 * RoleProtectedRoute: Bảo vệ route dựa trên trạng thái đăng nhập và phân quyền RBAC
 * @param {string[]} allowedRoles - Danh sách vai trò được phép truy cập (ADMIN, GIANG_VIEN, SINH_VIEN)
 */
export function RoleProtectedRoute({ allowedRoles = [] }) {
  const location = useLocation();

  // Kiểm tra phiên đăng nhập từ localStorage (khung giả lập)
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;

  let user = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch (e) {
    user = null;
  }

  // 1. Chưa đăng nhập -> Chuyển hướng tới trang Đăng nhập
  if (!token && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Kiểm tra vai trò RBAC
  if (allowedRoles.length > 0 && (!user || !allowedRoles.includes(user.role))) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="mb-4 h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">Truy cập bị từ chối (403 Forbidden)</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Tài khoản của bạn không có quyền truy cập vào phân hệ này. Vui lòng liên hệ Quản trị viên
          nếu bạn cho rằng đây là một sự nhầm lẫn.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-6"
          onClick={() => {
            window.location.href = '/';
          }}
        >
          Quay lại trang chủ
        </Button>
      </div>
    );
  }

  return <Outlet />;
}

