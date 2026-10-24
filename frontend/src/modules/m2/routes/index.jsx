import { M2PlaceholderPage } from '../pages/M2PlaceholderPage.jsx';

export const routes = [
  {
    path: '/m2',
    roles: ['GIANG_VIEN', 'SINH_VIEN'],
    layout: 'default',
    public: false,
    nav: {
      label: 'Bài tập và điểm',
      icon: 'ClipboardList',
      order: 30,
      group: 'main'
    },
    element: <M2PlaceholderPage />
  }
];
