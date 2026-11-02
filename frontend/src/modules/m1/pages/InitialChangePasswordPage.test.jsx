import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import { InitialChangePasswordPage } from './InitialChangePasswordPage.jsx';
import * as usersApi from '../api/users.js';
import { toast } from '@/shared/components/molecules/Toast.jsx';

vi.mock('@/shared/components/molecules/Toast.jsx', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('InitialChangePasswordPage (/change-password)', () => {
  it('redirects unauthenticated user to /login', () => {
    render(
      <AuthContext.Provider value={{ user: null, status: 'anonymous' }}>
        <MemoryRouter initialEntries={['/change-password']}>
          <Routes>
            <Route element={<InitialChangePasswordPage />} path="/change-password" />
            <Route element={<p>Trang đăng nhập</p>} path="/login" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Trang đăng nhập')).toBeInTheDocument();
  });

  it('redirects user with mustChangePassword = false to home /', () => {
    render(
      <AuthContext.Provider
        value={{
          user: { id: 1, role: 'SINH_VIEN', mustChangePassword: false },
          status: 'authenticated'
        }}
      >
        <MemoryRouter initialEntries={['/change-password']}>
          <Routes>
            <Route element={<InitialChangePasswordPage />} path="/change-password" />
            <Route element={<p>Trang chủ hệ thống</p>} path="/" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Trang chủ hệ thống')).toBeInTheDocument();
  });

  it('renders mandatory password change form without close button when mustChangePassword = true', () => {
    render(
      <AuthContext.Provider
        value={{
          user: { id: 5, role: 'SINH_VIEN', mustChangePassword: true },
          status: 'authenticated',
          logout: vi.fn()
        }}
      >
        <MemoryRouter initialEntries={['/change-password']}>
          <Routes>
            <Route element={<InitialChangePasswordPage />} path="/change-password" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Đổi mật khẩu lần đầu')).toBeInTheDocument();
    expect(
      screen.getByText('Đây là lần đăng nhập đầu tiên. Vui lòng đặt mật khẩu mới để tiếp tục.')
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/Mật khẩu hiện tại/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mật khẩu mới/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Xác nhận mật khẩu mới/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đổi mật khẩu và tiếp tục' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeInTheDocument();
    // Cannot close modal: no Close / Hủy button
    expect(screen.queryByRole('button', { name: 'Đóng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument();
  });

  it('validates empty inputs on submit', async () => {
    const user = userEvent.setup();
    render(
      <AuthContext.Provider
        value={{
          user: { id: 5, role: 'SINH_VIEN', mustChangePassword: true },
          status: 'authenticated',
          logout: vi.fn()
        }}
      >
        <MemoryRouter initialEntries={['/change-password']}>
          <Routes>
            <Route element={<InitialChangePasswordPage />} path="/change-password" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu và tiếp tục' }));

    expect(
      screen.getByText('Vui lòng nhập mật khẩu hiện tại (mật khẩu ban đầu)')
    ).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu mới')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng xác nhận lại mật khẩu mới')).toBeInTheDocument();
  });

  it('validates weak password and identical password to current', async () => {
    const user = userEvent.setup();
    render(
      <AuthContext.Provider
        value={{
          user: { id: 5, role: 'SINH_VIEN', mustChangePassword: true },
          status: 'authenticated',
          logout: vi.fn()
        }}
      >
        <MemoryRouter initialEntries={['/change-password']}>
          <Routes>
            <Route element={<InitialChangePasswordPage />} path="/change-password" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/), 'InitialPass@123');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'weak');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/), 'weak');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu và tiếp tục' }));
    expect(screen.getByText('Mật khẩu mới phải có ít nhất 8 ký tự')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^Mật khẩu mới/));
    await user.clear(screen.getByLabelText(/Xác nhận mật khẩu mới/));
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'InitialPass@123');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/), 'InitialPass@123');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu và tiếp tục' }));
    expect(screen.getByText('Mật khẩu mới phải khác mật khẩu ban đầu')).toBeInTheDocument();
  });

  it('submits successfully, triggers toast, logs out and redirects to /login', async () => {
    const user = userEvent.setup();
    const logoutMock = vi.fn().mockResolvedValue();
    const changeMock = vi.spyOn(usersApi, 'changeMyPassword').mockResolvedValueOnce({
      message: 'Đổi mật khẩu thành công'
    });

    render(
      <AuthContext.Provider
        value={{
          user: { id: 5, role: 'SINH_VIEN', mustChangePassword: true },
          status: 'authenticated',
          logout: logoutMock
        }}
      >
        <MemoryRouter initialEntries={['/change-password']}>
          <Routes>
            <Route element={<InitialChangePasswordPage />} path="/change-password" />
            <Route element={<p>Màn hình đăng nhập lại</p>} path="/login" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/), 'InitialPass@123');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'NewStrongPass@456');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/), 'NewStrongPass@456');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu và tiếp tục' }));

    await waitFor(() => {
      expect(changeMock).toHaveBeenCalledWith({
        currentPassword: 'InitialPass@123',
        newPassword: 'NewStrongPass@456'
      });
      expect(toast.success).toHaveBeenCalledWith(
        'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'
      );
      expect(logoutMock).toHaveBeenCalled();
      expect(screen.getByText('Màn hình đăng nhập lại')).toBeInTheDocument();
    });
  });

  it('allows user to log out from initial password change screen', async () => {
    const user = userEvent.setup();
    const logoutMock = vi.fn().mockResolvedValue();

    render(
      <AuthContext.Provider
        value={{
          user: { id: 5, role: 'SINH_VIEN', mustChangePassword: true },
          status: 'authenticated',
          logout: logoutMock
        }}
      >
        <MemoryRouter initialEntries={['/change-password']}>
          <Routes>
            <Route element={<InitialChangePasswordPage />} path="/change-password" />
            <Route element={<p>Đã thoát</p>} path="/login" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await user.click(screen.getByRole('button', { name: /Đăng xuất/i }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(screen.getByText('Đã thoát')).toBeInTheDocument();
    });
  });
});
