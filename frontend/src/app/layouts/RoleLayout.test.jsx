import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../shared/auth/authContext.js';
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
});
