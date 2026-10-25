import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import { ApiError } from '@/shared/api/ApiError.js';
import { LoginPage } from './LoginPage.jsx';

function Destination() {
  const location = useLocation();
  return <p>Đã tới {location.pathname}{location.search}{location.hash}</p>;
}

function renderLoginPage({
  login = vi.fn().mockResolvedValue({ id: 1, role: 'SINH_VIEN' }),
  status = 'anonymous',
  user = null,
  initialEntries = ['/login']
} = {}) {
  return render(
    <AuthContext.Provider value={{ login, status, user }}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<LoginPage />} path="/login" />
          <Route element={<Destination />} path="/" />
          <Route element={<Destination />} path="/m2/assignments/4" />
          <Route element={<Destination />} path="/courses" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('M1 LoginPage & LoginForm (US-01)', () => {
  it('validates required fields before submitting to login', async () => {
    const login = vi.fn();
    renderLoginPage({ login });

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Vui lòng nhập tên đăng nhập hoặc email')).toBeInTheDocument();
    expect(await screen.findByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('clears field errors as user starts typing', async () => {
    const login = vi.fn();
    renderLoginPage({ login });

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Vui lòng nhập tên đăng nhập hoặc email')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'gv_mai' }
    });
    expect(screen.queryByText('Vui lòng nhập tên đăng nhập hoặc email')).not.toBeInTheDocument();
  });

  it('toggles password visibility with accessible button', () => {
    renderLoginPage();

    const passwordInput = screen.getByLabelText(/^Mật khẩu/);
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: 'Hiện mật khẩu' });
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('disables input fields and submit button while submitting (trạng thái đang gửi)', async () => {
    let resolveLogin;
    const login = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );
    renderLoginPage({ login });

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'gv_mai' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), {
      target: { value: 'MatKhau@123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByRole('button', { name: /Đang đăng nhập/ })).toBeDisabled();
    expect(screen.getByLabelText(/Tên đăng nhập hoặc email/)).toBeDisabled();
    expect(screen.getByLabelText(/^Mật khẩu/)).toBeDisabled();

    resolveLogin({ id: 2, role: 'GIANG_VIEN' });
    await waitFor(() => expect(screen.getByText('Đã tới /')).toBeInTheDocument());
  });

  it('redirects to the original requested URL after successful login (đường dẫn đang chờ)', async () => {
    const login = vi.fn().mockResolvedValue({ id: 10, role: 'SINH_VIEN' });
    renderLoginPage({
      login,
      initialEntries: [
        {
          pathname: '/login',
          state: {
            from: {
              pathname: '/m2/assignments/4',
              search: '?tab=details',
              hash: '#submission'
            }
          }
        }
      ]
    });

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'sv_nam' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), {
      target: { value: 'MatKhau@123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() =>
      expect(screen.getByText('Đã tới /m2/assignments/4?tab=details#submission')).toBeInTheDocument()
    );
    expect(login).toHaveBeenCalledWith('sv_nam', 'MatKhau@123');
  });

  it('rejects external/untrusted return URLs and falls back to default route (từ chối đường dẫn ngoài miền)', async () => {
    const login = vi.fn().mockResolvedValue({ id: 10, role: 'SINH_VIEN' });
    renderLoginPage({
      login,
      initialEntries: [
        {
          pathname: '/login',
          state: { from: 'https://malicious-site.com/steal-token' }
        }
      ]
    });

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'sv_nam' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), {
      target: { value: 'MatKhau@123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(screen.getByText('Đã tới /')).toBeInTheDocument());
  });

  it('rejects scheme-relative and javascript: return URLs', async () => {
    const login = vi.fn().mockResolvedValue({ id: 10, role: 'SINH_VIEN' });
    renderLoginPage({
      login,
      initialEntries: [
        {
          pathname: '/login',
          state: { from: '//attacker.com/exploit' }
        }
      ]
    });

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'sv_nam' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), {
      target: { value: 'MatKhau@123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(screen.getByText('Đã tới /')).toBeInTheDocument());
  });

  it('displays server error for invalid credentials (401)', async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      })
    );
    renderLoginPage({ login });

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'gv_mai' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), {
      target: { value: 'SaiMatKhau' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tên đăng nhập hoặc mật khẩu không đúng');
  });

  it('displays server error when account is temporarily locked (403 TEMPORARY_LOCKED)', async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiError({
        status: 403,
        code: 'TEMPORARY_LOCKED',
        message: 'Tài khoản bị tạm khóa 15 phút do nhập sai quá 5 lần'
      })
    );
    renderLoginPage({ login });

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'sv_nam' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), {
      target: { value: 'MatKhau@123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tài khoản bị tạm khóa 15 phút do nhập sai quá 5 lần');
  });

  it('displays server error when account is locked permanently (403 LOCKED)', async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiError({
        status: 403,
        code: 'LOCKED',
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin'
      })
    );
    renderLoginPage({ login });

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'sv_khoa' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), {
      target: { value: 'MatKhau@123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin');
  });

  it('displays server error when rate limit is exceeded (429 EC-08)', async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiError({
        status: 429,
        code: 'RATE_LIMIT',
        message: 'Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau.'
      })
    );
    renderLoginPage({ login });

    fireEvent.change(screen.getByLabelText(/Tên đăng nhập hoặc email/), {
      target: { value: 'attacker' }
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau.');
  });

  it('redirects immediately if already authenticated', () => {
    renderLoginPage({
      status: 'authenticated',
      user: { id: 1, role: 'ADMIN' },
      initialEntries: [
        {
          pathname: '/login',
          state: { from: '/courses' }
        }
      ]
    });

    expect(screen.getByText('Đã tới /courses')).toBeInTheDocument();
  });

  it('renders loading status while checking auth session', () => {
    renderLoginPage({ status: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra phiên đăng nhập...');
  });
});
