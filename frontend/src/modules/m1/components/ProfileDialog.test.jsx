import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import { ProfileDialog } from './ProfileDialog.jsx';
import * as usersApi from '../api/users.js';

describe('ProfileDialog (Thông tin tài khoản)', () => {
  it('renders profile data correctly for a student or teacher', async () => {
    vi.spyOn(usersApi, 'getMe').mockResolvedValueOnce({
      id: 2,
      fullName: 'Cô Nguyễn Thị Mai',
      username: 'gv_mai',
      email: 'mai.nguyen@lms.edu.vn',
      role: 'GIANG_VIEN',
      createdAt: '2026-11-01T08:30:00.000Z'
    });

    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: { role: 'GIANG_VIEN' }, logout: vi.fn() }}>
          <ProfileDialog onOpenChange={vi.fn()} open={true} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('profile-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Cô Nguyễn Thị Mai')).toBeInTheDocument();
    });

    expect(screen.getByText('@gv_mai')).toBeInTheDocument();
    expect(screen.getByText('mai.nguyen@lms.edu.vn')).toBeInTheDocument();
    expect(screen.getAllByText('Giảng viên').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/01\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đổi mật khẩu/i })).toBeInTheDocument();
  });

  it('handles 401 error and calls logout / navigates to /login', async () => {
    const logoutMock = vi.fn().mockResolvedValue();
    vi.spyOn(usersApi, 'getMe').mockRejectedValueOnce({ status: 401, message: 'Unauthorized' });
    const onOpenChange = vi.fn();

    render(
      <MemoryRouter initialEntries={['/courses']}>
        <AuthContext.Provider value={{ user: { role: 'SINH_VIEN' }, logout: logoutMock }}>
          <ProfileDialog onOpenChange={onOpenChange} open={true} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('renders error state with retry button on network error', async () => {
    vi.spyOn(usersApi, 'getMe').mockRejectedValueOnce(new Error('Máy chủ gián đoạn'));

    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: { role: 'SINH_VIEN' }, logout: vi.fn() }}>
          <ProfileDialog onOpenChange={vi.fn()} open={true} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Máy chủ gián đoạn')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('opens change password dialog when clicking Đổi mật khẩu button', async () => {
    vi.spyOn(usersApi, 'getMe').mockResolvedValueOnce({
      id: 3,
      fullName: 'Sinh viên Test',
      username: 'sv_test',
      email: 'sv.test@lms.edu.vn',
      role: 'SINH_VIEN',
      createdAt: '2026-11-01T08:30:00.000Z'
    });

    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: { role: 'SINH_VIEN' }, logout: vi.fn() }}>
          <ProfileDialog onOpenChange={vi.fn()} open={true} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sinh viên Test')).toBeInTheDocument();
    });

    const changePasswordBtn = screen.getByRole('button', { name: /Đổi mật khẩu/i });
    expect(changePasswordBtn).toBeInTheDocument();
    changePasswordBtn.click();

    await waitFor(() => {
      expect(screen.getByLabelText(/Mật khẩu hiện tại/)).toBeInTheDocument();
    });
  });
});
