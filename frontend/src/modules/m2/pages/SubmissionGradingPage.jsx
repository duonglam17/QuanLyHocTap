import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Button } from '../../../shared/components/atoms/Button.jsx';
import { Input } from '../../../shared/components/atoms/Input.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/components/atoms/Table.jsx';
import { Textarea } from '../../../shared/components/atoms/Textarea.jsx';
import { FormField } from '../../../shared/components/molecules/FormField.jsx';
import { Pagination } from '../../../shared/components/molecules/Pagination.jsx';
import { StatusBadge } from '../../../shared/components/molecules/StatusBadge.jsx';
import { DataState } from '../../../shared/components/organisms/DataState.jsx';
import { PageTemplate } from '../../../shared/components/templates/PageTemplate.jsx';
import { useApiMutation } from '../../../shared/hooks/useApiMutation.js';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { formatDateTime } from '../../../shared/lib/formatters.js';
import {
  downloadSubmission,
  gradeSubmission,
  listCourseSubmissions
} from '../api/grading.js';

const pageSize = 20;

function isValidScore(value) {
  if (value.trim() === '') return false;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 10 &&
    Math.abs(score * 4 - Math.round(score * 4)) < 1e-8;
}

export function SubmissionGradingPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [navigationDirection, setNavigationDirection] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [scoreError, setScoreError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const queryKey = ['m2', 'grading', courseId, page];
  const query = useApiQuery(
    queryKey,
    () => listCourseSubmissions(courseId, page, pageSize),
    { enabled: Boolean(courseId) }
  );
  const rows = useMemo(() => query.data?.data || [], [query.data]);
  const pagination = query.data?.pagination;
  const selected = rows.find((row) => String(row.id) === String(selectedId)) || rows[0] || null;
  const selectedIndex = selected
    ? rows.findIndex((row) => String(row.id) === String(selected.id))
    : -1;
  const mutation = useApiMutation(
    (values) => gradeSubmission(selected.id, values),
    { invalidate: [queryKey] }
  );

  useEffect(() => {
    if (!rows.length) {
      setSelectedId(null);
      setNavigationDirection(null);
      return;
    }
    if (pagination && pagination.page !== page) return;
    if (navigationDirection) {
      const nextSelection = navigationDirection === 'next' ? rows[0] : rows[rows.length - 1];
      setSelectedId(nextSelection.id);
      setNavigationDirection(null);
      return;
    }
    if (!rows.some((row) => String(row.id) === String(selectedId))) {
      setSelectedId(rows[0].id);
    }
  }, [navigationDirection, page, pagination, rows, selectedId]);

  useEffect(() => {
    setScore(selected?.score == null ? '' : String(selected.score));
    setFeedback(selected?.feedback || '');
    setScoreError('');
    setDownloadError('');
  }, [selected?.id, selected?.score, selected?.feedback]);

  function selectSubmission(submission) {
    setSelectedId(submission.id);
  }

  function moveSelection(direction) {
    if (!selected || !pagination) return;
    if (direction === 'previous') {
      if (selectedIndex > 0) {
        setSelectedId(rows[selectedIndex - 1].id);
      } else if (pagination.page > 1) {
        setNavigationDirection('previous');
        setPage((current) => current - 1);
      }
      return;
    }
    if (selectedIndex < rows.length - 1) {
      setSelectedId(rows[selectedIndex + 1].id);
    } else if (pagination.page < pagination.total_pages) {
      setNavigationDirection('next');
      setPage((current) => current + 1);
    }
  }

  async function handleDownload() {
    if (!selected || downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadSubmission(selected.id);
    } catch (error) {
      setDownloadError(error.message);
    } finally {
      setDownloading(false);
    }
  }

  async function handleGrade(event) {
    event.preventDefault();
    if (!selected || mutation.status === 'loading') return;
    if (!isValidScore(score)) {
      setScoreError('Điểm phải từ 0 đến 10 và theo bước 0.25.');
      return;
    }
    setScoreError('');
    try {
      await mutation.mutate({ score: Number(score), feedback });
    } catch (error) {
      if (error.status === 422) setScoreError(error.message);
    }
  }

  return (
    <PageTemplate title="Chấm bài" description="Xem bài nộp, tải tệp và nhập điểm cùng nhận xét.">
      <DataState
        query={query}
        empty={{
          title: 'Chưa có bài nộp',
          description: 'Khóa học hiện chưa có bài tập nào được sinh viên nộp.',
          action: {
            label: 'Quay lại bài tập',
            onClick: () => navigate(`/courses/${courseId}/assignments`)
          }
        }}
        isEmpty={(result) => !result?.data?.length}
      >
        {(result) => {
          const submissions = result.data;
          const current = submissions.find((row) => String(row.id) === String(selectedId)) ||
            submissions[0];
          const pageInfo = result.pagination;

          return (
            <div className="grid gap-6">
              <section className="grid gap-4">
                <header className="grid gap-1">
                  <h2 className="text-xl font-semibold">Bài nộp trong khóa học</h2>
                  <p className="text-sm text-muted-foreground">{pageInfo.total} bài nộp</p>
                </header>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sinh viên</TableHead>
                        <TableHead>Bài tập</TableHead>
                        <TableHead>Thời điểm nộp</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Điểm</TableHead>
                        <TableHead>Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((submission) => (
                        <TableRow
                          aria-selected={String(current.id) === String(submission.id)}
                          key={submission.id}
                        >
                          <TableCell>
                            {submission.student_name || `Sinh viên #${submission.student_id}`}
                          </TableCell>
                          <TableCell>
                            {submission.assignment_title || `Bài tập #${submission.assignment_id}`}
                          </TableCell>
                          <TableCell>{formatDateTime(submission.submitted_at)}</TableCell>
                          <TableCell>
                            <StatusBadge type="submission" value={submission.status} />
                          </TableCell>
                          <TableCell>{submission.score ?? 'Chưa chấm'}</TableCell>
                          <TableCell>
                            <Button
                              aria-label={`Chấm bài của ${submission.student_name || submission.student_id}`}
                              onClick={() => selectSubmission(submission)}
                              size="sm"
                              variant="outline"
                            >
                              {String(current.id) === String(submission.id) ? 'Đang chọn' : 'Chấm bài'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  disabled={query.status === 'loading'}
                  onPageChange={setPage}
                  page={pageInfo.page}
                  totalPages={Math.max(1, pageInfo.total_pages)}
                />
              </section>

              {current ? (
                <section className="grid gap-4 rounded-lg border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <h2 className="text-lg font-semibold">
                        {current.assignment_title || `Bài tập #${current.assignment_id}`}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {current.student_name || `Sinh viên #${current.student_id}`}
                      </p>
                    </div>
                    <StatusBadge type="submission" value={current.status} />
                  </div>

                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Thời điểm nộp</dt>
                      <dd>{formatDateTime(current.submitted_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Số lần nộp</dt>
                      <dd>{current.submission_count}</dd>
                    </div>
                  </dl>

                  <div className="grid gap-2">
                    <Button disabled={downloading} onClick={handleDownload} variant="outline">
                      <Download aria-hidden="true" className="mr-2 size-4" />
                      {downloading ? 'Đang tải tệp...' : 'Tải tệp bài nộp'}
                    </Button>
                    {downloadError ? (
                      <p className="text-sm text-destructive" role="alert">{downloadError}</p>
                    ) : null}
                  </div>

                  <form
                    aria-label="Biểu mẫu chấm điểm"
                    className="grid gap-4"
                    noValidate
                    onSubmit={handleGrade}
                  >
                    <FormField
                      error={scoreError || mutation.fieldErrors.score}
                      hint="Nhập điểm từ 0 đến 10, theo bước 0.25."
                      id="submission-score"
                      label="Điểm"
                      required
                    >
                      <Input
                        id="submission-score"
                        max="10"
                        min="0"
                        onChange={(event) => {
                          setScore(event.target.value);
                          setScoreError('');
                        }}
                        required
                        step="0.25"
                        type="number"
                        value={score}
                      />
                    </FormField>
                    <FormField id="submission-feedback" label="Nhận xét">
                      <Textarea
                        id="submission-feedback"
                        onChange={(event) => setFeedback(event.target.value)}
                        value={feedback}
                      />
                    </FormField>
                    {mutation.error && mutation.error.status !== 422 ? (
                      <p className="text-sm text-destructive" role="alert">{mutation.error.message}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={query.status === 'loading' || (selectedIndex <= 0 && pageInfo.page <= 1)}
                        onClick={() => moveSelection('previous')}
                        type="button"
                        variant="outline"
                      >
                        Bài trước
                      </Button>
                      <Button
                        disabled={
                          query.status === 'loading' ||
                          (selectedIndex >= submissions.length - 1 &&
                            pageInfo.page >= pageInfo.total_pages)
                        }
                        onClick={() => moveSelection('next')}
                        type="button"
                        variant="outline"
                      >
                        Bài tiếp
                      </Button>
                      <Button disabled={mutation.status === 'loading'} type="submit">
                        {mutation.status === 'loading' ? 'Đang lưu điểm...' : 'Lưu điểm'}
                      </Button>
                    </div>
                  </form>
                </section>
              ) : null}
            </div>
          );
        }}
      </DataState>
    </PageTemplate>
  );
}
