import { useMemo, useState } from 'react';
import { useApiMutation } from '../../../shared/hooks/useApiMutation.js';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { formatDateTime } from '../../../shared/lib/formatters.js';
import {
  Button,
  ConfirmDialog,
  DataState,
  FormDialog,
  FormField,
  Input,
  Pagination,
  Skeleton,
  Textarea,
  toast
} from '../../../shared/components/index.js';
import {
  createCourseAnnouncement,
  deleteCourseAnnouncement,
  listCourseAnnouncements
} from '../api/announcements.js';

const pageLimit = 20;

function AnnouncementForm({ error, fieldErrors, onSubmit, pending }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit({ title, content });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <FormField error={fieldErrors.title} id="announcement-title" label="Tiêu đề" required>
        <Input
          autoFocus
          id="announcement-title"
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          required
          value={title}
        />
      </FormField>
      <FormField error={fieldErrors.content} id="announcement-content" label="Nội dung" required>
        <Textarea
          id="announcement-content"
          onChange={(event) => setContent(event.target.value)}
          required
          value={content}
        />
      </FormField>
      {error ? <p className="text-sm text-destructive" role="alert">{error.message}</p> : null}
      <div className="flex justify-end">
        <Button disabled={pending} type="submit">
          {pending ? 'Đang đăng...' : 'Đăng thông báo'}
        </Button>
      </div>
    </form>
  );
}

function AnnouncementCard({ announcement, canManage, onDelete }) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <article className="grid min-w-0 flex-1 gap-2">
        <h3 className="font-medium">{announcement.title}</h3>
        <p className="whitespace-pre-wrap break-words text-sm">{announcement.content}</p>
        <p className="text-sm text-muted-foreground">
          Đăng lúc {formatDateTime(announcement.createdAt)}
        </p>
      </article>
      {canManage ? (
        <ConfirmDialog
          cancelLabel="Hủy"
          confirmLabel="Xóa thông báo"
          description={`Bạn có chắc muốn xóa thông báo “${announcement.title}”?`}
          onConfirm={() => onDelete(announcement)}
          title="Xác nhận xóa thông báo"
          trigger={<Button aria-label={`Xóa ${announcement.title}`} size="sm" variant="destructive">Xóa</Button>}
        />
      ) : null}
    </li>
  );
}

export function AnnouncementTab({ courseId, role, isOwner = false }) {
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formRevision, setFormRevision] = useState(0);
  const [errorRevision, setErrorRevision] = useState(-1);
  const queryKey = useMemo(
    () => ['m3', 'announcements', courseId, role, page],
    [courseId, role, page]
  );
  const query = useApiQuery(
    queryKey,
    () => listCourseAnnouncements(courseId, { page, limit: pageLimit }),
    { enabled: Boolean(courseId) }
  );
  const canManage = role === 'ADMIN' || (role === 'GIANG_VIEN' && isOwner);

  const createMutation = useApiMutation(
    (values) => createCourseAnnouncement(courseId, values),
    {
      invalidate: [queryKey],
      onSuccess: () => {
        toast.success('Đã đăng thông báo khóa học.');
        setDialogOpen(false);
        setFormRevision((revision) => revision + 1);
      }
    }
  );
  const deleteMutation = useApiMutation(
    (announcement) => deleteCourseAnnouncement(announcement.id),
    {
      invalidate: [queryKey],
      onSuccess: () => toast.success('Đã xóa thông báo khóa học.')
    }
  );

  async function submitAnnouncement(values) {
    try {
      await createMutation.mutate(values);
    } catch {
      setErrorRevision(formRevision);
    }
  }

  async function removeAnnouncement(announcement) {
    try {
      await deleteMutation.mutate(announcement);
    } catch (error) {
      toast.error(error.message || 'Không thể xóa thông báo khóa học.');
    }
  }

  function openCreateDialog() {
    setFormRevision((revision) => revision + 1);
    setDialogOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / pageLimit));
  const emptyAction = canManage
    ? { label: 'Tạo thông báo đầu tiên', onClick: openCreateDialog }
    : undefined;

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold">Thông báo khóa học</h2>
          <p className="text-sm text-muted-foreground">
            Cập nhật mới nhất dành cho thành viên khóa học.
          </p>
        </div>
        {canManage ? <Button onClick={openCreateDialog}>Tạo thông báo</Button> : null}
      </header>

      <DataState
        empty={{
          title: 'Chưa có thông báo khóa học',
          description: canManage
            ? 'Tạo thông báo đầu tiên để cập nhật cho thành viên khóa học.'
            : 'Các thông báo mới của khóa học sẽ xuất hiện tại đây.',
          action: emptyAction
        }}
        isEmpty={(result) => !result?.items?.length}
        loading={
          <div className="grid gap-2" role="status">
            <span className="sr-only">Đang tải thông báo khóa học...</span>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        }
        query={query}
      >
        {(result) => (
          <div className="grid gap-4">
            <ul className="divide-y rounded-lg border border-border">
              {result.items.map((announcement) => (
                <AnnouncementCard
                  announcement={announcement}
                  canManage={canManage}
                  key={announcement.id}
                  onDelete={removeAnnouncement}
                />
              ))}
            </ul>
            {result.total > pageLimit ? (
              <Pagination
                disabled={query.status === 'loading'}
                onPageChange={setPage}
                page={page}
                totalPages={totalPages}
              />
            ) : null}
          </div>
        )}
      </DataState>

      <FormDialog
        description="Nhập tiêu đề và nội dung để chia sẻ thông báo với thành viên khóa học."
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title="Tạo thông báo khóa học"
      >
        <AnnouncementForm
          error={errorRevision === formRevision ? createMutation.error : null}
          fieldErrors={errorRevision === formRevision ? createMutation.fieldErrors : {}}
          key={formRevision}
          onSubmit={submitAnnouncement}
          pending={createMutation.status === 'loading'}
        />
      </FormDialog>
    </section>
  );
}
