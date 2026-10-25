import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/components/atoms/Dialog.jsx';
import { Input } from '@/shared/components/atoms/Input.jsx';
import { FormField } from '@/shared/components/molecules/FormField.jsx';
import { Spinner } from '@/shared/components/atoms/Spinner.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { createUser } from '../api/users.js';

const INITIAL_FORM = {
  fullName: '',
  username: '',
  email: '',
  role: 'SINH_VIEN'
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UserFormDialog({ open, onOpenChange, onSuccess }) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setFormData(INITIAL_FORM);
    setErrors({});
    setServerError(null);
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
    const trimmedName = formData.fullName.trim();
    const trimmedUsername = formData.username.trim();
    const trimmedEmail = formData.email.trim();

    if (!trimmedName) {
      nextErrors.fullName = 'Họ và tên không được để trống';
    } else if (trimmedName.length > 100) {
      nextErrors.fullName = 'Họ và tên tối đa 100 ký tự';
    }

    if (!trimmedUsername) {
      nextErrors.username = 'Tên đăng nhập không được để trống';
    } else if (trimmedUsername.length > 50) {
      nextErrors.username = 'Tên đăng nhập tối đa 50 ký tự';
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      nextErrors.username = 'Tên đăng nhập chỉ chứa chữ, số, dấu gạch nối hoặc dấu chấm';
    }

    if (!trimmedEmail) {
      nextErrors.email = 'Email không được để trống';
    } else if (trimmedEmail.length > 100) {
      nextErrors.email = 'Email tối đa 100 ký tự';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = 'Email không đúng định dạng';
    }

    if (!['ADMIN', 'GIANG_VIEN', 'SINH_VIEN'].includes(formData.role)) {
      nextErrors.role = 'Vai trò người dùng không hợp lệ';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role
      };
      const result = await createUser(payload);
      toast.success(`Đã tạo tài khoản cho ${result.user?.fullName || payload.fullName}`);
      handleOpenChange(false);
      onSuccess?.(result);
    } catch (error) {
      if (error.status === 409) {
        setServerError('Tên đăng nhập hoặc email đã được sử dụng trong hệ thống.');
      } else if (error.status === 422 && error.details) {
        setErrors(error.details);
      } else {
        setServerError(error.message || 'Không thể tạo tài khoản. Vui lòng thử lại sau.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <UserPlus aria-hidden="true" className="size-5" />
            <DialogTitle>Tạo người dùng mới</DialogTitle>
          </div>
          <DialogDescription>
            Khởi tạo tài khoản cho thành viên mới. Mật khẩu ban đầu sẽ được hệ thống sinh tự động.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 py-2" onSubmit={handleSubmit}>
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
            error={errors.fullName}
            id="user-full-name"
            label="Họ và tên"
            required
          >
            <Input
              disabled={isSubmitting}
              id="user-full-name"
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn An"
              value={formData.fullName}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              error={errors.username}
              id="user-username"
              label="Tên đăng nhập"
              required
            >
              <Input
                autoCapitalize="none"
                disabled={isSubmitting}
                id="user-username"
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="Ví dụ: nguyenvana"
                value={formData.username}
              />
            </FormField>

            <FormField
              error={errors.role}
              id="user-role"
              label="Vai trò"
              required
            >
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                id="user-role"
                onChange={(e) => handleChange('role', e.target.value)}
                value={formData.role}
              >
                <option value="SINH_VIEN">Sinh viên</option>
                <option value="GIANG_VIEN">Giảng viên</option>
                <option value="ADMIN">Quản trị viên (Admin)</option>
              </select>
            </FormField>
          </div>

          <FormField
            error={errors.email}
            id="user-email"
            label="Email"
            required
          >
            <Input
              autoCapitalize="none"
              disabled={isSubmitting}
              id="user-email"
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Ví dụ: an.nv@example.edu.vn"
              type="email"
              value={formData.email}
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                'Tạo tài khoản'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
