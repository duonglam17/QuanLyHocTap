import { LoginPage } from '../pages/LoginPage.jsx';
import { CoursesPage } from '../pages/CoursesPage.jsx';
import { CourseDetailPage } from '../pages/CourseDetailPage.jsx';
import { AdminUsersPage } from '../pages/AdminUsersPage.jsx';

export const routes = [
  {
    path: '/login',
    element: <LoginPage />,
    roles: [],
    public: true,
    layout: 'bare'
  },
  {
    path: '/courses',
    element: <CoursesPage />,
    roles: ['ADMIN', 'GIANG_VIEN', 'SINH_VIEN'],
    layout: 'default',
    public: false,
    homeFor: ['GIANG_VIEN', 'SINH_VIEN'],
    nav: {
      label: 'Khóa học',
      icon: 'BookOpen',
      order: 10,
      group: 'main'
    }
  },
  {
    path: '/courses/:courseId',
    element: <CourseDetailPage />,
    roles: ['ADMIN', 'GIANG_VIEN', 'SINH_VIEN'],
    layout: 'default',
    public: false
  },
  {
    path: '/admin/users',
    element: <AdminUsersPage />,
    roles: ['ADMIN'],
    layout: 'default',
    public: false,
    homeFor: ['ADMIN'],
    nav: {
      label: 'Người dùng',
      icon: 'Users',
      order: 20,
      group: 'admin'
    }
  }
];
