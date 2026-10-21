import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { collectModuleRoutes } from './routeCollector';
import { RoleProtectedRoute } from './RoleProtectedRoute';
import { AdminLayout } from '../layouts/AdminLayout';
import { InstructorLayout } from '../layouts/InstructorLayout';
import { StudentLayout } from '../layouts/StudentLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { HomePage } from '../pages/HomePage';

/**
 * Tự động thu thập các route từ modules M1, M2, M3
 * mà không cần can thiệp sửa tệp router chung này
 */
const { adminRoutes, instructorRoutes, studentRoutes, publicRoutes } = collectModuleRoutes();

export const router = createBrowserRouter([
  // Trang điều hướng gốc
  {
    path: '/',
    element: <HomePage />,
  },

  // Phân hệ Xác thực (Auth Layout)
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      ...publicRoutes,
    ],
  },

  // Phân hệ Quản trị viên (Admin Layout)
  {
    element: <RoleProtectedRoute allowedRoles={['ADMIN']} />,
    children: [
      {
        element: <AdminLayout />,
        children: adminRoutes,
      },
    ],
  },

  // Phân hệ Giảng viên (Instructor Layout)
  {
    element: <RoleProtectedRoute allowedRoles={['GIANG_VIEN']} />,
    children: [
      {
        element: <InstructorLayout />,
        children: instructorRoutes,
      },
    ],
  },

  // Phân hệ Sinh viên (Student Layout)
  {
    element: <RoleProtectedRoute allowedRoles={['SINH_VIEN']} />,
    children: [
      {
        element: <StudentLayout />,
        children: studentRoutes,
      },
    ],
  },

  // Trang 404
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export default router;

