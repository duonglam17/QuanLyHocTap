import { useState } from 'react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { Input } from '@/shared/components/atoms/Input.jsx';
import { FormField } from '@/shared/components/molecules/FormField.jsx';
import { FormDialog } from '@/shared/components/organisms/FormDialog.jsx';
import { Spinner } from '@/shared/components/atoms/Spinner.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { enrollByCode } from '../api/courses.js';

function resolveEnrollmentErrorMessage(error) {
  if (!error) return 'Ghi danh không thành công. Vui lòng thử lại.';
  if (error.status === 429 || error.code === 'RATE_LIMIT') {
    return 'Bạn đã thử quá nhiều lần, vui lòng đợi 1 phút';
  }
  if (error.status === 409) {
    return 'Bạn đã là thành viên của khóa học này';
  }
  if (error.status === 404) {
    return 'Mã ghi danh không tồn tại hoặc chưa xuất bản';
  }
  if (error.status === 400) {
    return error.message || 'Vui lòng nhập mã ghi danh';
  }
  return error.message || 'Ghi danh không thành công. Vui lòng thử lại.';
}

export function EnrollmentDialog({ open, onOpenChange, onSuccess }) {
  const [enrollmentKey, setEnrollmentKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');

  function handleClose(nextOpen) {
    if (!submitting) {
      if (!nextOpen) {
        setEnrollmentKey('');
        setFieldError('');
        setServerError('');
      }
      onOpenChange?.(nextOpen);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const key = enrollmentKey.trim();
    if (!key) {
      setFieldError('Vui lòng nhập mã ghi danh');
      return;
    }

    setFieldError('');
    setServerError('');
    setSubmitting(true);
    try {
      const result = await enrollByCode(key);
      toast.success(result.message || 'Ghi danh khóa học thành công!');
      handleClose(false);
      onSuccess?.(result.courseId);
    } catch (error) {
      setServerError(resolveEnrollmentErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      description="Nhập mã ghi danh (6-8 ký tự) do giảng viên cung cấp để tham gia khóa học."
      onOpenChange={handleClose}
      open={open}
      title="Tham gia khóa học"
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <FormField
          error={fieldError}
          id="enrollment-key"
          label="Mã ghi danh"
          required
        >
          <Input
            autoCapitalize="characters"
            autoFocus
            disabled={submitting}
            id="enrollment-key"
            maxLength={8}
            onChange={(event) => {
              setEnrollmentKey(event.target.value.toUpperCase());
              if (fieldError) setFieldError('');
              if (serverError) setServerError('');
            }}
            placeholder="Ví dụ: WEB2026"
            value={enrollmentKey}
          />
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

        <div className="flex justify-end gap-2 pt-2">
          <Button
            disabled={submitting}
            onClick={() => handleClose(false)}
            type="button"
            variant="outline"
          >
            Hủy
          </Button>
          <Button disabled={submitting} type="submit">
            {submitting ? (
              <>
                <Spinner aria-hidden="true" className="mr-2 size-4" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              'Tham gia'
            )}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
