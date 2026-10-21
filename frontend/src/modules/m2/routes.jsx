import React from 'react';
import { M2PlaceholderPage } from './pages/M2PlaceholderPage';

/**
 * Định tuyến Module M2:
 * - Giảng viên: Quản lý bài tập, Bảng điểm lớp học
 * - Sinh viên: Bài tập cần nộp, Bảng điểm cá nhân
 */
export const m2Routes = [
  {
    path: '/instructor/assignments',
    role: 'GIANG_VIEN',
    element: <M2PlaceholderPage title="Quản lý Bài tập tự luận & Chấm bài" />,
  },
  {
    path: '/instructor/gradebook',
    role: 'GIANG_VIEN',
    element: <M2PlaceholderPage title="Bảng điểm lớp học & Xuất CSV" />,
  },
  {
    path: '/student/assignments',
    role: 'SINH_VIEN',
    element: <M2PlaceholderPage title="Bài tập cần nộp & Lịch sử nộp" />,
  },
  {
    path: '/student/grades',
    role: 'SINH_VIEN',
    element: <M2PlaceholderPage title="Bảng điểm cá nhân" />,
  },
];

export default m2Routes;

