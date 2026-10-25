import { createBrowserRouter } from 'react-router-dom';
import { RoleGuard } from './auth/RoleGuard.jsx';
import { RoleLayout } from './layouts/RoleLayout.jsx';
import { AccessDeniedPage } from './pages/AccessDeniedPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { HomeRedirect } from './pages/HomeRedirect.jsx';
import { DesignSystemPage } from './pages/DesignSystemPage.jsx';
import { ErrorPage } from './pages/ErrorPage.jsx';
import { addLoginFallback, discoverModuleRoutes } from './routeDiscovery.js';

const routeModules = import.meta.glob('../modules/*/routes/*.jsx', {
  eager: true,
  import: 'routes'
});

export const moduleRoutes = discoverModuleRoutes(routeModules);
export const applicationRoutes = addLoginFallback(moduleRoutes, {
  path: '/login',
  element: <LoginPage />
});

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomeRedirect routes={applicationRoutes} />
  },
  {
    path: '/forbidden',
    element: <AccessDeniedPage />
  },
  ...(import.meta.env.DEV
    ? [{ path: '/design-system', element: <DesignSystemPage /> }]
    : []),
  ...applicationRoutes.map((route) => ({
    path: route.path,
    element: route.public ? (
      route.layout === 'bare' ? route.element : <RoleLayout routes={applicationRoutes}>{route.element}</RoleLayout>
    ) : (
      <RoleGuard roles={route.roles}>
        {route.layout === 'bare' ? route.element : <RoleLayout routes={applicationRoutes}>{route.element}</RoleLayout>}
      </RoleGuard>
    ),
    errorElement: <ErrorPage />
  })),
  {
    path: '*',
    element: <NotFoundPage />
  }
]);
