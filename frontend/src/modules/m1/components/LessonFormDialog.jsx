import { useEffect, useState } from 'react';
import { BookPlus } from 'lucide-react';
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
import { Textarea } from '@/shared/components/atoms/Textarea.jsx';
import { FormField } from '@/shared/components/molecules/FormField.jsx';
import { Spinner } from '@/shared/components/atoms/Spinner.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { createLesson } from '../api/lessons.js';

export function LessonFormDialog({ open, onOpenChange, courseId, nextOrderIndex = 1, onSuccess }) {
  const [title, setTitle] = useState('');
  const [orderIndex, setOrderIndex] = useState(String(nextOrderIndex));
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setOrderIndex(String(nextOrderIndex));
      setContent('');
      setErrors({});
      setServerError(null);
    }
  }, [open, nextOrderIndex]);

  function validate() {
    const nextErrors = {};
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      nextErrors.title = 'Tiêu đề bài học không được để trống';
    } else if (trimmedTitle.length > 200) {
      nextErrors.title = 'Tiêu đề bài học tối đa 200 ký tự';
    }

    const orderNum = Number(orderIndex);
    if (!orderIndex || !Number.isInteger(orderNum) || orderNum < 1) {
      nextErrors.orderIndex = 'Thứ tự hiển thị phải là số nguyên dương';
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
        title: title.trim(),
        orderIndex: Number(orderIndex),
        content: content.trim() || null
      };
      const result = await createLesson(courseId, payload);
      toast.success(`Đã thêm bài học "${result.lesson?.title || payload.title}"`);
      onOpenChange(false);
      onSuccess?.(result);
    } catch (error) {
      if (error.status === 409) {
        setServerError('Khóa học đã lưu trữ, không thể thêm bài học mới.');
      } else if (error.status === 403) {
        setServerError('Bạn không có quyền thêm bài học vào khóa học này.');
      } else {
        setServerError(error.message || 'Không thể tạo bài học. Vui lòng thử lại sau.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <BookPlus aria-hidden="true" className="size-5" />
            <DialogTitle>Thêm bài học mới</DialogTitle>
          </div>
          <DialogDescription>
            Tạo bài học mới cho khóa học. Bạn có thể đăng tải tài liệu đính kèm sau khi tạo.
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-3">
              <FormField
                error={errors.title}
                id="lesson-title"
                label="Tiêu đề bài học"
                required
              >
                <Input
                  disabled={isSubmitting}
                  id="lesson-title"
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  placeholder="Ví dụ: Giới thiệu kiến trúc MVC"
                  value={title}
                />
              </FormField>
            </div>

            <div className="sm:col-span-1">
              <FormField
                error={errors.orderIndex}
                id="lesson-order"
                label="Thứ tự"
                required
              >
                <Input
                  disabled={isSubmitting}
                  id="lesson-order"
                  min="1"
                  onChange={(e) => {
                    setOrderIndex(e.target.value);
                    if (errors.orderIndex) setErrors((prev) => ({ ...prev, orderIndex: undefined }));
                  }}
                  type="number"
                  value={orderIndex}
                />
              </FormField>
            </div>
          </div>

          <FormField
            error={errors.content}
            id="lesson-content"
            label="Nội dung tóm tắt / Mô tả bài học"
          >
            <Textarea
              disabled={isSubmitting}
              id="lesson-content"
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập hướng dẫn, mục tiêu hoặc nội dung bài giảng..."
              rows={4}
              value={content}
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                'Tạo bài học'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
