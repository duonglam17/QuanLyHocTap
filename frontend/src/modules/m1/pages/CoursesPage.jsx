import { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { useAuth } from '@/shared/auth/useAuth.js';
import { useApiQuery } from '@/shared/hooks/useApiQuery.js';
import { PageHeader } from '@/shared/components/molecules/PageHeader.jsx';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { Skeleton } from '@/shared/components/atoms/Skeleton.jsx';
import { DataState } from '@/shared/components/organisms/DataState.jsx';
import { CourseCard } from '../components/CourseCard.jsx';
import { CourseFormDialog } from '../components/CourseFormDialog.jsx';
import { EnrollmentDialog } from '../components/EnrollmentDialog.jsx';
import { listCourses } from '../api/courses.js';

function CoursesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((key) => (
        <div
          className="flex h-52 flex-col justify-between rounded-lg border border-border p-5"
          key={key}
        >
          <div>
            <div className="flex justify-between">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="mt-4 h-6 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/3" />
            <Skeleton className="mt-3 h-10 w-full" />
          </div>
          <div className="flex justify-between border-t border-border pt-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CoursesPage() {
  const { user } = useAuth();
  const [openCreate, setOpenCreate] = useState(false);
  const [openEnroll, setOpenEnroll] = useState(false);

  const query = useApiQuery(['courses'], listCourses);

  const isInstructor = user?.role === 'GIANG_VIEN';
  const isStudent = user?.role === 'SINH_VIEN';

  function getEmptyAction() {
    if (isInstructor) {
      return (
        <Button onClick={() => setOpenCreate(true)}>
          <Plus aria-hidden="true" className="mr-1.5 size-4" />
          <span>Tạo khóa học mới</span>
        </Button>
      );
    }
    if (isStudent) {
      return (
        <Button onClick={() => setOpenEnroll(true)}>
          <UserPlus aria-hidden="true" className="mr-1.5 size-4" />
          <span>Tham gia khóa học</span>
        </Button>
      );
    }
    return null;
  }

  function getEmptyDescription() {
    if (isInstructor) {
      return 'Bắt đầu tạo khóa học mới để chia sẻ bài giảng và quản lý sinh viên.';
    }
    if (isStudent) {
      return 'Hãy nhập mã ghi danh do giảng viên cung cấp để tham gia lớp học.';
    }
    return 'Chưa có khóa học nào trên hệ thống.';
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            {isInstructor ? (
              <Button onClick={() => setOpenCreate(true)}>
                <Plus aria-hidden="true" className="mr-1.5 size-4" />
                <span>Tạo khóa học</span>
              </Button>
            ) : null}
            {isStudent ? (
              <Button onClick={() => setOpenEnroll(true)} variant="outline">
                <UserPlus aria-hidden="true" className="mr-1.5 size-4" />
                <span>Ghi danh bằng mã</span>
              </Button>
            ) : null}
          </div>
        }
        description={
          isInstructor
            ? 'Quản lý các khóa học do bạn phụ trách giảng dạy.'
            : isStudent
              ? 'Danh sách các khóa học bạn đã đăng ký tham gia.'
              : 'Quản trị danh mục khóa học trong hệ thống.'
        }
        title="Danh sách khóa học"
      />

      <DataState
        empty={{
          title: isStudent
            ? 'Chưa ghi danh khóa học nào'
            : 'Chưa có khóa học nào',
          description: getEmptyDescription(),
          action: getEmptyAction()
        }}
        isEmpty={(data) => !data?.items || data.items.length === 0}
        loading={<CoursesSkeleton />}
        query={query}
      >
        {(data) => (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((course) => (
              <CourseCard
                course={course}
                isOwner={Boolean(user && course.ownerId === user.id)}
                key={course.id}
                role={user?.role}
              />
            ))}
          </div>
        )}
      </DataState>

      {isInstructor ? (
        <CourseFormDialog
          onOpenChange={setOpenCreate}
          onSuccess={() => query.refetch()}
          open={openCreate}
        />
      ) : null}

      {isStudent ? (
        <EnrollmentDialog
          onOpenChange={setOpenEnroll}
          onSuccess={() => query.refetch()}
          open={openEnroll}
        />
      ) : null}
    </div>
  );
}
