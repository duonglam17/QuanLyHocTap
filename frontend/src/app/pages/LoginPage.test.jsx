import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '../../shared/auth/authContext.js';
import { LoginPage } from './LoginPage.jsx';

function Destination() {
  const location = useLocation();
  return (
    <p>
      Đã tới {location.pathname}
      {location.search}
      {location.hash}
    </p>
  );
}

describe('LoginPage', () => {
  it('returns to the originally requested URL after successful login', async () => {
    const login = vi.fn().mockResolvedValue({ id: 3, role: 'SINH_VIEN' });
    render(
      <AuthContext.Provider value={{ login, status: 'anonymous', user: null }}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/login',
              state: {
                from: {
                  pathname: '/protected/items/4',
                  search: '?tab=details',
                  hash: '#submission'
                }
              }
            }
          ]}
        >
          <Routes>
            <Route element={<LoginPage />} path="/login" />
            <Route element={<Destination />} path="/protected/items/4" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'sv_nam' }
    });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/), {
      target: { value: 'MatKhau@123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() =>
      expect(
        screen.getByText('Đã tới /protected/items/4?tab=details#submission')
      ).toBeInTheDocument()
    );
    expect(login).toHaveBeenCalledWith('sv_nam', 'MatKhau@123');
  });

  it('shows the server login message', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Tên đăng nhập hoặc mật khẩu không đúng'));
    render(
      <AuthContext.Provider value={{ login, status: 'anonymous', user: null }}>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'sv_nam' }
    });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/), {
      target: { value: 'sai' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tên đăng nhập hoặc mật khẩu không đúng'
    );
  });
});
