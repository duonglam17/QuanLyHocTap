import { AssignmentTab } from './components/AssignmentTab.jsx';
import { GradebookTab } from './components/CourseGradebook.jsx';

export default [
  {
    id: 'assignments',
    label: 'Bài tập',
    order: 20,
    roles: ['GIANG_VIEN', 'SINH_VIEN'],
    Component: AssignmentTab
  },
  {
    id: 'grades',
    label: 'Điểm',
    order: 30,
    roles: ['SINH_VIEN'],
    Component: GradebookTab
  }
];
