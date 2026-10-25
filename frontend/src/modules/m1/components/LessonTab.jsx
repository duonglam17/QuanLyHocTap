import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useApiQuery } from '@/shared/hooks';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { DataState } from '@/shared/components/organisms/DataState.jsx';
import { listLessons } from '../api/lessons.js';
import { LessonCard } from './LessonCard.jsx';
import { LessonFormDialog } from './LessonFormDialog.jsx';

export function LessonTab({ courseId, course, isOwner }) {
  const [isCreateLessonOpen, setIsCreateLessonOpen] = useState(false);

  const query = useApiQuery(['course-lessons', courseId], () => listLessons(courseId), {
    enabled: Boolean(courseId)
  });

  const lessons = useMemo(() => {
    const items = query.data?.items ?? [];
    return [...items].sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id);
  }, [query.data]);

  const isArchived = course?.status === 'ARCHIVED';
  const canManage = isOwner && !isArchived;

  const nextOrderIndex = useMemo(() => {
    if (lessons.length === 0) return 1;
    const maxOrder = Math.max(...lessons.map((l) => l.orderIndex || 1));
    return maxOrder + 1;
  }, [lessons]);

  return (
    <div className="grid gap-6">
      {/* Tab Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Danh sách bài học</h2>
          <p className="text-xs text-muted-foreground">
            Các bài giảng và tài liệu học tập được sắp xếp theo trình tự giảng dạy.
          </p>
        </div>

        {canManage ? (
          <Button
            onClick={() => setIsCreateLessonOpen(true)}
            size="sm"
          >
            <Plus aria-hidden="true" className="mr-1.5 size-4" />
            <span>Thêm bài học</span>
          </Button>
        ) : null}
      </div>

      {/* 3 Network States via DataState */}
      <DataState
        empty={{
          title: 'Chưa có bài học nào',
          description: canManage
            ? 'Bắt đầu tạo bài giảng đầu tiên và đăng tải tài liệu cho sinh viên.'
            : 'Giảng viên chưa đăng tải nội dung bài học cho khóa học này.',
          action: canManage ? (
            <Button onClick={() => setIsCreateLessonOpen(true)}>
              <Plus aria-hidden="true" className="mr-1.5 size-4" />
              <span>Thêm bài học mới</span>
            </Button>
          ) : null
        }}
        error={query.error}
        isEmpty={(data) => !data?.items?.length}
        onRetry={query.refetch}
        query={query}
      >
        {() => (
          <div className="grid gap-4">
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                courseId={courseId}
                isArchived={isArchived}
                isOwner={isOwner}
                lesson={lesson}
                onMaterialUploaded={() => query.refetch()}
              />
            ))}
          </div>
        )}
      </DataState>

      {/* Modal tạo bài học */}
      <LessonFormDialog
        courseId={courseId}
        nextOrderIndex={nextOrderIndex}
        onOpenChange={setIsCreateLessonOpen}
        onSuccess={() => query.refetch()}
        open={isCreateLessonOpen}
      />
    </div>
  );
}
