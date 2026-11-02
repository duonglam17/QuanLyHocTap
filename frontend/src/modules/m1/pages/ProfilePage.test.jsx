import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import { ProfilePage } from './ProfilePage.jsx';
import * as usersApi from '../api/users.js';

describe('ProfilePage (/profile)', () => {
  it('redirects ADMIN to home /', () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthContext.Provider value={{ user: { role: 'ADMIN' }, logout: vi.fn() }}>
          <Routes>
            <Route element={<ProfilePage />} path="/profile" />
            <Route element={<p>Trang chủ Admin</p>} path="/" />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByText('Trang chủ Admin')).toBeInTheDocument();
    expect(screen.queryByText('Chi tiết hồ sơ')).not.toBeInTheDocument();
  });

  it('renders profile details for SINH_VIEN', async () => {
    vi.spyOn(usersApi, 'getMe').mockResolvedValueOnce({
      id: 4,
      fullName: 'Trần Văn Nam',
      username: 'sv_nam',
      email: 'nam.tran@lms.edu.vn',
      role: 'SINH_VIEN',
      createdAt: '2026-11-01T08:00:00.000Z'
    });

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthContext.Provider value={{ user: { role: 'SINH_VIEN' }, logout: vi.fn() }}>
          <Routes>
            <Route element={<ProfilePage />} path="/profile" />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('profile-page-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Trần Văn Nam')).toBeInTheDocument();
    });

    expect(screen.getByText('@sv_nam')).toBeInTheDocument();
    expect(screen.getByText('nam.tran@lms.edu.vn')).toBeInTheDocument();
    expect(screen.getAllByText('Sinh viên').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Đổi mật khẩu/i })).toBeInTheDocument();
  });
});

