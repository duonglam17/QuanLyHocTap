import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/ApiError.js';
import { api } from '../../../shared/api/client.js';
import { getLessonSections } from '../../../shared/lib/slots.js';
import { renderWithProviders } from '../../../shared/test-utils/renderWithProviders.jsx';
import { DiscussionSection } from './DiscussionSection.jsx';

const reply = {
  id: 22,
  courseId: 3,
  lessonId: 4,
  parentDiscussionId: 20,
  authorId: 8,
  author: { id: 8, username: 'student2', fullName: 'Sinh viên Hai', role: 'SINH_VIEN' },
  content: 'Em cũng đang thắc mắc.',
  createdAt: '2030-12-01T02:00:00.000Z',
  updatedAt: '2030-12-01T02:00:00.000Z',
  replies: []
};

const thread = {
  id: 20,
  courseId: 3,
  lessonId: 4,
  parentDiscussionId: null,
  authorId: 7,
  author: { id: 7, username: 'student1', fullName: 'Sinh viên Một', role: 'SINH_VIEN' },
  content: '<script>alert("xss")</script>\nLàm sao áp dụng công thức này?',
  createdAt: '2030-12-01T01:00:00.000Z',
  updatedAt: '2030-12-01T01:00:00.000Z',
  replies: [reply]
};

function createPage(overrides = {}) {
  return { items: [thread], page: 1, limit: 20, total: 1, ...overrides };
}

function renderSection({ role = 'SINH_VIEN', isArchived = false } = {}) {
  return renderWithProviders(
    <DiscussionSection isArchived={isArchived} lessonId={4} role={role} />
  );
}

describe('DiscussionSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the discussion lesson section for students and instructors', () => {
    for (const role of ['SINH_VIEN', 'GIANG_VIEN']) {
      expect(getLessonSections(role)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'discussion',
            moduleName: 'm3'
          })
        ])
      );
    }
  });

  it('shows loading, retryable error, and an empty state that encourages a first question', async () => {
    let rejectDiscussions;
    vi.spyOn(api, 'get')
      .mockReturnValueOnce(new Promise((_, reject) => {
        rejectDiscussions = reject;
      }))
      .mockResolvedValueOnce(createPage({ items: [], total: 0 }));
    const user = userEvent.setup();
    const view = renderSection();

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải thảo luận');
    await waitFor(() => expect(rejectDiscussions).toBeDefined());
    rejectDiscussions(new Error('Không tải được thảo luận.'));
    expect(await screen.findByText('Không tải được thảo luận.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có thảo luận')).toBeInTheDocument();
    expect(screen.getByText('Hãy đặt câu hỏi đầu tiên về bài học này.')).toBeInTheDocument();
    view.unmount();
  });

  it('renders thread and reply content as text, never as HTML', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createPage());
    renderSection();

    expect(await screen.findByText(/<script>alert\("xss"\)<\/script>/)).toBeInTheDocument();
    expect(screen.getByText(/Làm sao áp dụng công thức này\?/)).toBeInTheDocument();
    expect(screen.getByText('Em cũng đang thắc mắc.')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('creates a root discussion comment for the lesson', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createPage());
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      id: 23,
      lessonId: 4,
      content: 'Em có một câu hỏi.'
    });
    const user = userEvent.setup();
    renderSection();

    await user.type(
      await screen.findByLabelText(/Bình luận mới/),
      'Em có một câu hỏi.'
    );
    await user.click(screen.getByRole('button', { name: 'Gửi bình luận' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/lessons/4/comments',
      { content: 'Em có một câu hỏi.' }
    ));
  });

  it.each([401, 403, 409, 422, 429])(
    'shows the API error and preserves the comment when posting returns %i',
    async (status) => {
      vi.spyOn(api, 'get').mockResolvedValue(createPage());
      vi.spyOn(api, 'post').mockRejectedValue(new ApiError({
        status,
        message: `API error ${status}`
      }));
      const user = userEvent.setup();
      renderSection();

      const composer = await screen.findByLabelText(/Bình luận mới/);
      await user.type(composer, 'Câu hỏi cần gửi');
      await user.click(screen.getByRole('button', { name: 'Gửi bình luận' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(`API error ${status}`);
      expect(composer).toHaveValue('Câu hỏi cần gửi');
    }
  );

  it('disables comment submission while the API request is pending', async () => {
    let resolvePost;
    vi.spyOn(api, 'get').mockResolvedValue(createPage());
    const post = vi.spyOn(api, 'post').mockReturnValue(new Promise((resolve) => {
      resolvePost = resolve;
    }));
    const user = userEvent.setup();
    renderSection();

    await user.type(await screen.findByLabelText(/Bình luận mới/), 'Câu hỏi cần gửi');
    await user.click(screen.getByRole('button', { name: 'Gửi bình luận' }));

    expect(screen.getByRole('button', { name: 'Đang gửi...' })).toBeDisabled();
    expect(post).toHaveBeenCalledTimes(1);
    resolvePost({ id: 23, content: 'Câu hỏi cần gửi' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi bình luận' })).toBeEnabled());
  });

  it('replies to a root discussion using its comment id', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createPage());
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      id: 24,
      parentDiscussionId: 20,
      content: 'Cảm ơn bạn đã hỏi.'
    });
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Trả lời' }));
    const replyField = screen.getByLabelText(/Trả lời Sinh viên Một/);
    await user.type(replyField, 'Cảm ơn bạn đã hỏi.');
    await user.click(screen.getByRole('button', { name: 'Gửi trả lời' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/comments/20/replies',
      { content: 'Cảm ơn bạn đã hỏi.' }
    ));
  });

  it('paginates root discussions using the OpenAPI query names', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce(createPage({ total: 21 }))
      .mockResolvedValueOnce(createPage({ page: 2, total: 21 }));
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByText('Trang 1 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sau' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(
      '/lessons/4/comments',
      { params: { page: 2, limit: 20 } }
    ));
    expect(await screen.findByText('Trang 2 / 2')).toBeInTheDocument();
  });

  it('does not allow posting to an archived lesson', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createPage());
    renderSection({ role: 'GIANG_VIEN', isArchived: true });

    await screen.findByText(/Làm sao áp dụng công thức này\?/);
    expect(screen.queryByLabelText(/Bình luận mới/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trả lời' })).not.toBeInTheDocument();
  });
});
