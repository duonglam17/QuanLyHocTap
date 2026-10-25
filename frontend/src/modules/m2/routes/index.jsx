import { CourseAssignmentsPage } from '../pages/CourseAssignmentsPage.jsx';

export const routes = [
  {
    path: '/courses/:courseId/assignments',
    roles: ['GIANG_VIEN', 'SINH_VIEN'],
    layout: 'default',
    public: false,
    element: <CourseAssignmentsPage />
  }
];
