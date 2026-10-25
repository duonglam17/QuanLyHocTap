import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Upload } from 'lucide-react';
import { useAuth } from '../../../shared/auth/useAuth.js';
import { Button } from '../../../shared/components/atoms/Button.jsx';
import { FileInput } from '../../../shared/components/molecules/FileInput.jsx';
import { PageTemplate } from '../../../shared/components/templates/PageTemplate.jsx';
import { DataState } from '../../../shared/components/organisms/DataState.jsx';
import { StatusBadge } from '../../../shared/components/molecules/StatusBadge.jsx';
import { useApiMutation } from '../../../shared/hooks/useApiMutation.js';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { formatDateTime } from '../../../shared/lib/formatters.js';
import {
  getAssignment,
  getMySubmission,
  submitAssignment
} from '../api/submissions.js';

const permittedFiles = '.pdf,.docx,.pptx,.zip,.rar';
const maxUploadBytes = 20 * 1024 * 1024;

export function AssignmentSubmissionPage() {
  const { assignmentId } = useParams();
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(undefined);
  const [submittedResult, setSubmittedResult] = useState(null);
  const assignmentQuery = useApiQuery(
    ['m2-assignment', assignmentId],
    async () => getAssignment(assignmentId)
  );
  const submissionQuery = useApiQuery(
    ['m2-submission', assignmentId],
    async () => ({ submission: await getMySubmission(assignmentId) }),
    { enabled: assignmentQuery.status === 'success' && user?.role === 'SINH_VIEN' }
  );
  const submissionMutation = useApiMutation(
    async () => submitAssignment(assignmentId, file, setProgress),
    { invalidate: [['m2-submission', assignmentId]] }
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || submissionMutation.status === 'loading') return;
    setProgress(0);
    setSubmittedResult(null);
    try {
      const result = await submissionMutation.mutate();
      setSubmittedResult(result);
      setFile(null);
      setProgress(undefined);
      const input = document.getElementById('assignment-file');
      if (input) input.value = '';
    } catch {
      setProgress(undefined);
    }
  }

  return (
    <PageTemplate title="Chi tiết bài tập" description="Xem yêu cầu và nộp tệp bài làm.">
      <DataState
        query={assignmentQuery}
        empty={{
          title: 'Không tìm thấy bài tập',
          description: 'Bài tập không tồn tại hoặc đã bị xóa.'
        }}
      >
        {(assignment) => {
          const isOpen = assignment.status === 'OPEN';
          const submissionState = submittedResult
            ? { ...submissionQuery, data: { submission: submittedResult }, status: 'success' }
            : submissionQuery.status === 'success' && submissionQuery.data === null
              ? { ...submissionQuery, status: 'loading' }
              : submissionQuery;
          const submissionDataLoaded = submissionQuery.data !== null;
          const canSubmit =
            isOpen &&
            (submittedResult !== null ||
              (submissionDataLoaded && submissionQuery.status === 'success'));

          return (
            <div className="grid gap-6">
              <section className="rounded-lg border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{assignment.title}</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {assignment.description || 'Không có mô tả.'}
                    </p>
                  </div>
                  <StatusBadge type="assignment" value={assignment.status} />
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Hạn nộp</dt>
                    <dd className="font-medium">{formatDateTime(assignment.due_date)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Điểm tối đa</dt>
                    <dd className="font-medium">{assignment.max_score} điểm</dd>
                  </div>
                </dl>
                <p className="mt-4 flex gap-2 rounded-md bg-muted p-3 text-sm">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {assignment.allow_late_submission
                      ? 'Bài tập cho phép nộp trễ. Máy chủ sẽ xác định và ghi nhận trạng thái khi nhận tệp.'
                      : 'Bài tập không cho phép nộp trễ. Máy chủ xác định hạn nộp khi nhận tệp; thời gian trên thiết bị của bạn không quyết định trạng thái.'}
                  </span>
                </p>
              </section>

              <section className="grid gap-4 rounded-lg border bg-card p-5">
                <h2 className="text-lg font-semibold">Bài nộp của bạn</h2>
                <DataState
                  query={submissionState}
                  isEmpty={(data) => data?.submission == null}
                  empty={{
                    title: 'Chưa có bài nộp',
                    description: 'Chọn tệp bên dưới để nộp bài tập.',
                    action: {
                      label: 'Chọn tệp',
                      onClick: () => document.getElementById('assignment-file')?.click()
                    }
                  }}
                >
                  {(submissionData) => {
                    const current = submittedResult || submissionData.submission;
                    return current ? (
                      <div className="grid gap-2 rounded-md bg-muted p-4 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge type="submission" value={current.status} />
                          {current.is_late ? <span>Nộp trễ {current.late_minutes} phút</span> : null}
                        </div>
                        <p>Tệp: {current.original_filename}</p>
                        <p>Thời điểm nộp: {formatDateTime(current.submitted_at)}</p>
                        <p>Số lần nộp: {current.submission_count}</p>
                      </div>
                    ) : null;
                  }}
                </DataState>

                {!isOpen ? (
                  <p className="rounded-md bg-muted p-3 text-sm" role="status">
                    Bài tập hiện không nhận bài nộp.
                  </p>
                ) : null}

                {canSubmit ? (
                  <form className="grid gap-4" onSubmit={handleSubmit}>
                    <label className="grid gap-2 text-sm font-medium" htmlFor="assignment-file">
                      Tệp bài làm (PDF, DOCX, PPTX, ZIP hoặc RAR; tối đa 20 MB)
                    </label>
                    <FileInput
                      id="assignment-file"
                      accept={permittedFiles}
                      disabled={submissionMutation.status === 'loading'}
                      maxSize={maxUploadBytes}
                      onFileChange={setFile}
                      progress={submissionMutation.status === 'loading' ? progress : undefined}
                    />
                    {submissionMutation.error ? (
                      <p className="text-sm text-destructive" role="alert">
                        {submissionMutation.error.message}
                      </p>
                    ) : null}
                    <div>
                      <Button
                        disabled={!file || submissionMutation.status === 'loading' || !isOpen}
                        type="submit"
                      >
                        <Upload aria-hidden="true" className="mr-2 size-4" />
                        {submissionMutation.status === 'loading'
                          ? 'Đang gửi bài...'
                          : submissionState.data?.submission || submittedResult
                            ? 'Nộp lại bài'
                            : 'Nộp bài'}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </section>
            </div>
          );
        }}
      </DataState>
    </PageTemplate>
  );
}
