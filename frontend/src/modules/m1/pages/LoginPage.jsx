import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/useAuth.js';
import { getSafeRedirectPath } from '@/shared/lib/index.js';
import { LoginForm } from '../components/LoginForm.jsx';

function getReturnPath(from) {
  const candidate =
    typeof from === 'string'
      ? from
      : from?.pathname
        ? `${from.pathname}${from.search || ''}${from.hash || ''}`
        : null;
  const safePath = getSafeRedirectPath(candidate);
  return safePath && safePath !== '/login' ? safePath : '/';
}

function resolveLoginErrorMessage(error) {
  if (!error) return 'Đăng nhập không thành công. Vui lòng thử lại.';
  if (
    error.status === 429 ||
    error.code === 'RATE_LIMIT' ||
    error.code === 'TOO_MANY_REQUESTS'
  ) {
    return error.message || 'Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau.';
  }
  if (error.status === 403) {
    if (
      error.code === 'TEMPORARY_LOCKED' ||
      error.message?.includes('tạm khóa')
    ) {
      return (
        error.message ||
        'Tài khoản bị tạm khóa 15 phút do nhập sai quá 5 lần'
      );
    }
    if (error.code === 'LOCKED' || error.message?.includes('bị khóa')) {
      return (
        error.message ||
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin'
      );
    }
  }
  if (error.status === 401 || error.code === 'UNAUTHORIZED') {
    return error.message || 'Tên đăng nhập hoặc mật khẩu không đúng';
  }
  return error.message || 'Đăng nhập không thành công. Vui lòng thử lại.';
}

export function LoginPage() {
  const { login, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground" role="status">
          Đang kiểm tra phiên đăng nhập...
        </p>
      </main>
    );
  }

  if (status === 'authenticated') {
    return <Navigate replace to={getReturnPath(location.state?.from)} />;
  }

  async function handleLogin({ username, password }) {
    setServerError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(getReturnPath(location.state?.from), { replace: true });
    } catch (error) {
      setServerError(resolveLoginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
        <header className="mb-6 grid gap-2 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Đăng nhập LMS Mini
          </h1>
          <p className="text-sm text-muted-foreground">
            Sử dụng tài khoản được cấp để tiếp tục không gian học tập.
          </p>
        </header>

        <LoginForm
          onSubmit={handleLogin}
          serverError={serverError}
          submitting={submitting}
        />

        <footer className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          <p>Hệ thống Quản lý Học tập - Mini LMS</p>
        </footer>
      </section>
    </main>
  );
}
