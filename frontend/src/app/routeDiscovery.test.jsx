import { describe, expect, it } from 'vitest';
import { applicationRoutes, moduleRoutes } from './router.jsx';
import { addLoginFallback, discoverModuleRoutes } from './routeDiscovery.js';

describe('module route discovery', () => {
  it('automatically includes valid route definitions from module routes directories', () => {
    expect(moduleRoutes.every((route) => route.path.startsWith('/'))).toBe(true);
    expect(new Set(moduleRoutes.map((route) => route.path)).size).toBe(moduleRoutes.length);
    expect(moduleRoutes.every((route) => route.public || Array.isArray(route.roles))).toBe(true);
    expect(applicationRoutes.every((route) => route.path.startsWith('/'))).toBe(true);
    expect(new Set(applicationRoutes.map((route) => route.path)).size).toBe(applicationRoutes.length);
    expect(applicationRoutes.every((route) => route.public || Array.isArray(route.roles))).toBe(true);
  });

  it('allows public routes without roles and rejects protected routes without roles', () => {
    expect(
      discoverModuleRoutes({ 'routes/public.jsx': [{ path: '/public', public: true, element: 'page' }] })
    ).toMatchObject([{ path: '/public', public: true, roles: [] }]);
    expect(() =>
      discoverModuleRoutes({ 'routes/bad.jsx': [{ path: '/bad', element: 'page' }] })
    ).toThrow('must declare roles');
  });

  it('rejects duplicate route paths', () => {
    expect(() =>
      discoverModuleRoutes({
        'm1/routes/index.jsx': [{ path: '/same', roles: [], element: 'page' }],
        'm2/routes/index.jsx': [{ path: '/same', roles: [], element: 'page' }]
      })
    ).toThrow('Duplicate route path');
  });

  it('uses the module login route instead of the app fallback', () => {
    const moduleLoginPage = { path: '/login', roles: [], element: 'module login' };
    const routes = addLoginFallback([moduleLoginPage], { path: '/login', element: 'app login' });

    expect(routes).toEqual([{ ...moduleLoginPage, public: true, layout: 'bare' }]);
    expect(routes.filter((route) => route.path === '/login')).toHaveLength(1);
  });

  it('uses the app login fallback when modules do not declare /login', () => {
    const routes = addLoginFallback(
      [{ path: '/m1', roles: ['SINH_VIEN'], element: 'module page' }],
      { path: '/login', element: 'app login' }
    );

    expect(routes.find((route) => route.path === '/login')).toMatchObject({
      element: 'app login',
      public: true,
      layout: 'bare'
    });
    expect(routes.filter((route) => route.path === '/login')).toHaveLength(1);
  });
});
