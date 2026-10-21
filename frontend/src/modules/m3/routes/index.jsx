import { M3PlaceholderPage } from '../pages/M3PlaceholderPage.jsx';

export const routes = [
  {
    path: '/m3',
    roles: ['GIANG_VIEN', 'SINH_VIEN'],
    element: <M3PlaceholderPage />
  }
];
