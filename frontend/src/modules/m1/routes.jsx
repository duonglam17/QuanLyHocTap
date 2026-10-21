import React from 'react';
import { M1PlaceholderPage } from './pages/M1PlaceholderPage';

/**
 * Định tuyến Module M1:
 * - Admin: Quản lý người dùng, Quản lý khóa học
 * - Giảng viên: Khóa học phụ trách, Lịch giảng dạy
 * - Sinh viên: Khóa học của tôi, Thời khóa biểu
 */
export const m1Routes = [
  {
    path: '/admin/users',
    role: 'ADMIN',
    element: <M1PlaceholderPage title="Quản lý Người dùng (Admin)" />,
  },
  {
    path: '/admin/courses',
    role: 'ADMIN',
    element: <M1PlaceholderPage title="Quản lý Khóa học (Admin)" />,
  },
  {
    path: '/instructor/courses',
    role: 'GIANG_VIEN',
    element: <M1PlaceholderPage title="Khóa học phụ trách (Giảng viên)" />,
  },
  {
    path: '/instructor/schedules',
    role: 'GIANG_VIEN',
    element: <M1PlaceholderPage title="Lịch giảng dạy & Thời khóa biểu" />,
  },
  {
    path: '/student/my-courses',
    role: 'SINH_VIEN',
    element: <M1PlaceholderPage title="Khóa học của tôi (Sinh viên)" />,
  },
  {
    path: '/student/timetable',
    role: 'SINH_VIEN',
    element: <M1PlaceholderPage title="Thời khóa biểu & Lịch học" />,
  },
];

export default m1Routes;

