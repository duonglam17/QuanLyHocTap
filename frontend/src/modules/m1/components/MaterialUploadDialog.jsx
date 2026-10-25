import { useEffect, useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
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
import { FileInput } from '@/shared/components/molecules/FileInput.jsx';
import { Spinner } from '@/shared/components/atoms/Spinner.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { uploadMaterial } from '../api/lessons.js';

const ALLOWED_EXTENSIONS = '.pdf,.docx,.pptx,.zip,.rar';
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

export function MaterialUploadDialog({ open, onOpenChange, lessonId, lessonTitle, onSuccess }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setFile(null);
      setProgress(null);
      setErrors({});
      setServerError(null);
    }
  }, [open]);

  function handleFileChange(selectedFile) {
    setFile(selectedFile);
    if (errors.file) {
      setErrors((prev) => ({ ...prev, file: undefined }));
    }
    // Auto-fill title with file name without extension if title is empty
    if (selectedFile && !title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
  }

  function validate() {
    const nextErrors = {};
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      nextErrors.title = 'Tiêu đề tài liệu không được để trống';
    } else if (trimmedTitle.length > 200) {
      nextErrors.title = 'Tiêu đề tài liệu tối đa 200 ký tự';
    }

    if (!file) {
      nextErrors.file = 'Vui lòng chọn một tệp tài liệu';
    } else if (file.size > MAX_BYTES) {
      nextErrors.file = 'Dung lượng tệp vượt quá giới hạn tối đa 50MB';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setServerError(null);
    setProgress(0);

    try {
      const payload = {
        title: title.trim(),
        file
      };
      const result = await uploadMaterial(lessonId, payload, ({ percentage }) => {
        setProgress(percentage);
      });
      toast.success(`Đã tải lên tài liệu "${result.material?.title || payload.title}"`);
      onOpenChange(false);
      onSuccess?.(result);
    } catch (error) {
      if (error.status === 413 || error.message?.includes('50MB')) {
        setServerError('Dung lượng tệp vượt quá giới hạn tối đa 50MB.');
      } else if (error.status === 415 || error.message?.includes('định dạng')) {
        setServerError('Loại định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, DOCX, PPTX, ZIP, RAR.');
      } else if (error.status === 409) {
        setServerError('Khóa học đã lưu trữ, không thể tải thêm tài liệu.');
      } else if (error.status === 403) {
        setServerError('Bạn không có quyền tải tài liệu cho bài học này.');
      } else {
        setServerError(error.message || 'Không thể tải lên tài liệu. Vui lòng thử lại sau.');
      }
    } finally {
      setIsSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <FileUp aria-hidden="true" className="size-5" />
            <DialogTitle>Tải lên tài liệu học tập</DialogTitle>
          </div>
          <DialogDescription>
            {lessonTitle ? `Bài học: ${lessonTitle}` : 'Thêm tài liệu đính kèm cho bài giảng.'}
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
            error={errors.title}
            id="material-title"
            label="Tiêu đề tài liệu"
            required
          >
            <Input
              disabled={isSubmitting}
              id="material-title"
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="Ví dụ: Slide bài giảng Chương 1"
              value={title}
            />
          </FormField>

          <FormField
            error={errors.file}
            hint="Định dạng cho phép: PDF, DOCX, PPTX, ZIP, RAR. Tối đa 50MB."
            id="material-file"
            label="Chọn tệp tài liệu"
            required
          >
            <FileInput
              accept={ALLOWED_EXTENSIONS}
              disabled={isSubmitting}
              id="material-file"
              maxSize={MAX_BYTES}
              onFileChange={handleFileChange}
              progress={progress}
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
                  <span>{progress !== null ? `Đang tải ${progress}%...` : 'Đang xử lý...'}</span>
                </>
              ) : (
                <>
                  <Upload aria-hidden="true" className="mr-1.5 size-4" />
                  <span>Tải lên</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
