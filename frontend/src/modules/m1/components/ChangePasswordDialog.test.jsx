import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import { ChangePasswordDialog } from './ChangePasswordDialog.jsx';
import * as usersApi from '../api/users.js';
import { toast } from '@/shared/components/molecules/Toast.jsx';

vi.mock('@/shared/components/molecules/Toast.jsx', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('ChangePasswordDialog (Đổi mật khẩu)', () => {
  function renderDialog(props = {}, authValue = {}) {
    const defaultAuth = {
      user: { id: 2, role: 'GIANG_VIEN' },
      logout: vi.fn().mockResolvedValue()
    };
    const auth = { ...defaultAuth, ...authValue };
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      ...props
    };

    const renderResult = render(
      <MemoryRouter>
        <AuthContext.Provider value={auth}>
          <ChangePasswordDialog {...defaultProps} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    return { ...renderResult, auth, props: defaultProps };
  }

  it('renders all 3 password inputs with toggle visibility buttons', () => {
    renderDialog();

    expect(screen.getByLabelText(/Mật khẩu hiện tại/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mật khẩu mới/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Xác nhận mật khẩu mới/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đổi mật khẩu' })).toBeInTheDocument();

    const toggleButtons = screen.getAllByRole('button', { name: /Hiện mật khẩu/i });
    expect(toggleButtons.length).toBe(3);
  });

  it('validates empty inputs on submit', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(screen.getByText('Vui lòng nhập mật khẩu hiện tại')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu mới')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng xác nhận mật khẩu mới')).toBeInTheDocument();
  });

  it('validates weak password and mismatched confirmation', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/), 'OldPassword@123');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'weak');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/), 'different');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(screen.getByText('Mật khẩu mới phải có ít nhất 8 ký tự')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument();
  });

  it('validates new password without special character or uppercase', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/), 'OldPassword@123');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'simple12345');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/), 'simple12345');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(
      screen.getByText('Mật khẩu mới phải bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt')
    ).toBeInTheDocument();
  });

  it('validates new password cannot be the same as current password', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/), 'Password@123');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'Password@123');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/), 'Password@123');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(screen.getByText('Mật khẩu mới phải khác mật khẩu hiện tại')).toBeInTheDocument();
  });

  it('toggles password visibility when eye button is clicked', async () => {
    const user = userEvent.setup();
    renderDialog();

    const currentInput = screen.getByLabelText(/Mật khẩu hiện tại/);
    expect(currentInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getAllByRole('button', { name: /Hiện mật khẩu/i })[0];
    await user.click(toggleBtn);

    expect(currentInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /Ẩn mật khẩu/i })).toBeInTheDocument();
  });

  it('shows error under current password when server returns wrong current password', async () => {
    const user = userEvent.setup();
    vi.spyOn(usersApi, 'changeMyPassword').mockRejectedValueOnce({
      response: { data: { message: 'Mật khẩu hiện tại không đúng' } },
      message: 'Mật khẩu hiện tại không đúng'
    });

    renderDialog();

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/), 'WrongOldPass@1');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'NewStrongPass@1');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/), 'NewStrongPass@1');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    await waitFor(() => {
      expect(screen.getByText('Mật khẩu hiện tại không đúng')).toBeInTheDocument();
    });
  });

  it('handles 401 unauthorized by logging out and navigating to login', async () => {
    const user = userEvent.setup();
    const logoutMock = vi.fn().mockResolvedValue();
    vi.spyOn(usersApi, 'changeMyPassword').mockRejectedValueOnce({
      status: 401,
      message: 'Phiên làm việc đã hết hạn'
    });

    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange }, { logout: logoutMock });

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/), 'OldPass@123');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'NewPass@123');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/), 'NewPass@123');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('submits successfully, triggers toast, calls logout and navigates to /login', async () => {
    const user = userEvent.setup();
    const logoutMock = vi.fn().mockResolvedValue();
    const changePasswordMock = vi.spyOn(usersApi, 'changeMyPassword').mockResolvedValueOnce({
      message: 'Đổi mật khẩu thành công'
    });

    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange }, { logout: logoutMock });

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/), 'OldPass@123');
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'NewPass@123');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/), 'NewPass@123');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith({
        currentPassword: 'OldPass@123',
        newPassword: 'NewPass@123'
      });
      expect(toast.success).toHaveBeenCalledWith('Đổi mật khẩu thành công');
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(logoutMock).toHaveBeenCalled();
    });
  });
});

