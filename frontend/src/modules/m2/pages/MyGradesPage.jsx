import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../../shared/components/atoms/Select.jsx';
import { FormField } from '../../../shared/components/molecules/FormField.jsx';
import { DataState } from '../../../shared/components/organisms/DataState.jsx';
import { PageTemplate } from '../../../shared/components/templates/PageTemplate.jsx';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { listCoursesForGrades } from '../api/grades.js';
import { CourseGradebook } from '../components/CourseGradebook.jsx';

const emptyCourses = [];

export function MyGradesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCourseId = searchParams.get('courseId');
  const coursesQuery = useApiQuery(['m2', 'my-grades', 'courses'], listCoursesForGrades);
  const courses = coursesQuery.data?.items ?? emptyCourses;
  const selectedCourse =
    courses.find((course) => String(course.id) === selectedCourseId) || courses[0] || null;

  useEffect(() => {
    if (!courses.length) return;
    const hasSelectedCourse = courses.some((course) => String(course.id) === selectedCourseId);
    if (!hasSelectedCourse) {
      setSearchParams({ courseId: String(courses[0].id) }, { replace: true });
    }
  }, [courses, selectedCourseId, setSearchParams]);

  return (
    <PageTemplate
      title="Điểm của tôi"
      description="Theo dõi điểm bài tập và điểm trắc nghiệm trong các khóa học đã tham gia."
    >
      <DataState
        query={coursesQuery}
        isEmpty={(result) => !result?.items?.length}
        empty={{
          title: 'Bạn chưa tham gia khóa học nào',
          description: 'Khi ghi danh khóa học, bảng điểm cá nhân sẽ xuất hiện tại đây.'
        }}
        loading={
          <div className="grid gap-3" role="status">
            <span className="sr-only">Đang tải khóa học...</span>
            <div className="h-10 w-full animate-pulse rounded-md bg-muted sm:w-1/2" />
            <div className="h-40 w-full animate-pulse rounded-md bg-muted" />
          </div>
        }
      >
        {() => (
          <div className="grid gap-6">
            <FormField id="grades-course" label="Khóa học">
              <Select
                onValueChange={(courseId) => setSearchParams({ courseId })}
                value={selectedCourse ? String(selectedCourse.id) : ''}
              >
                <SelectTrigger id="grades-course" aria-label="Khóa học">
                  <SelectValue placeholder="Chọn khóa học" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.code ? `${course.code} - ` : ''}
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {selectedCourse ? <CourseGradebook courseId={selectedCourse.id} /> : null}
          </div>
        )}
      </DataState>
    </PageTemplate>
  );
}
