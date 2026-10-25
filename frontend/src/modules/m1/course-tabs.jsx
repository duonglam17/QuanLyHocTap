import { LessonTab } from './components/LessonTab.jsx';

export default [
  {
    id: 'lessons',
    label: 'Bài giảng',
    order: 10,
    roles: ['ADMIN', 'GIANG_VIEN', 'SINH_VIEN'],
    Component: LessonTab
  }
];
