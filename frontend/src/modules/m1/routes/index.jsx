import { LoginPage } from '../pages/LoginPage.jsx';
import { CoursesPage } from '../pages/CoursesPage.jsx';
import { CourseDetailPage } from '../pages/CourseDetailPage.jsx';

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
  }
];
