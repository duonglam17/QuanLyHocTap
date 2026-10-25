import { M2PlaceholderPage } from '../pages/M2PlaceholderPage.jsx';
import { AssignmentSubmissionPage } from '../pages/AssignmentSubmissionPage.jsx';

export const routes = [
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
