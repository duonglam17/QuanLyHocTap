import { M2PlaceholderPage } from '../pages/M2PlaceholderPage.jsx';

export const routes = [
  {
    path: '/m2',
    roles: ['GIANG_VIEN', 'SINH_VIEN'],
    element: <M2PlaceholderPage />
  }
];
