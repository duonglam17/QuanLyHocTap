import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileUp, Paperclip } from 'lucide-react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { MaterialItem } from './MaterialItem.jsx';
import { MaterialUploadDialog } from './MaterialUploadDialog.jsx';

export function LessonCard({ lesson, courseId, isOwner, isArchived, onMaterialUploaded }) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const materials = lesson.materials || [];
  const canUpload = isOwner && !isArchived;

  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Bài {lesson.orderIndex}
            </span>
          </div>

          <h3 className="mt-2 text-lg font-semibold text-foreground">
            <Link
              className="inline-flex items-center gap-1.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              state={{ lesson, courseId, isOwner, isArchived }}
              to={`/lessons/${lesson.id}`}
            >
              <span>{lesson.title}</span>
              <ExternalLink aria-hidden="true" className="size-4 opacity-70" />
            </Link>
          </h3>

          {lesson.content ? (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
              {lesson.content}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canUpload ? (
            <Button
              aria-label={`Thêm tài liệu cho bài ${lesson.title}`}
              onClick={() => setIsUploadOpen(true)}
              size="sm"
              variant="outline"
            >
              <FileUp aria-hidden="true" className="mr-1.5 size-3.5" />
              <span>Thêm tài liệu</span>
            </Button>
          ) : null}

          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            state={{ lesson, courseId, isOwner, isArchived }}
            to={`/lessons/${lesson.id}`}
          >
            <span>Chi tiết</span>
          </Link>
        </div>
      </div>

      {/* Materials Section */}
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Paperclip aria-hidden="true" className="size-3.5" />
          <span>Tài liệu đính kèm ({materials.length})</span>
        </div>

        {materials.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {materials.map((material) => (
              <MaterialItem
                key={material.id}
                courseId={courseId}
                material={material}
              />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs italic text-muted-foreground">
            Chưa có tài liệu đính kèm nào cho bài học này.
          </p>
        )}
      </div>

      <MaterialUploadDialog
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        onOpenChange={setIsUploadOpen}
        onSuccess={onMaterialUploaded}
        open={isUploadOpen}
      />
    </article>
  );
}
