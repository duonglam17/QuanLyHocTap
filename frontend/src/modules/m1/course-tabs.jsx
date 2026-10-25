import { LessonTab } from './components/LessonTab.jsx';
import { ScheduleTab } from './components/ScheduleTab.jsx';

export default [
  {
    id: 'lessons',
    label: 'Bài giảng',
    order: 10,
    roles: ['ADMIN', 'GIANG_VIEN', 'SINH_VIEN'],
    Component: LessonTab
  },
  {
    id: 'schedule',
    label: 'Lịch học',
    order: 15,
    roles: ['ADMIN', 'GIANG_VIEN', 'SINH_VIEN'],
    Component: ScheduleTab
  }
];
