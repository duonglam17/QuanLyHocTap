import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { DataState } from '../../../shared/components/organisms/DataState.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../../shared/components/atoms/Table.jsx';
import { StatusBadge } from '../../../shared/components/molecules/StatusBadge.jsx';
import { formatScore } from '../../../shared/lib/formatters.js';
import { getMyCourseGrades } from '../api/grades.js';

function isGradebookEmpty(gradebook) {
  return !gradebook?.assignments?.length && !gradebook?.quizzes?.length;
}

function GradeRows({ title, rows, showFeedback = false, statusType }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length ? (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên bài</TableHead>
                <TableHead>Điểm</TableHead>
                <TableHead>Điểm tối đa</TableHead>
                {showFeedback ? <TableHead>Nhận xét</TableHead> : null}
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={`${item.type}-${item.id}`}>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{formatScore(item.score)}</TableCell>
                  <TableCell>{formatScore(item.maxScore)}</TableCell>
                  {showFeedback ? <TableCell>{item.feedback || 'Chưa có'}</TableCell> : null}
                  <TableCell>
                    {item.status ? (
                      <StatusBadge type={statusType} value={item.status} />
                    ) : (
                      'Chưa có'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Chưa có {title.toLocaleLowerCase('vi-VN')}.
        </p>
      )}
    </section>
  );
}

export function CourseGradebook({ courseId }) {
  const query = useApiQuery(['m2', 'my-grades', courseId], () => getMyCourseGrades(courseId), {
    enabled: Boolean(courseId)
  });

  return (
    <div className="grid gap-6">
      <p className="rounded-md bg-muted p-3 text-sm" role="note">
        Điểm trắc nghiệm chưa được mở để xem sẽ không hiển thị. Điểm chưa có được ghi là “Chưa có”,
        không mặc định thành 0.
      </p>
      <DataState
        query={query}
        isEmpty={isGradebookEmpty}
        empty={{
          title: 'Chưa có điểm',
          description: 'Khóa học chưa có điểm bài tập hoặc trắc nghiệm để hiển thị.'
        }}
        loading={
          <div className="grid gap-3" role="status">
            <span className="sr-only">Đang tải bảng điểm...</span>
            <div className="h-8 w-1/3 animate-pulse rounded-md bg-muted" />
            <div className="h-40 w-full animate-pulse rounded-md bg-muted" />
          </div>
        }
      >
        {(gradebook) => (
          <div className="grid gap-6">
            <GradeRows
              rows={gradebook.assignments}
              showFeedback
              statusType="submission"
              title="Điểm bài tập"
            />
            <GradeRows
              rows={gradebook.quizzes}
              statusType="attempt"
              title="Điểm trắc nghiệm"
            />
          </div>
        )}
      </DataState>
    </div>
  );
}

export function GradebookTab({ courseId }) {
  return <CourseGradebook courseId={courseId} />;
}
