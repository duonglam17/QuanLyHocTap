import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/components/atoms/Dialog.jsx';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { Input } from '@/shared/components/atoms/Input.jsx';
import { FormField } from '@/shared/components/molecules/FormField.jsx';
import { Spinner } from '@/shared/components/atoms/Spinner.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { useAuth } from '@/shared/auth/useAuth.js';
import { changeMyPassword } from '../api/users.js';

const INITIAL_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

export function ChangePasswordDialog({ open, onOpenChange, onSuccess }) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const navigate = useNavigate();
  const { logout } = useAuth();

  function resetForm() {
    setFormData(INITIAL_FORM);
    setErrors({});
    setServerError(null);
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  }

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
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
      nextErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
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
        nextErrors.newPassword = 'Mật khẩu mới phải bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt';
      } else if (currentPassword && newPassword === currentPassword) {
        nextErrors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại';
      }
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
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

      toast.success('Đổi mật khẩu thành công');
      handleOpenChange(false);
      onSuccess?.();

      try {
        await logout?.();
      } catch {
        // ignore logout errors
      }
      navigate('/login', { replace: true });
    } catch (err) {
      if (err?.status === 401 || err?.statusCode === 401) {
        try {
          await logout?.();
        } catch {
          // ignore
        }
        handleOpenChange(false);
        navigate('/login', { replace: true });
        return;
      }

      const message = err?.response?.data?.message || err?.message || 'Không thể đổi mật khẩu.';
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

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-5 text-primary" />
            Đổi mật khẩu
          </DialogTitle>
          <DialogDescription>
            Nhập mật khẩu hiện tại và tạo mật khẩu mới an toàn cho tài khoản của bạn.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 py-2" onSubmit={handleSubmit}>
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
            label="Mật khẩu hiện tại"
            required
          >
            <div className="relative">
              <Input
                autoComplete="current-password"
                disabled={submitting}
                id="currentPassword"
                name="currentPassword"
                onChange={(e) => handleChange('currentPassword', e.target.value)}
                placeholder="Nhập mật khẩu hiện tại"
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
                placeholder="Nhập mật khẩu mới"
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

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Đang lưu...
                </>
              ) : (
                'Đổi mật khẩu'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

