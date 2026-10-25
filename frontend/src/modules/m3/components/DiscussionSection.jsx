import { useMemo, useState } from 'react';
import { useApiMutation } from '../../../shared/hooks/useApiMutation.js';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { formatDateTime } from '../../../shared/lib/formatters.js';
import {
  Button,
  DataState,
  FormField,
  Pagination,
  Skeleton,
  Textarea,
  toast
} from '../../../shared/components/index.js';
import {
  createLessonDiscussion,
  listLessonDiscussions,
  replyToDiscussion
} from '../api/discussions.js';

const pageLimit = 20;

function DiscussionComposer({ label, onSubmit, pending, error, submitLabel = 'Gửi bình luận' }) {
  const [content, setContent] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const submitted = await onSubmit(content);
    if (submitted) setContent('');
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <FormField id={`discussion-content-${label}`} label={label} required>
        <Textarea
          id={`discussion-content-${label}`}
          onChange={(event) => setContent(event.target.value)}
          required
          value={content}
        />
      </FormField>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="flex justify-end">
        <Button disabled={pending || !content.trim()} type="submit">
          {pending ? 'Đang gửi...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function DiscussionReply({ reply }) {
  return (
    <article className="grid gap-1 rounded-md bg-muted/50 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">{reply.author?.fullName ?? 'Thành viên khóa học'}</span>
        <time className="text-muted-foreground" dateTime={reply.createdAt}>
          {formatDateTime(reply.createdAt)}
        </time>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{reply.content}</p>
    </article>
  );
}

function DiscussionThread({ discussion, canParticipate, onReply, replyPending, replyError }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const replies = discussion.replies ?? [];

  async function submitReply(content) {
    const submitted = await onReply(discussion.id, content);
    if (submitted) setReplyOpen(false);
    return submitted;
  }

  return (
    <li className="grid gap-3 p-4">
      <article className="grid gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium">{discussion.author?.fullName ?? 'Thành viên khóa học'}</span>
          <time className="text-muted-foreground" dateTime={discussion.createdAt}>
            {formatDateTime(discussion.createdAt)}
          </time>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm">{discussion.content}</p>
        {canParticipate ? (
          <div>
            <Button
              aria-expanded={replyOpen}
              onClick={() => setReplyOpen((open) => !open)}
              size="sm"
              variant="outline"
            >
              {replyOpen ? 'Hủy trả lời' : 'Trả lời'}
            </Button>
          </div>
        ) : null}
      </article>

      {replies.length ? (
        <div className="ml-4 grid gap-2 border-l border-border pl-4 sm:ml-8">
          {replies.map((reply) => <DiscussionReply key={reply.id} reply={reply} />)}
        </div>
      ) : null}

      {replyOpen ? (
        <div className="ml-4 sm:ml-8">
          <DiscussionComposer
            error={replyError}
            label={`Trả lời ${discussion.author?.fullName ?? 'bình luận'}`}
            onSubmit={submitReply}
            pending={replyPending}
            submitLabel="Gửi trả lời"
          />
        </div>
      ) : null}
    </li>
  );
}

export function DiscussionSection({ lessonId, role, isArchived = false }) {
  const [page, setPage] = useState(1);
  const [pendingReplyId, setPendingReplyId] = useState(null);
  const queryKey = useMemo(
    () => ['m3', 'discussions', lessonId, page],
    [lessonId, page]
  );
  const query = useApiQuery(
    queryKey,
    () => listLessonDiscussions(lessonId, { page, limit: pageLimit }),
    { enabled: Boolean(lessonId) }
  );
  const canParticipate = !isArchived && ['SINH_VIEN', 'GIANG_VIEN'].includes(role);
  const [createError, setCreateError] = useState(null);
  const [replyErrors, setReplyErrors] = useState({});

  const createMutation = useApiMutation(
    (content) => createLessonDiscussion(lessonId, content),
    {
      invalidate: [queryKey],
      onSuccess: () => {
        toast.success('Đã đăng bình luận.');
        setCreateError(null);
      }
    }
  );
  const replyMutation = useApiMutation(
    ({ commentId, content }) => replyToDiscussion(commentId, content),
    {
      invalidate: [queryKey],
      onSuccess: () => {
        toast.success('Đã gửi trả lời.');
      }
    }
  );

  async function submitDiscussion(content) {
    try {
      await createMutation.mutate(content);
      return true;
    } catch (error) {
      setCreateError(error.message || 'Không thể đăng bình luận.');
      return false;
    }
  }

  async function submitReply(commentId, content) {
    setPendingReplyId(commentId);
    try {
      await replyMutation.mutate({ commentId, content });
      setReplyErrors((errors) => ({ ...errors, [commentId]: null }));
      return true;
    } catch (error) {
      setReplyErrors((errors) => ({
        ...errors,
        [commentId]: error.message || 'Không thể gửi trả lời.'
      }));
      return false;
    } finally {
      setPendingReplyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / pageLimit));

  return (
    <section aria-labelledby="lesson-discussion-title" className="grid gap-4">
      <header className="grid gap-1">
        <h2 className="text-xl font-semibold" id="lesson-discussion-title">Thảo luận bài học</h2>
        <p className="text-sm text-muted-foreground">
          Đặt câu hỏi hoặc trao đổi với các thành viên khóa học.
        </p>
      </header>

      {canParticipate ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <DiscussionComposer
            error={createError}
            label="Bình luận mới"
            onSubmit={submitDiscussion}
            pending={createMutation.status === 'loading'}
          />
        </div>
      ) : null}

      <DataState
        empty={{
          title: 'Chưa có thảo luận',
          description: canParticipate
            ? 'Hãy đặt câu hỏi đầu tiên về bài học này.'
            : 'Chưa có bình luận nào cho bài học này.'
        }}
        isEmpty={(result) => !result?.items?.length}
        loading={
          <div className="grid gap-2" role="status">
            <span className="sr-only">Đang tải thảo luận...</span>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        }
        query={query}
      >
        {(result) => (
          <div className="grid gap-4">
            <ul className="divide-y rounded-lg border border-border">
              {result.items.map((discussion) => (
                <DiscussionThread
                  canParticipate={canParticipate}
                  discussion={discussion}
                  key={discussion.id}
                  onReply={submitReply}
                  replyError={replyErrors[discussion.id] ?? null}
                  replyPending={pendingReplyId === discussion.id}
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
    </section>
  );
}
