import { AnnouncementTab } from './components/AnnouncementTab.jsx';
import { QuizTab } from './components/QuizTab.jsx';

export default [
  {
    id: 'quizzes',
    label: 'Trắc nghiệm',
    order: 30,
    roles: ['GIANG_VIEN', 'SINH_VIEN'],
    Component: QuizTab
  },
  {
    id: 'announcements',
    label: 'Thông báo khóa học',
    order: 40,
    roles: ['GIANG_VIEN', 'SINH_VIEN', 'ADMIN'],
    Component: AnnouncementTab
  }
];
