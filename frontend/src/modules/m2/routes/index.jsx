import { AssignmentSubmissionPage } from '../pages/AssignmentSubmissionPage.jsx';
import { CourseAssignmentsPage } from '../pages/CourseAssignmentsPage.jsx';
import { SubmissionGradingPage } from '../pages/SubmissionGradingPage.jsx';
import { MyGradesPage } from '../pages/MyGradesPage.jsx';
import { ClassGradebookPage } from '../pages/ClassGradebookPage.jsx';

export const routes = [
  {
    path: '/me/grades',
    roles: ['SINH_VIEN'],
    layout: 'default',
    public: false,
    nav: {
      label: 'Điểm của tôi',
      icon: 'GraduationCap',
      order: 40,
      group: 'main'
    },
    element: <MyGradesPage />
  },
  {
    path: '/courses/:courseId/grades',
    roles: ['GIANG_VIEN'],
    layout: 'default',
    public: false,
    element: <ClassGradebookPage />
  },
  {
    path: '/courses/:courseId/assignments/grading',
    roles: ['GIANG_VIEN'],
    layout: 'default',
    public: false,
    element: <SubmissionGradingPage />
  },
  {
    path: '/assignments/:assignmentId',
    roles: ['SINH_VIEN'],
    layout: 'default',
    public: false,
    element: <AssignmentSubmissionPage />
  },
  {
    path: '/m2',
    roles: ['GIANG_VIEN', 'SINH_VIEN'],
    layout: 'default',
    public: false,
    element: <CourseAssignmentsPage />
  }
];
