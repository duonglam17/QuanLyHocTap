import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { Input } from '@/shared/components/atoms/Input.jsx';
import { FormField } from '@/shared/components/molecules/FormField.jsx';
import { Spinner } from '@/shared/components/atoms/Spinner.jsx';

export function LoginForm({ onSubmit, submitting, serverError }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  function validate() {
    const errors = {};
    if (!username.trim()) {
      errors.username = 'Vui lòng nhập tên đăng nhập hoặc email';
    }
    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    await onSubmit({ username: username.trim(), password });
  }

  function handleUsernameChange(event) {
    setUsername(event.target.value);
    if (fieldErrors.username) {
      setFieldErrors((prev) => ({ ...prev, username: undefined }));
    }
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
      <FormField
        error={fieldErrors.username}
        id="username"
        label="Tên đăng nhập hoặc email"
        required
      >
        <Input
          autoComplete="username"
          autoFocus
          disabled={submitting}
          id="username"
          name="username"
          onChange={handleUsernameChange}
          placeholder="Ví dụ: gv_mai hoặc mai@lms.edu.vn"
          value={username}
        />
      </FormField>

      <FormField
        error={fieldErrors.password}
        id="password"
        label="Mật khẩu"
        required
      >
        <div className="relative">
          <Input
            autoComplete="current-password"
            className="pr-10"
            disabled={submitting}
            id="password"
            name="password"
            onChange={handlePasswordChange}
            type={showPassword ? 'text' : 'password'}
            value={password}
          />
          <button
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={submitting}
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
            type="button"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </FormField>

      {serverError ? (
        <div
          aria-live="polite"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {serverError}
        </div>
      ) : null}

      <Button
        className="w-full"
        disabled={submitting}
        size="lg"
        type="submit"
      >
        {submitting ? (
          <>
            <Spinner aria-hidden="true" className="mr-2 size-4" />
            <span>Đang đăng nhập...</span>
          </>
        ) : (
          'Đăng nhập'
        )}
      </Button>
    </form>
  );
}
