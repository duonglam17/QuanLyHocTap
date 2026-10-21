import { describe, expect, it } from 'vitest';
import { moduleRoutes } from './router.jsx';

describe('module route discovery', () => {
  it('automatically includes route definitions from each module routes directory', () => {
    expect(moduleRoutes.map((route) => route.path)).toEqual(['/m1', '/m2', '/m3']);
  });
});
