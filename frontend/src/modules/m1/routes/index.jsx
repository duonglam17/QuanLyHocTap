import { LoginPage } from '../pages/LoginPage.jsx';
import { M1PlaceholderPage } from '../pages/M1PlaceholderPage.jsx';

export const routes = [
  {
    path: '/login',
    element: <LoginPage />,
    roles: [],
    public: true,
    layout: 'bare'
  },
  {
    path: '/m1',
    roles: ['ADMIN', 'GIANG_VIEN', 'SINH_VIEN'],
    element: <M1PlaceholderPage />
  }
];
