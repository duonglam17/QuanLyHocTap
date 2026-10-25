import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, FileUp, Paperclip } from 'lucide-react';
import { useAuth } from '@/shared/auth/useAuth.js';
import { useApiQuery } from '@/shared/hooks/useApiQuery.js';
import { getLessonSections } from '@/shared/lib/slots.js';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { DataState } from '@/shared/components/organisms/DataState.jsx';
import { listMaterials } from '../api/lessons.js';
import { MaterialItem } from '../components/MaterialItem.jsx';
import { MaterialUploadDialog } from '../components/MaterialUploadDialog.jsx';

export function LessonDetailPage() {
  const { lessonId } = useParams();
  const location = useLocation();
  const { user } = useAuth();

  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Read router state passed from LessonCard if present
  const stateLesson = location.state?.lesson;
  const courseId = location.state?.courseId ?? stateLesson?.courseId;
  const isOwner = Boolean(
    location.state?.isOwner ?? (user?.role === 'GIANG_VIEN' && stateLesson?.ownerId === user?.id)
  );
  const isArchived = Boolean(
    location.state?.isArchived ?? stateLesson?.courseStatus === 'ARCHIVED'
  );

  const query = useApiQuery(
    ['lesson-materials', lessonId],
    () => listMaterials(lessonId),
    { enabled: Boolean(lessonId) }
  );

  const materials = query.data?.items ?? stateLesson?.materials ?? [];
  const canUpload = isOwner && !isArchived;

  // Load registered extension sections for lessons (e.g. M3 discussion)
  const sections = useMemo(() => {
    return getLessonSections(user?.role);
  }, [user?.role]);

  const backUrl = courseId ? `/courses/${courseId}` : '/courses';

  return (
    <div className="grid gap-6">
      {/* Back button */}
      <div>
        <Link
          className="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          to={backUrl}
        >
          <ArrowLeft aria-hidden="true" className="mr-1.5 size-4" />
          <span>{courseId ? 'Quay lại khóa học' : 'Danh sách khóa học'}</span>
        </Link>
      </div>

      {/* Lesson Header Card */}
      <article className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {stateLesson?.orderIndex ? `Bài ${stateLesson.orderIndex}` : 'Bài học'}
              </span>
              {isArchived ? (
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Khóa học đã lưu trữ (Chỉ đọc)
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {stateLesson?.title || `Bài học #${lessonId}`}
            </h1>

            {stateLesson?.content ? (
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {stateLesson.content}
              </p>
            ) : null}
          </div>

          {canUpload ? (
            <Button
              aria-label="Tải lên tài liệu mới"
              onClick={() => setIsUploadOpen(true)}
              size="sm"
            >
              <FileUp aria-hidden="true" className="mr-1.5 size-4" />
              <span>Tải lên tài liệu</span>
            </Button>
          ) : null}
        </div>
      </article>

      {/* Materials List Section */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Paperclip aria-hidden="true" className="size-4 text-primary" />
            <h2 className="font-semibold text-foreground">Tài liệu học tập đính kèm</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {materials.length} tệp
          </span>
        </div>

        <div className="mt-4">
          <DataState
            empty={{
              title: 'Chưa có tài liệu đính kèm',
              description: canUpload
                ? 'Hãy tải lên tài liệu học tập (PDF, DOCX, PPTX, ZIP, RAR) để chia sẻ cùng sinh viên.'
                : 'Giảng viên chưa đính kèm tài liệu cho bài học này.',
              action: canUpload ? (
                <Button onClick={() => setIsUploadOpen(true)}>
                  <FileUp aria-hidden="true" className="mr-1.5 size-4" />
                  <span>Tải lên tài liệu ngay</span>
                </Button>
              ) : null
            }}
            error={query.error}
            isEmpty={() => materials.length === 0}
            onRetry={query.refetch}
            query={query}
          >
            {() => (
              <div className="grid gap-3">
                {materials.map((material) => (
                  <MaterialItem
                    key={material.id}
                    courseId={courseId}
                    material={material}
                  />
                ))}
              </div>
            )}
          </DataState>
        </div>
      </section>

      {/* Extension Sections Slot (Host for M3 discussion or others) */}
      {sections.length > 0 ? (
        <div className="grid gap-6">
          {sections.map((section) => (
            <section.Component
              key={section.id}
              courseId={courseId}
              isArchived={isArchived}
              isOwner={isOwner}
              lesson={stateLesson}
              lessonId={Number(lessonId)}
              role={user?.role}
            />
          ))}
        </div>
      ) : null}

      <MaterialUploadDialog
        lessonId={lessonId}
        lessonTitle={stateLesson?.title}
        onOpenChange={setIsUploadOpen}
        onSuccess={() => query.refetch()}
        open={isUploadOpen}
      />
    </div>
  );
}
