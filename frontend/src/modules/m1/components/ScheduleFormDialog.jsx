import { useEffect, useState } from 'react';
import { CalendarPlus, Edit3 } from 'lucide-react';
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
import { createSchedule, updateSchedule } from '../api/schedules.js';

const INITIAL_FORM = {
  title: '',
  date: '',
  startTime: '08:00',
  endTime: '10:00',
  roomOrLink: ''
};

export function ScheduleFormDialog({
  open,
  onOpenChange,
  courseId,
  scheduleToEdit = null,
  onSuccess
}) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(scheduleToEdit);

  useEffect(() => {
    if (open) {
      if (scheduleToEdit) {
        // Strip seconds if present in startTime/endTime (e.g. 08:00:00 -> 08:00)
        const formatTime = (time) => (time ? time.slice(0, 5) : '');
        setFormData({
          title: scheduleToEdit.title || '',
          date: scheduleToEdit.date || '',
          startTime: formatTime(scheduleToEdit.startTime) || '08:00',
          endTime: formatTime(scheduleToEdit.endTime) || '10:00',
          roomOrLink: scheduleToEdit.roomOrLink || ''
        });
      } else {
        setFormData(INITIAL_FORM);
      }
      setErrors({});
      setServerError(null);
    }
  }, [open, scheduleToEdit]);

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
    const trimmedTitle = formData.title.trim();
    const trimmedDate = formData.date.trim();
    const trimmedRoom = formData.roomOrLink.trim();

    if (!trimmedTitle) {
      nextErrors.title = 'Tiêu đề buổi học không được để trống';
    } else if (trimmedTitle.length > 200) {
      nextErrors.title = 'Tiêu đề buổi học tối đa 200 ký tự';
    }

    if (!trimmedDate) {
      nextErrors.date = 'Vui lòng chọn ngày học';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      nextErrors.date = 'Ngày học phải có định dạng YYYY-MM-DD';
    }

    if (!formData.startTime) {
      nextErrors.startTime = 'Vui lòng chọn giờ bắt đầu';
    }

    if (!formData.endTime) {
      nextErrors.endTime = 'Vui lòng chọn giờ kết thúc';
    }

    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      nextErrors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu';
    }

    if (!trimmedRoom) {
      nextErrors.roomOrLink = 'Phòng học hoặc link trực tuyến không được để trống';
    } else if (trimmedRoom.length > 255) {
      nextErrors.roomOrLink = 'Thông tin phòng học / link tối đa 255 ký tự';
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
        title: formData.title.trim(),
        date: formData.date.trim(),
        startTime: formData.startTime.trim(),
        endTime: formData.endTime.trim(),
        roomOrLink: formData.roomOrLink.trim()
      };

      let result;
      if (isEditing) {
        result = await updateSchedule(scheduleToEdit.id, payload);
        toast.success(`Đã cập nhật buổi học "${result.schedule?.title || payload.title}"`);
      } else {
        result = await createSchedule(courseId, payload);
        toast.success(`Đã lên lịch cho buổi học "${result.schedule?.title || payload.title}"`);
      }

      onOpenChange(false);
      onSuccess?.(result);
    } catch (error) {
      if (error.status === 409) {
        if (error.code === 'SCHEDULE_CONFLICT' || error.message?.includes('trùng')) {
          setServerError('Khung giờ bị trùng với buổi học đã tồn tại trên hệ thống.');
        } else if (error.code === 'COURSE_ARCHIVED') {
          setServerError('Khóa học đã lưu trữ, không thể chỉnh sửa lịch học.');
        } else if (error.code === 'SCHEDULE_CANCELLED') {
          setServerError('Buổi học đã hủy và không thể chỉnh sửa.');
        } else {
          setServerError(error.message || 'Xung đột lịch học. Vui lòng kiểm tra lại.');
        }
      } else if (error.status === 422 || error.status === 400) {
        if (error.details) {
          setErrors(error.details);
        } else {
          setServerError(error.message || 'Thông tin buổi học không hợp lệ.');
        }
      } else {
        setServerError(error.message || 'Không thể lưu lịch học. Vui lòng thử lại sau.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            {isEditing ? (
              <Edit3 aria-hidden="true" className="size-5" />
            ) : (
              <CalendarPlus aria-hidden="true" className="size-5" />
            )}
            <DialogTitle>
              {isEditing ? 'Chỉnh sửa buổi học' : 'Lên lịch buổi học mới'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEditing
              ? 'Cập nhật thời gian hoặc phòng học/link cho buổi học này.'
              : 'Thêm buổi học vào thời khóa biểu của khóa học.'}
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
            id="schedule-title"
            label="Tiêu đề buổi học"
            required
          >
            <Input
              disabled={isSubmitting}
              id="schedule-title"
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Ví dụ: Buổi 1: Giới thiệu môn học"
              value={formData.title}
            />
          </FormField>

          <FormField
            error={errors.date}
            id="schedule-date"
            label="Ngày học"
            required
          >
            <Input
              disabled={isSubmitting}
              id="schedule-date"
              onChange={(e) => handleChange('date', e.target.value)}
              type="date"
              value={formData.date}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              error={errors.startTime}
              id="schedule-start-time"
              label="Giờ bắt đầu"
              required
            >
              <Input
                disabled={isSubmitting}
                id="schedule-start-time"
                onChange={(e) => handleChange('startTime', e.target.value)}
                type="time"
                value={formData.startTime}
              />
            </FormField>

            <FormField
              error={errors.endTime}
              id="schedule-end-time"
              label="Giờ kết thúc"
              required
            >
              <Input
                disabled={isSubmitting}
                id="schedule-end-time"
                onChange={(e) => handleChange('endTime', e.target.value)}
                type="time"
                value={formData.endTime}
              />
            </FormField>
          </div>

          <FormField
            error={errors.roomOrLink}
            hint="Nhập số phòng (ví dụ: P.302-G2) hoặc đường dẫn Google Meet / Zoom."
            id="schedule-room"
            label="Phòng học / Link học trực tuyến"
            required
          >
            <Input
              disabled={isSubmitting}
              id="schedule-room"
              onChange={(e) => handleChange('roomOrLink', e.target.value)}
              placeholder="Ví dụ: P.402-A2 hoặc https://meet.google.com/xyz"
              value={formData.roomOrLink}
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
              ) : isEditing ? (
                'Lưu thay đổi'
              ) : (
                'Lên lịch'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
