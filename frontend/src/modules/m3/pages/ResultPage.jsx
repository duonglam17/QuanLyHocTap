import { useParams, Navigate } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton, StatusBadge } from '../../../shared/components/index.js';
import { formatDateTime, formatScore } from '../../../shared/lib/formatters.js';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { getAttemptResult } from '../api/results.js';

function ResultSkeleton() {
  return (
    <div aria-label="Đang tải kết quả lượt thi" className="mx-auto grid w-full max-w-3xl gap-5" role="status">
      <span className="sr-only">Đang tải kết quả lượt thi...</span>
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function ResultPage() {
  const { attemptId } = useParams();
  const query = useApiQuery(
    ['m3', 'attempt-result', attemptId],
    () => getAttemptResult(attemptId)
  );

  if (query.status === 'loading') return <ResultSkeleton />;
  if (query.status === 'error') {
    if (query.error?.status === 403) return <Navigate replace to="/forbidden" />;
    if (query.error?.status === 404) return <Navigate replace to="/not-found" />;
    return (
      <ErrorState
        message={query.error?.message || 'Không thể tải kết quả lượt thi.'}
        onRetry={() => query.refetch().catch(() => undefined)}
      />
    );
  }
  if (!query.data) {
    return (
      <EmptyState
        description="Không tìm thấy dữ liệu kết quả cho lượt thi này."
        title="Chưa có kết quả"
      />
    );
  }
  if (query.data.status === 'IN_PROGRESS') {
    return <Navigate replace to={`/quizzes/${encodeURIComponent(query.data.quizId)}/take`} />;
  }

  const scoreVisible = query.data.visibleToStudent === true;

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-5">
      <section className="grid gap-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold">Kết quả bài thi</h1>
            <p className="text-sm text-muted-foreground">{query.data.quizTitle}</p>
          </div>
          <StatusBadge type="attempt" value={query.data.status} />
        </div>
        {query.data.status === 'AUTO_SUBMITTED' ? (
          <p className="text-sm text-muted-foreground">Bài thi đã được hệ thống tự thu khi hết giờ.</p>
        ) : null}
        {scoreVisible ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1 rounded-md bg-muted p-4">
              <dt className="text-sm text-muted-foreground">Điểm</dt>
              <dd className="text-2xl font-semibold">{formatScore(query.data.score)}</dd>
            </div>
            <div className="grid gap-1 rounded-md bg-muted p-4">
              <dt className="text-sm text-muted-foreground">Số câu đúng</dt>
              <dd className="text-2xl font-semibold">
                {query.data.correctCount == null
                  ? 'Chưa có'
                  : `${query.data.correctCount} / ${query.data.totalQuestions}`}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="rounded-md bg-muted p-4 text-muted-foreground">
            Điểm sẽ được công bố sau.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Thời điểm nộp: {formatDateTime(query.data.submittedAt)}
        </p>
      </section>
    </main>
  );
}
