import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../shared/components/atoms/Button.jsx';
import { FormField } from '../../shared/components/molecules/FormField.jsx';
import { Input } from '../../shared/components/atoms/Input.jsx';
import { useAuth } from '../../shared/auth/useAuth.js';

function safeReturnPath(from) {
  const path = typeof from === 'string' ? from : from?.pathname;
  if (!path?.startsWith('/') || path.startsWith('//') || path === '/login') return '/';
  if (typeof from === 'string') return path;
  return `${path}${from.search || ''}${from.hash || ''}`;
}

export function LoginPage() {
  const { login, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground" role="status">Đang kiểm tra phiên đăng nhập...</p>
      </main>
    );
  }
  if (status === 'authenticated') {
    return <Navigate replace to={safeReturnPath(location.state?.from)} />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(safeReturnPath(location.state?.from), { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
        <header className="mb-6 grid gap-2">
          <h1 className="text-2xl font-semibold">Đăng nhập LMS Mini</h1>
          <p className="text-sm text-muted-foreground">Sử dụng tài khoản được cấp để tiếp tục.</p>
        </header>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FormField id="username" label="Tên đăng nhập hoặc email" required>
            <Input
              autoComplete="username"
              id="username"
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </FormField>
          <FormField id="password" label="Mật khẩu" required>
            <Input
              autoComplete="current-password"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </FormField>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button className="w-full" disabled={submitting} type="submit">
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
      </section>
    </main>
  );
}
