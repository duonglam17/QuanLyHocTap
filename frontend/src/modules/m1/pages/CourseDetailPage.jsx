import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Check,
  Copy,
  Edit,
  KeyRound,
  Send
} from 'lucide-react';
import { useAuth } from '@/shared/auth/useAuth.js';
import { useApiQuery } from '@/shared/hooks/useApiQuery.js';
import { getCourseTabs } from '@/shared/lib/slots.js';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { Skeleton } from '@/shared/components/atoms/Skeleton.jsx';
import { StatusBadge } from '@/shared/components/molecules/StatusBadge.jsx';
import { ConfirmDialog } from '@/shared/components/molecules/ConfirmDialog.jsx';
import { EmptyState } from '@/shared/components/organisms/EmptyState.jsx';
import { ErrorState } from '@/shared/components/organisms/ErrorState.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/atoms/Tabs.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { CourseFormDialog } from '../components/CourseFormDialog.jsx';
import {
  deleteOrArchiveCourse,
  getCourse,
  publishCourse
} from '../api/courses.js';

function CourseDetailSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="mt-4 h-8 w-1/2" />
        <Skeleton className="mt-2 h-4 w-1/4" />
        <Skeleton className="mt-4 h-16 w-full" />
      </div>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [openEdit, setOpenEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('');

  const query = useApiQuery(['course', courseId], () => getCourse(courseId));
  const course = query.data?.course;

  const isOwner = Boolean(user && course && course.ownerId === user.id);
  const isArchived = course?.status === 'ARCHIVED';
  const isDraft = course?.status === 'DRAFT';
  const canManage = isOwner || user?.role === 'ADMIN';

  const tabs = useMemo(() => {
    return getCourseTabs(user?.role);
  }, [user?.role]);

  // Đặt tab mặc định là tab đầu tiên nếu chưa chọn
  const currentTab = activeTab || tabs[0]?.id || '';

  async function handleCopyKey() {
    if (!course?.enrollment_key) return;
    try {
      await navigator.clipboard.writeText(course.enrollment_key);
      setCopied(true);
      toast.success(`Đã sao chép mã ghi danh: ${course.enrollment_key}`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép mã ghi danh.');
    }
  }

  async function handlePublish() {
    try {
      await publishCourse(course.id);
      toast.success('Đã xuất bản khóa học thành công! Sinh viên có thể ghi danh.');
      query.refetch();
    } catch (error) {
      toast.error(error.message || 'Không thể xuất bản khóa học.');
    }
  }

  async function handleArchive() {
    try {
      const result = await deleteOrArchiveCourse(course.id);
      if (result.archived) {
        toast.success(
          result.message ||
            'Khóa học đã có dữ liệu học tập nên được chuyển sang trạng thái Lưu trữ (chỉ đọc).'
        );
      } else {
        toast.success('Khóa học đã được lưu trữ.');
      }
      query.refetch();
    } catch (error) {
      toast.error(error.message || 'Không thể lưu trữ khóa học.');
    }
  }

  if (query.status === 'loading') {
    return <CourseDetailSkeleton />;
  }

  if (query.status === 'error') {
    return (
      <div className="grid gap-4">
        <Link
          className="inline-flex w-fit items-center rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          to="/courses"
        >
          <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
          <span>Quay lại danh sách khóa học</span>
        </Link>
        <ErrorState
          message={query.error?.message || 'Không thể tải thông tin khóa học.'}
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="grid gap-4">
        <Link
          className="inline-flex w-fit items-center rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          to="/courses"
        >
          <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
          <span>Quay lại danh sách khóa học</span>
        </Link>
        <EmptyState
          description="Khóa học không tồn tại hoặc đã bị xóa."
          title="Không tìm thấy khóa học"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <Link
          className="mb-4 inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          to="/courses"
        >
          <ArrowLeft aria-hidden="true" className="mr-1.5 size-4" />
          <span>Danh sách khóa học</span>
        </Link>

        {isArchived ? (
          <div
            aria-live="polite"
            className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground"
            role="status"
          >
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              Khóa học đã lưu trữ (Chỉ đọc):
            </span>{' '}
            Khóa học này đã kết thúc hoặc được lưu trữ. Mọi hoạt động nộp bài, chỉnh sửa và làm bài thi đều bị khóa.
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {course.code}
                </span>
                <span className="text-xs text-muted-foreground">Học kỳ: {course.semester}</span>
                <StatusBadge type="course" value={course.status} />
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {course.title}
              </h1>

              {course.description ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {course.description}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {course.enrollment_key ? (
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs">
                  <KeyRound aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Mã ghi danh:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {course.enrollment_key}
                  </span>
                  <Button
                    aria-label="Sao chép mã ghi danh"
                    className="h-6 w-6 p-0"
                    onClick={handleCopyKey}
                    size="icon"
                    title="Sao chép mã"
                    variant="ghost"
                  >
                    {copied ? (
                      <Check aria-hidden="true" className="size-3.5 text-success" />
                    ) : (
                      <Copy aria-hidden="true" className="size-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              ) : null}

              {canManage && !isArchived ? (
                <>
                  {isDraft ? (
                    <ConfirmDialog
                      confirmLabel="Xuất bản"
                      description="Sau khi xuất bản, khóa học sẽ ở trạng thái PUBLISHED và sinh viên có thể dùng mã ghi danh để tham gia."
                      onConfirm={handlePublish}
                      title="Xuất bản khóa học"
                      trigger={
                        <Button size="sm">
                          <Send aria-hidden="true" className="mr-1.5 size-3.5" />
                          <span>Xuất bản</span>
                        </Button>
                      }
                    />
                  ) : null}

                  <Button
                    onClick={() => setOpenEdit(true)}
                    size="sm"
                    variant="outline"
                  >
                    <Edit aria-hidden="true" className="mr-1.5 size-3.5" />
                    <span>Sửa</span>
                  </Button>

                  <ConfirmDialog
                    confirmLabel="Lưu trữ"
                    description="Khóa học đã có dữ liệu chỉ cho phép lưu trữ để bảo vệ toàn vẹn điểm và bài làm của sinh viên (EC-09). Khóa học sẽ chuyển sang chế độ chỉ đọc."
                    onConfirm={handleArchive}
                    title="Lưu trữ khóa học"
                    trigger={
                      <Button size="sm" variant="outline">
                        <Archive aria-hidden="true" className="mr-1.5 size-3.5" />
                        <span>Lưu trữ</span>
                      </Button>
                    }
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Slot khu vực: nạp động qua getCourseTabs */}
      {tabs.length > 0 ? (
        <Tabs onValueChange={setActiveTab} value={currentTab}>
          <TabsList className="mb-4">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => {
            const TabComponent = tab.Component;
            return (
              <TabsContent key={tab.id} value={tab.id}>
                <TabComponent
                  course={course}
                  courseId={course.id}
                  isOwner={isOwner}
                  role={user?.role}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      ) : (
        <EmptyState
          description="Nội dung bài giảng và lịch học của M1 sẽ xuất hiện tại đây khi hoàn thành bước A4 và A5."
          title="Chưa có tab nội dung nào"
        />
      )}

      {openEdit ? (
        <CourseFormDialog
          course={course}
          onOpenChange={setOpenEdit}
          onSuccess={() => query.refetch()}
          open={openEdit}
        />
      ) : null}
    </div>
  );
}
