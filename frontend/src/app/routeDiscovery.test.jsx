import { describe, expect, it } from 'vitest';
import { moduleRoutes } from './router.jsx';
import { discoverModuleRoutes } from './routeDiscovery.js';

describe('module route discovery', () => {
  it('automatically includes route definitions from each module routes directory', () => {
    expect(moduleRoutes.map((route) => route.path)).toEqual(['/m1', '/m2', '/m3']);
    expect(moduleRoutes.every((route) => route.public === false && route.layout === 'default')).toBe(true);
    expect(moduleRoutes.find((route) => route.path === '/m2').nav.label).toBe('Bài tập và điểm');
  });

  it('rejects route definitions without roles and duplicate route paths', () => {
    expect(() =>
      discoverModuleRoutes({ 'routes/bad.jsx': [{ path: '/bad', element: 'page' }] })
    ).toThrow('must declare roles');
    expect(() =>
      discoverModuleRoutes({
        'm1/routes/index.jsx': [{ path: '/same', roles: [], element: 'page' }],
        'm2/routes/index.jsx': [{ path: '/same', roles: [], element: 'page' }]
      })
    ).toThrow('Duplicate route path');
  });
});
