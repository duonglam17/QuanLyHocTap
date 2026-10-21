import { M1PlaceholderPage } from '../pages/M1PlaceholderPage.jsx';

export const routes = [
  {
    path: '/m1',
    roles: ['ADMIN', 'GIANG_VIEN', 'SINH_VIEN'],
    element: <M1PlaceholderPage />
  }
];
