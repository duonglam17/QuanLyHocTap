import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../../shared/components/atoms/Button.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../../shared/components/atoms/Table.jsx';
import { Pagination } from '../../../shared/components/molecules/Pagination.jsx';
import { DataState } from '../../../shared/components/organisms/DataState.jsx';
import { PageTemplate } from '../../../shared/components/templates/PageTemplate.jsx';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { formatScore } from '../../../shared/lib/formatters.js';
import { downloadClassGradebook, getClassGradebook } from '../api/classGradebook.js';

function GradeColumns({ assignments, quizzes }) {
  return (
    <>
      {assignments.map((assignment) => (
        <TableHead key={`assignment-${assignment.id}`}>
          {assignment.title}
          <span className="block text-xs font-normal">
            Tối đa {formatScore(assignment.max_score)}
          </span>
        </TableHead>
      ))}
      {quizzes.map((quiz) => (
        <TableHead key={`quiz-${quiz.id}`}>{quiz.title}</TableHead>
      ))}
    </>
  );
}

function GradeValues({ student, assignments, quizzes }) {
  return (
    <>
      {assignments.map((assignment) => (
        <TableCell key={`assignment-${assignment.id}`}>
          {formatScore(student.assignments?.[assignment.id])}
        </TableCell>
      ))}
      {quizzes.map((quiz) => (
        <TableCell key={`quiz-${quiz.id}`}>{formatScore(student.quizzes?.[quiz.id])}</TableCell>
      ))}
    </>
  );
}

export function ClassGradebookPage() {
  const { courseId } = useParams();
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const queryKey = ['m2', 'class-gradebook', courseId, page];
  const query = useApiQuery(queryKey, () => getClassGradebook(courseId, page), {
    enabled: Boolean(courseId)
  });

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try {
      await downloadClassGradebook(courseId);
    } catch (error) {
      setExportError(error.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageTemplate
      title="Bảng điểm lớp"
      description="Tổng hợp điểm bài tập và trắc nghiệm của sinh viên trong khóa học."
    >
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Danh sách được phân trang 20 sinh viên mỗi trang.
          </p>
          <Button disabled={exporting} onClick={handleExport}>
            {exporting ? 'Đang tạo tệp...' : 'Xuất CSV'}
          </Button>
        </div>
        {exportError ? (
          <p className="text-sm text-destructive" role="alert">
            {exportError}
          </p>
        ) : null}
        <DataState
          query={query}
          isEmpty={(result) => !result?.data?.length}
          empty={{
            title: 'Chưa có sinh viên trong bảng điểm',
            description: 'Sinh viên sẽ xuất hiện sau khi ghi danh vào khóa học.'
          }}
          loading={
            <div className="grid gap-3" role="status">
              <span className="sr-only">Đang tải bảng điểm lớp...</span>
              <div className="h-8 w-1/3 animate-pulse rounded-md bg-muted" />
              <div className="h-56 w-full animate-pulse rounded-md bg-muted" />
            </div>
          }
        >
          {(gradebook) => (
            <div className="grid gap-4">
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã sinh viên</TableHead>
                      <TableHead>Họ và tên</TableHead>
                      <GradeColumns
                        assignments={gradebook.assignments}
                        quizzes={gradebook.quizzes}
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradebook.data.map((student) => (
                      <TableRow key={student.student_id}>
                        <TableCell>{student.student_number || 'Chưa có'}</TableCell>
                        <TableCell>{student.full_name || 'Chưa có'}</TableCell>
                        <GradeValues
                          student={student}
                          assignments={gradebook.assignments}
                          quizzes={gradebook.quizzes}
                        />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {gradebook.pagination.total_pages > 1 ? (
                <Pagination
                  page={gradebook.pagination.page}
                  totalPages={gradebook.pagination.total_pages}
                  onPageChange={setPage}
                  disabled={query.status === 'loading'}
                />
              ) : null}
            </div>
          )}
        </DataState>
      </div>
    </PageTemplate>
  );
}
