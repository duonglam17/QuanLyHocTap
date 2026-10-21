import React from 'react';
import { M3PlaceholderPage } from './pages/M3PlaceholderPage';

/**
 * Định tuyến Module M3:
 * - Giảng viên: Đề thi trắc nghiệm, Bảng tin thông báo
 * - Sinh viên: Bài thi trắc nghiệm, Diễn đàn thảo luận
 */
export const m3Routes = [
  {
    path: '/instructor/quizzes',
    role: 'GIANG_VIEN',
    element: <M3PlaceholderPage title="Quản lý Đề thi trắc nghiệm & Ngân hàng câu hỏi" />,
  },
  {
    path: '/instructor/announcements',
    role: 'GIANG_VIEN',
    element: <M3PlaceholderPage title="Bảng tin thông báo lớp học" />,
  },
  {
    path: '/student/quizzes',
    role: 'SINH_VIEN',
    element: <M3PlaceholderPage title="Phòng thi trắc nghiệm trực tuyến" />,
  },
  {
    path: '/student/discussions',
    role: 'SINH_VIEN',
    element: <M3PlaceholderPage title="Diễn đàn thảo luận bài học" />,
  },
];

export default m3Routes;

