import { useState } from 'react';
import { Calendar, Clock, Edit, ExternalLink, MapPin, XCircle } from 'lucide-react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { StatusBadge } from '@/shared/components/molecules/StatusBadge.jsx';
import { ConfirmDialog } from '@/shared/components/molecules/ConfirmDialog.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { cancelSchedule } from '../api/schedules.js';

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatDisplayTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

export function ScheduleCard({
  schedule,
  isOwner,
  isArchived,
  onEdit,
  onCancelled,
  courseCode,
  courseTitle
}) {
  const [isCancelling, setIsCancelling] = useState(false);

  const isCancelled = schedule.status === 'CANCELLED';
  const canManage = isOwner && !isArchived && !isCancelled;
  const isUrl = /^https?:\/\//i.test(schedule.roomOrLink || '');

  async function handleConfirmCancel() {
    setIsCancelling(true);
    try {
      await cancelSchedule(schedule.id);
      toast.success(`Đã hủy buổi học "${schedule.title}"`);
      onCancelled?.();
    } catch (error) {
      toast.error(error.message || 'Không thể hủy buổi học');
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <article
      className={`rounded-lg border p-4 shadow-xs transition-colors ${
        isCancelled
          ? 'border-border bg-muted/20 opacity-75'
          : 'border-border bg-card hover:bg-muted/10'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-2">
          {/* Header metadata */}
          <div className="flex flex-wrap items-center gap-2">
            {courseCode ? (
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {courseCode}
              </span>
            ) : null}
            <StatusBadge type="schedule" value={schedule.status} />
          </div>

          {/* Title */}
          <h3
            className={`text-base font-semibold text-foreground ${
              isCancelled ? 'line-through text-muted-foreground' : ''
            }`}
          >
            {schedule.title}
          </h3>

          {courseTitle ? (
            <p className="text-xs text-muted-foreground">Khóa học: {courseTitle}</p>
          ) : null}

          {/* Date, Time, Room */}
          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Calendar aria-hidden="true" className="size-3.5 text-primary" />
              <span>{formatDisplayDate(schedule.date)}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Clock aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span>
                {formatDisplayTime(schedule.startTime)} - {formatDisplayTime(schedule.endTime)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-3.5 text-muted-foreground" />
              {isUrl ? (
                <a
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  href={schedule.roomOrLink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="max-w-[200px] truncate">{schedule.roomOrLink}</span>
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              ) : (
                <span className="font-medium text-foreground">{schedule.roomOrLink}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons for owner */}
        {canManage ? (
          <div className="flex shrink-0 items-center gap-1.5 pt-1 sm:pt-0">
            <Button
              aria-label={`Chỉnh sửa buổi học ${schedule.title}`}
              onClick={() => onEdit?.(schedule)}
              size="sm"
              variant="outline"
            >
              <Edit aria-hidden="true" className="mr-1.5 size-3.5" />
              <span>Sửa</span>
            </Button>

            <ConfirmDialog
              cancelLabel="Giữ lại"
              confirmLabel="Hủy buổi học"
              description={`Bạn có chắc chắn muốn hủy buổi học "${schedule.title}" vào ngày ${formatDisplayDate(
                schedule.date
              )}? Học viên trong khóa học sẽ nhận được thông báo.`}
              onConfirm={handleConfirmCancel}
              title="Hủy buổi học"
              trigger={
                <Button
                  aria-label={`Hủy buổi học ${schedule.title}`}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isCancelling}
                  size="sm"
                  variant="ghost"
                >
                  <XCircle aria-hidden="true" className="mr-1.5 size-3.5" />
                  <span>Hủy</span>
                </Button>
              }
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
