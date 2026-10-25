import { M3PlaceholderPage } from '../pages/M3PlaceholderPage.jsx';
import { NotificationsPage } from '../pages/NotificationsPage.jsx';

export const routes = [
  {
    path: '/notifications',
    roles: ['ADMIN', 'GIANG_VIEN', 'SINH_VIEN'],
    layout: 'default',
    public: false,
    nav: {
      label: 'Thông báo',
      icon: 'LayoutDashboard',
      order: 25,
      group: 'main'
    },
    element: <NotificationsPage />
  },
  {
    path: '/m3',
    roles: ['GIANG_VIEN', 'SINH_VIEN'],
    element: <M3PlaceholderPage />
  }
];
