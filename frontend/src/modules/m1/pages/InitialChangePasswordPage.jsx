import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogOut } from 'lucide-react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { Input } from '@/shared/components/atoms/Input.jsx';
import { FormField } from '@/shared/components/molecules/FormField.jsx';
import { Spinner } from '@/shared/components/atoms/Spinner.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { useAuth } from '@/shared/auth/useAuth.js';
import { LoadingState } from '@/shared/components/organisms/LoadingState.jsx';
import { APP_NAME, LOGO_FULL_PATH } from '@/shared/lib/index.js';
import { changeMyPassword } from '../api/users.js';

const INITIAL_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

export function InitialChangePasswordPage() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  // Nếu người dùng không cần đổi mật khẩu lần đầu thì quay về trang chủ
  if (!user.mustChangePassword) {
    return <Navigate replace to="/" />;
  }

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (serverError) {
      setServerError(null);
    }
  }

  function validate() {
    const nextErrors = {};
    const { currentPassword, newPassword, confirmPassword } = formData;

    if (!currentPassword) {
      nextErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại (mật khẩu ban đầu)';
    }

    if (!newPassword) {
      nextErrors.newPassword = 'Vui lòng nhập mật khẩu mới';
    } else {
      if (newPassword.length < 8) {
        nextErrors.newPassword = 'Mật khẩu mới phải có ít nhất 8 ký tự';
      } else if (
        !/[a-z]/.test(newPassword) ||
        !/[A-Z]/.test(newPassword) ||
        !/\d/.test(newPassword) ||
        !/[^A-Za-z0-9]/.test(newPassword)
      ) {
        nextErrors.newPassword =
          'Mật khẩu mới phải bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt';
      } else if (currentPassword && newPassword === currentPassword) {
        nextErrors.newPassword = 'Mật khẩu mới phải khác mật khẩu ban đầu';
      }
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng xác nhận lại mật khẩu mới';
    } else if (newPassword && confirmPassword !== newPassword) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setServerError(null);

    try {
      await changeMyPassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });

      toast.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');

      try {
        await logout?.();
      } catch {
        // ignore logout errors
      }
      navigate('/login', { replace: true });
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Không thể đổi mật khẩu.';
      if (message.includes('Mật khẩu hiện tại không đúng')) {
        setErrors((prev) => ({
          ...prev,
          currentPassword: 'Mật khẩu hiện tại không đúng'
        }));
      } else if (
        message.includes('Mật khẩu mới phải khác') ||
        message.includes('trùng với mật khẩu hiện tại')
      ) {
        setErrors((prev) => ({
          ...prev,
          newPassword: message
        }));
      } else {
        setServerError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await logout?.();
    } catch {
      // ignore
    }
    navigate('/login', { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-8">
      <section
        aria-labelledby="change-password-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg sm:p-8"
      >
        <header className="mb-6 flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <img
            alt={APP_NAME}
            className="h-24 w-auto object-contain"
            src={LOGO_FULL_PATH}
          />
          <div className="space-y-1">
            <h1
              className="text-2xl font-bold tracking-tight text-foreground"
              id="change-password-title"
            >
              Đổi mật khẩu lần đầu
            </h1>
            <p className="text-sm text-muted-foreground">
              Đây là lần đăng nhập đầu tiên. Vui lòng đặt mật khẩu mới để tiếp tục.
            </p>
          </div>
        </header>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {serverError ? (
            <div
              aria-live="polite"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {serverError}
            </div>
          ) : null}

          <FormField
            error={errors.currentPassword}
            id="currentPassword"
            label="Mật khẩu hiện tại (mật khẩu ban đầu)"
            required
          >
            <div className="relative">
              <Input
                autoComplete="current-password"
                disabled={submitting}
                id="currentPassword"
                name="currentPassword"
                onChange={(e) => handleChange('currentPassword', e.target.value)}
                placeholder="Nhập mật khẩu ban đầu được cấp"
                type={showCurrent ? 'text' : 'password'}
                value={formData.currentPassword}
              />
              <button
                aria-label={showCurrent ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={submitting}
                onClick={() => setShowCurrent((prev) => !prev)}
                tabIndex={-1}
                type="button"
              >
                {showCurrent ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
          </FormField>

          <FormField
            error={errors.newPassword}
            hint="Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt"
            id="newPassword"
            label="Mật khẩu mới"
            required
          >
            <div className="relative">
              <Input
                autoComplete="new-password"
                disabled={submitting}
                id="newPassword"
                name="newPassword"
                onChange={(e) => handleChange('newPassword', e.target.value)}
                placeholder="Nhập mật khẩu mới an toàn"
                type={showNew ? 'text' : 'password'}
                value={formData.newPassword}
              />
              <button
                aria-label={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={submitting}
                onClick={() => setShowNew((prev) => !prev)}
                tabIndex={-1}
                type="button"
              >
                {showNew ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
          </FormField>

          <FormField
            error={errors.confirmPassword}
            id="confirmPassword"
            label="Xác nhận mật khẩu mới"
            required
          >
            <div className="relative">
              <Input
                autoComplete="new-password"
                disabled={submitting}
                id="confirmPassword"
                name="confirmPassword"
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                type={showConfirm ? 'text' : 'password'}
                value={formData.confirmPassword}
              />
              <button
                aria-label={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={submitting}
                onClick={() => setShowConfirm((prev) => !prev)}
                tabIndex={-1}
                type="button"
              >
                {showConfirm ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
          </FormField>

          <div className="flex flex-col gap-3 pt-2">
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Đang lưu...
                </>
              ) : (
                'Đổi mật khẩu và tiếp tục'
              )}
            </Button>

            <Button
              className="w-full text-muted-foreground hover:text-foreground"
              disabled={submitting}
              onClick={handleLogout}
              type="button"
              variant="ghost"
            >
              <LogOut className="mr-2 size-4" />
              Đăng xuất
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

