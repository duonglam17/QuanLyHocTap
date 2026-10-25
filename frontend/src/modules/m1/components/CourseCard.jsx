import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, KeyRound } from 'lucide-react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { StatusBadge } from '@/shared/components/molecules/StatusBadge.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';

export function CourseCard({ course, isOwner, role }) {
  const [copied, setCopied] = useState(false);

  async function handleCopyKey(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!course.enrollment_key) return;
    try {
      await navigator.clipboard.writeText(course.enrollment_key);
      setCopied(true);
      toast.success(`Đã sao chép mã ghi danh: ${course.enrollment_key}`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép vào bộ nhớ tạm.');
    }
  }

  const showEnrollmentKey = Boolean(
    course.enrollment_key && (isOwner || role === 'ADMIN' || course.status === 'PUBLISHED')
  );

  return (
    <article className="flex h-full flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {course.code}
          </span>
          <StatusBadge type="course" value={course.status} />
        </div>

        <h3 className="mt-3 text-lg font-semibold text-foreground">
          <Link
            className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to={`/courses/${course.id}`}
          >
            {course.title}
          </Link>
        </h3>

        <p className="mt-1 text-xs text-muted-foreground">Học kỳ: {course.semester}</p>

        {course.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {course.description}
          </p>
        ) : null}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2">
          {showEnrollmentKey ? (
            <div className="flex items-center gap-1.5 text-xs">
              <KeyRound aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span className="font-mono font-medium text-foreground">
                {course.enrollment_key}
              </span>
              <Button
                aria-label="Sao chép mã ghi danh"
                className="h-6 w-6 p-0"
                onClick={handleCopyKey}
                size="icon"
                title="Sao chép mã ghi danh"
                variant="ghost"
              >
                {copied ? (
                  <Check aria-hidden="true" className="size-3 text-success" />
                ) : (
                  <Copy aria-hidden="true" className="size-3 text-muted-foreground" />
                )}
              </Button>
            </div>
          ) : (
            <div />
          )}

          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to={`/courses/${course.id}`}
          >
            <span>Chi tiết</span>
            <ExternalLink aria-hidden="true" className="ml-1.5 size-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
