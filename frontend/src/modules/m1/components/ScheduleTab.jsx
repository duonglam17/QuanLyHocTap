import { useMemo, useState } from 'react';
import { CalendarPlus, Plus } from 'lucide-react';
import { useApiQuery } from '@/shared/hooks';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { DataState } from '@/shared/components/organisms/DataState.jsx';
import { listCourseSchedules } from '../api/schedules.js';
import { ScheduleCard } from './ScheduleCard.jsx';
import { ScheduleFormDialog } from './ScheduleFormDialog.jsx';

export function ScheduleTab({ courseId, course, isOwner }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState(null);

  const query = useApiQuery(
    ['course-schedules', courseId],
    () => listCourseSchedules(courseId),
    { enabled: Boolean(courseId) }
  );

  const schedules = useMemo(() => {
    const list = query.data?.schedules ?? [];
    return [...list].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [query.data]);

  const isArchived = course?.status === 'ARCHIVED';
  const canManage = isOwner && !isArchived;

  function handleOpenCreate() {
    setScheduleToEdit(null);
    setIsFormOpen(true);
  }

  function handleOpenEdit(schedule) {
    setScheduleToEdit(schedule);
    setIsFormOpen(true);
  }

  return (
    <div className="grid gap-6">
      {/* Tab Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Lịch học và thời khóa biểu</h2>
          <p className="text-xs text-muted-foreground">
            Thời gian và địa điểm các buổi học trên lớp hoặc trực tuyến.
          </p>
        </div>

        {canManage ? (
          <Button onClick={handleOpenCreate} size="sm">
            <Plus aria-hidden="true" className="mr-1.5 size-4" />
            <span>Lên lịch buổi học</span>
          </Button>
        ) : null}
      </div>

      {/* 3 Network States via DataState */}
      <DataState
        empty={{
          title: 'Chưa có lịch học',
          description: canManage
            ? 'Chưa có buổi học nào được lên lịch. Hãy thêm buổi học đầu tiên cho khóa học này.'
            : 'Chưa có buổi học nào được lên lịch cho khóa học này.',
          action: canManage ? (
            <Button onClick={handleOpenCreate}>
              <CalendarPlus aria-hidden="true" className="mr-1.5 size-4" />
              <span>Lên lịch buổi học ngay</span>
            </Button>
          ) : null
        }}
        error={query.error}
        isEmpty={(data) => !data?.schedules?.length}
        onRetry={query.refetch}
        query={query}
      >
        {() => (
          <div className="grid gap-3">
            {schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                courseCode={course?.code}
                isArchived={isArchived}
                isOwner={isOwner}
                onCancelled={() => query.refetch()}
                onEdit={handleOpenEdit}
                schedule={schedule}
              />
            ))}
          </div>
        )}
      </DataState>

      {/* Form Dialog for Create & Edit */}
      <ScheduleFormDialog
        courseId={courseId}
        onOpenChange={setIsFormOpen}
        onSuccess={() => query.refetch()}
        open={isFormOpen}
        scheduleToEdit={scheduleToEdit}
      />
    </div>
  );
}
