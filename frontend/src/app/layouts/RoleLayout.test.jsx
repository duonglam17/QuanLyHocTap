import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../shared/auth/authContext.js';
import * as usersApi from '../../modules/m1/api/users.js';
import { RoleLayout } from './RoleLayout.jsx';

describe('RoleLayout', () => {
  it('shows user and role and builds navigation from visible route metadata', () => {
    const routes = [
      {
        path: '/courses',
        roles: ['SINH_VIEN', 'GIANG_VIEN'],
        nav: { label: 'Khóa học', icon: 'BookOpen', order: 10, group: 'main' }
      },
      {
        path: '/admin',
        roles: ['ADMIN'],
        nav: { label: 'Quản trị', icon: 'Users', order: 20, group: 'management' }
      }
    ];

    render(
      <AuthContext.Provider
        value={{
          user: { fullName: 'Trần Văn Nam', role: 'SINH_VIEN' },
          logout: vi.fn()
        }}
      >
        <MemoryRouter initialEntries={['/courses']}>
          <Routes>
            <Route
              element={<RoleLayout routes={routes}><p>Nội dung trang</p></RoleLayout>}
              path="/courses"
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Trần Văn Nam')).toBeInTheDocument();
    expect(screen.getByText('Sinh viên')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Khóa học' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quản trị' })).not.toBeInTheDocument();
    expect(screen.getByText('Nội dung trang')).toBeInTheDocument();
  });

  it('renders a clickable button for GIANG_VIEN / SINH_VIEN and opens ProfileDialog', async () => {
    vi.spyOn(usersApi, 'getMe').mockResolvedValue({
      id: 4,
      username: 'sv_nam',
      email: 'nam.tran@lms.edu.vn',
      fullName: 'Trần Văn Nam',
      role: 'SINH_VIEN',
      createdAt: '2026-11-01T08:00:00.000Z'
    });

    render(
      <AuthContext.Provider
        value={{
          user: { fullName: 'Trần Văn Nam', email: 'nam.tran@lms.edu.vn', role: 'SINH_VIEN' },
          logout: vi.fn()
        }}
      >
        <MemoryRouter initialEntries={['/']}>
          <RoleLayout routes={[]}>
            <p>Trang chủ</p>
          </RoleLayout>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const profileBtn = screen.getByRole('button', { name: 'Xem thông tin tài khoản' });
    expect(profileBtn).toBeInTheDocument();
    expect(profileBtn).toHaveClass('cursor-pointer');

    fireEvent.click(profileBtn);

    await waitFor(() => {
      expect(screen.getByText('Thông tin tài khoản')).toBeInTheDocument();
    });
    expect(await screen.findByText('Trần Văn Nam')).toBeInTheDocument();
    expect(screen.getAllByText('nam.tran@lms.edu.vn').length).toBeGreaterThanOrEqual(1);
  });

  it('renders static non-clickable text for ADMIN without opening profile dialog', () => {
    render(
      <AuthContext.Provider
        value={{
          user: { fullName: 'Quản trị viên Hoàng', email: 'admin@lms.edu.vn', role: 'ADMIN' },
          logout: vi.fn()
        }}
      >
        <MemoryRouter initialEntries={['/']}>
          <RoleLayout routes={[]}>
            <p>Trang quản trị</p>
          </RoleLayout>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Quản trị viên Hoàng')).toBeInTheDocument();
    expect(screen.getByText('Quản trị viên')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem thông tin tài khoản' })).not.toBeInTheDocument();
  });
});
