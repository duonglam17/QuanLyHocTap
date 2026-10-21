import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RoleGuard } from './auth/RoleGuard.jsx';
import { RoleLayout } from './layouts/RoleLayout.jsx';
import { AccessDeniedPage } from './pages/AccessDeniedPage.jsx';
import { LoginPlaceholderPage } from './pages/LoginPlaceholderPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { discoverModuleRoutes } from './routeDiscovery.js';

const routeModules = import.meta.glob('../modules/*/routes/*.jsx', {
  eager: true,
  import: 'routes'
});

export const moduleRoutes = discoverModuleRoutes(routeModules);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />
  },
  {
    path: '/login',
    element: <LoginPlaceholderPage />
  },
  {
    path: '/forbidden',
    element: <AccessDeniedPage />
  },
  ...moduleRoutes.map((route) => ({
    path: route.path,
    element: (
      <RoleGuard roles={route.roles}>
        <RoleLayout>{route.element}</RoleLayout>
      </RoleGuard>
    )
  })),
  {
    path: '*',
    element: <NotFoundPage />
  }
]);
