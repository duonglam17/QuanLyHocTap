import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { Input } from '@/shared/components/atoms/Input.jsx';
import { Textarea } from '@/shared/components/atoms/Textarea.jsx';
import { FormField } from '@/shared/components/molecules/FormField.jsx';
import { FormDialog } from '@/shared/components/organisms/FormDialog.jsx';
import { Spinner } from '@/shared/components/atoms/Spinner.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { createCourse, updateCourse } from '../api/courses.js';

export function CourseFormDialog({
  open,
  onOpenChange,
  course,
  onSuccess
}) {
  const isEdit = Boolean(course?.id);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [semester, setSemester] = useState('');
  const [description, setDescription] = useState('');
  const [enrollmentKey, setEnrollmentKey] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCode(course?.code ?? '');
      setTitle(course?.title ?? '');
      setSemester(course?.semester ?? '');
      setDescription(course?.description ?? '');
      setEnrollmentKey(course?.enrollment_key ?? '');
      setFieldErrors({});
      setServerError('');
    }
  }, [open, course]);

  function validate() {
    const errors = {};
    if (!code.trim()) errors.code = 'Mã môn học không được để trống';
    if (!title.trim()) errors.title = 'Tên khóa học không được để trống';
    if (!semester.trim()) errors.semester = 'Học kỳ không được để trống';
    if (enrollmentKey.trim()) {
      const keyPattern = /^[A-Za-z0-9]{6,8}$/;
      if (!keyPattern.test(enrollmentKey.trim())) {
        errors.enrollmentKey = 'Mã ghi danh phải từ 6 đến 8 ký tự chữ hoặc số';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setServerError('');
    setSubmitting(true);
    const payload = {
      code: code.trim(),
      title: title.trim(),
      semester: semester.trim(),
      description: description.trim() || null
    };
    if (enrollmentKey.trim()) {
      payload.enrollmentKey = enrollmentKey.trim();
    }

    try {
      let result;
      if (isEdit) {
        result = await updateCourse(course.id, payload);
        toast.success('Cập nhật khóa học thành công!');
      } else {
        result = await createCourse(payload);
        toast.success('Tạo khóa học thành công!');
      }
      onOpenChange?.(false);
      onSuccess?.(result.course);
    } catch (error) {
      if (error?.status === 409) {
        setServerError(error.message || 'Mã môn học hoặc mã ghi danh đã được sử dụng.');
      } else if (error?.status === 422 && Array.isArray(error.details)) {
        const mappedErrors = {};
        error.details.forEach((item) => {
          if (item.field) mappedErrors[item.field] = item.message;
        });
        setFieldErrors(mappedErrors);
      } else {
        setServerError(error.message || 'Không thể lưu thông tin khóa học.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      description={
        isEdit
          ? 'Chỉnh sửa thông tin chi tiết của khóa học.'
          : 'Tạo khóa học mới. Khóa học sẽ ở trạng thái Bản nháp (DRAFT) cho đến khi bạn xuất bản.'
      }
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange?.(nextOpen);
      }}
      open={open}
      title={isEdit ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            error={fieldErrors.code}
            id="course-code"
            label="Mã môn học"
            required
          >
            <Input
              autoFocus
              disabled={submitting}
              id="course-code"
              maxLength={20}
              onChange={(e) => {
                setCode(e.target.value);
                if (fieldErrors.code) setFieldErrors((prev) => ({ ...prev, code: undefined }));
              }}
              placeholder="Ví dụ: INT3101"
              value={code}
            />
          </FormField>

          <FormField
            error={fieldErrors.semester}
            id="course-semester"
            label="Học kỳ"
            required
          >
            <Input
              disabled={submitting}
              id="course-semester"
              maxLength={20}
              onChange={(e) => {
                setSemester(e.target.value);
                if (fieldErrors.semester) setFieldErrors((prev) => ({ ...prev, semester: undefined }));
              }}
              placeholder="Ví dụ: HK1-2026"
              value={semester}
            />
          </FormField>
        </div>

        <FormField
          error={fieldErrors.title}
          id="course-title"
          label="Tên khóa học"
          required
        >
          <Input
            disabled={submitting}
            id="course-title"
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }));
            }}
            placeholder="Ví dụ: Lập trình Web nâng cao"
            value={title}
          />
        </FormField>

        <FormField
          error={fieldErrors.enrollmentKey}
          id="course-enrollment-key"
          label="Mã ghi danh (Tùy chọn)"
        >
          <Input
            autoCapitalize="characters"
            disabled={submitting}
            id="course-enrollment-key"
            maxLength={8}
            onChange={(e) => {
              setEnrollmentKey(e.target.value.toUpperCase());
              if (fieldErrors.enrollmentKey) {
                setFieldErrors((prev) => ({ ...prev, enrollmentKey: undefined }));
              }
            }}
            placeholder="Để trống để hệ thống tự sinh 6 ký tự"
            value={enrollmentKey}
          />
        </FormField>

        <FormField id="course-description" label="Mô tả khóa học">
          <Textarea
            disabled={submitting}
            id="course-description"
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả tóm tắt về mục tiêu và nội dung khóa học..."
            rows={3}
            value={description}
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
            onClick={() => onOpenChange?.(false)}
            type="button"
            variant="outline"
          >
            Hủy
          </Button>
          <Button disabled={submitting} type="submit">
            {submitting ? (
              <>
                <Spinner aria-hidden="true" className="mr-2 size-4" />
                <span>Đang lưu...</span>
              </>
            ) : isEdit ? (
              'Lưu thay đổi'
            ) : (
              'Xác nhận tạo'
            )}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
