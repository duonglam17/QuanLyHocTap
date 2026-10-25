import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/useAuth.js';
import { LoginForm } from '../components/LoginForm.jsx';
import { safeReturnPath } from '../lib/authHelpers.js';

export function LoginPage() {
  const { login, status, user } = useAuth();
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

  if (status === 'authenticated' && user) {
    return <Navigate replace to={safeReturnPath(location.state?.from, user.role)} />;
  }

  async function handleLogin({ username, password }) {
    setServerError('');
    setSubmitting(true);
    try {
      const loggedInUser = await login(username, password);
      const destination = safeReturnPath(location.state?.from, loggedInUser?.role);
      navigate(destination, { replace: true });
    } catch (error) {
      setServerError(error.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
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
