import { useMemo, useState } from 'react';
import { useApiQuery } from '@/shared/hooks';
import { PageHeader } from '@/shared/components/molecules/PageHeader.jsx';
import { DataState } from '@/shared/components/organisms/DataState.jsx';
import { Pagination } from '@/shared/components/molecules/Pagination.jsx';
import { listStudentSchedule } from '../api/schedules.js';
import { ScheduleCard } from '../components/ScheduleCard.jsx';

export function MySchedulePage() {
  const [page, setPage] = useState(1);
  const limit = 10;

  const query = useApiQuery(
    ['my-schedule', { page, limit }],
    () => listStudentSchedule({ page, limit })
  );

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const schedules = useMemo(() => {
    const list = query.data?.items ?? [];
    return [...list].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [query.data]);

  return (
    <div className="grid gap-6">
      <PageHeader
        description="Thời khóa biểu tổng hợp từ tất cả các khóa học bạn đã ghi danh."
        title="Lịch học của tôi"
      />

      <DataState
        empty={{
          title: 'Không có lịch học',
          description:
            'Bạn không có buổi học nào trong thời gian tới. Hãy ghi danh khóa học để cập nhật lịch học.'
        }}
        error={query.error}
        isEmpty={(data) => !data?.items?.length}
        onRetry={query.refetch}
        query={query}
      >
        {() => (
          <div className="grid gap-4">
            <div className="grid gap-3">
              {schedules.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  courseCode={schedule.courseCode}
                  courseTitle={schedule.courseTitle}
                  isArchived={false}
                  isOwner={false}
                  schedule={schedule}
                />
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="mt-2">
                <Pagination
                  onPageChange={setPage}
                  page={page}
                  totalPages={totalPages}
                />
              </div>
            ) : null}
          </div>
        )}
      </DataState>
    </div>
  );
}
