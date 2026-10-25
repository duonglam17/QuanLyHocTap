import { AssignmentSubmissionPage } from '../pages/AssignmentSubmissionPage.jsx';
import { CourseAssignmentsPage } from '../pages/CourseAssignmentsPage.jsx';
import { SubmissionGradingPage } from '../pages/SubmissionGradingPage.jsx';

export const routes = [
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
