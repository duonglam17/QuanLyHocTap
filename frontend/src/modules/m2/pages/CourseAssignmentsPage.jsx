import { useParams } from 'react-router-dom';
import { api } from '../../../shared/api/client.js';
import { useAuth } from '../../../shared/auth/useAuth.js';
import { DataState } from '../../../shared/components/organisms/DataState.jsx';
import { Skeleton } from '../../../shared/components/atoms/Skeleton.jsx';
import { PageTemplate } from '../../../shared/components/templates/PageTemplate.jsx';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { AssignmentTab } from '../components/AssignmentTab.jsx';

export function CourseAssignmentsPage() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const query = useApiQuery(
    ['m2', 'course', courseId],
    async () => {
      const response = await api.get(`/courses/${courseId}`);
      return response.course;
    },
    { enabled: Boolean(courseId) }
  );

  return (
    <PageTemplate
      description="Bài tập, hạn nộp và trạng thái nộp bài trong khóa học."
      title="Bài tập"
    >
      <DataState
        empty={{
          title: 'Không tìm thấy khóa học',
          description: 'Khóa học không tồn tại hoặc bạn không thể truy cập.'
        }}
        isEmpty={(course) => !course?.id}
        query={query}
        loading={
          <div className="grid gap-2" role="status">
            <span className="sr-only">Đang tải khóa học...</span>
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        }
      >
        {(course) => (
          <AssignmentTab
            course={course}
            courseId={courseId}
            isOwner={Number(course.ownerId) === Number(user?.id)}
            role={user?.role}
          />
        )}
      </DataState>
    </PageTemplate>
  );
}
