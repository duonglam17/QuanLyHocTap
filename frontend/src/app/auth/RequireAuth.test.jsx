import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '../../shared/auth/authContext.js';
import { RequireAuth } from '../../shared/auth/RequireAuth.jsx';

function LoginLocation() {
  const location = useLocation();
  const from = location.state?.from;
  return <p>Đăng nhập để quay lại {from?.pathname}{from?.search}{from?.hash}</p>;
}

describe('RequireAuth', () => {
  it('preserves the full requested URL when redirecting anonymous users', () => {
    render(
      <AuthContext.Provider value={{ user: null, status: 'anonymous' }}>
        <MemoryRouter initialEntries={['/m2/assignments/5?view=all#files']}>
          <Routes>
            <Route
              element={<RequireAuth roles={['SINH_VIEN']}><p>Nội dung cần đăng nhập</p></RequireAuth>}
              path="/m2/assignments/5"
            />
            <Route element={<LoginLocation />} path="/login" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Đăng nhập để quay lại /m2/assignments/5?view=all#files')).toBeInTheDocument();
  });

  it('sends an authenticated user with the wrong role to the forbidden route', () => {
    render(
      <AuthContext.Provider
        value={{ user: { role: 'GIANG_VIEN' }, status: 'authenticated' }}
      >
        <MemoryRouter initialEntries={['/students-only']}>
          <Routes>
            <Route
              element={<RequireAuth roles={['SINH_VIEN']}><p>Bị chặn</p></RequireAuth>}
              path="/students-only"
            />
            <Route element={<p role="alert">403 Forbidden</p>} path="/forbidden" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('403 Forbidden');
  });
});
