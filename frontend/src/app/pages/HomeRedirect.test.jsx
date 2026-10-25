import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../shared/auth/authContext.js';
import { HomeRedirect } from './HomeRedirect.jsx';

const routes = [
  { path: '/first', roles: ['SINH_VIEN', 'GIANG_VIEN', 'ADMIN'], nav: { order: 10 } },
  { path: '/student-home', roles: ['SINH_VIEN'], nav: { order: 20 }, homeFor: ['SINH_VIEN'] },
  { path: '/teacher-home', roles: ['GIANG_VIEN'], nav: { order: 20 }, homeFor: ['GIANG_VIEN'] },
  { path: '/admin-later', roles: ['ADMIN'], nav: { order: 20 } },
  { path: '/admin-earlier', roles: ['ADMIN'], nav: { order: 5 } }
];

function renderHomeRedirect(role, homeRoutes = routes) {
  return render(
    <AuthContext.Provider value={{ user: { role }, status: 'authenticated' }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<HomeRedirect routes={homeRoutes} />} path="/" />
          {homeRoutes.map((route) => (
            <Route element={<p>Đích {route.path}</p>} key={route.path} path={route.path} />
          ))}
          <Route element={<p>403 Forbidden</p>} path="/forbidden" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('HomeRedirect', () => {
  it.each([
    ['SINH_VIEN', '/student-home'],
    ['GIANG_VIEN', '/teacher-home'],
    ['ADMIN', '/admin-earlier']
  ])('selects the correct home for %s', (role, path) => {
    renderHomeRedirect(role);
    expect(screen.getByText(`Đích ${path}`)).toBeInTheDocument();
  });

  it('falls back to the first accessible route when no navigation order exists', () => {
    renderHomeRedirect('SINH_VIEN', [
      { path: '/first-accessible', roles: ['SINH_VIEN'] },
      { path: '/second-accessible', roles: ['SINH_VIEN'] }
    ]);
    expect(screen.getByText('Đích /first-accessible')).toBeInTheDocument();
  });

  it('returns forbidden when no route is accessible', () => {
    renderHomeRedirect('ADMIN', [{ path: '/student-only', roles: ['SINH_VIEN'] }]);
    expect(screen.getByText('403 Forbidden')).toBeInTheDocument();
  });
});
