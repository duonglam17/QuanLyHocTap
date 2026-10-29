import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/ApiError.js';
import { api } from '../../../shared/api/client.js';
import { getCourseTabs } from '../../../shared/lib/slots.js';
import { renderWithProviders } from '../../../shared/test-utils/renderWithProviders.jsx';
import { QuizTab } from './QuizTab.jsx';

const course = { id: 3, status: 'PUBLISHED' };

function renderTab({ role = 'GIANG_VIEN', isOwner = true } = {}) {
  return renderWithProviders(
    <QuizTab course={course} courseId="3" isOwner={isOwner} role={role} />
  );
}

const ownerQuiz = {
  id: 11,
  courseId: 3,
  title: 'Kiểm tra giữa kỳ',
  description: 'Chương 1',
  durationMinutes: 45,
  openTime: '2030-12-01T01:00:00.000Z',
  closeTime: '2030-12-01T03:00:00.000Z',
  showScoreImmediately: true,
  status: 'DRAFT',
  questionCount: 1,
  hasAttempts: false
};

describe('QuizTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the quizzes tab through the shared course slot loader', () => {
    expect(getCourseTabs('GIANG_VIEN')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'quizzes',
          label: 'Trắc nghiệm',
          moduleName: 'm3'
        })
      ])
    );
  });

  it('shows loading, error with retry, and the empty state', async () => {
    let rejectQuizzes;
    vi.spyOn(api, 'get')
      .mockReturnValueOnce(new Promise((_, reject) => {
        rejectQuizzes = reject;
      }))
      .mockResolvedValueOnce({ items: [], page: 1, limit: 20, total: 0 });
    const user = userEvent.setup();
    const view = renderTab();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải danh sách đề thi');

    await waitFor(() => expect(rejectQuizzes).toBeDefined());
    rejectQuizzes(new Error('Không tải được đề thi.'));
    expect(await screen.findByText('Không tải được đề thi.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có đề thi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo đề đầu tiên' })).toBeInTheDocument();
    view.unmount();
  });

  it('creates a draft with one valid question and its answer key', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ id: 22, status: 'DRAFT' });
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Tạo đề thi' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Tiêu đề/), 'Đề mới');
    fireEvent.change(within(dialog).getByLabelText(/Mở đề/), {
      target: { value: '2030-12-01T08:00' }
    });
    fireEvent.change(within(dialog).getByLabelText(/Đóng đề/), {
      target: { value: '2030-12-01T10:00' }
    });
    await user.click(within(dialog).getByRole('button', { name: 'Thêm câu hỏi' }));
    await user.type(within(dialog).getByLabelText(/Nội dung câu hỏi/), 'Hai cộng hai bằng mấy?');
    await user.type(within(dialog).getByLabelText('Lựa chọn 1'), 'Bốn');
    await user.type(within(dialog).getByLabelText('Lựa chọn 2'), 'Năm');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu bản nháp' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/courses/3/quizzes',
      expect.objectContaining({
        title: 'Đề mới',
        duration_minutes: 30,
        open_time: '2030-12-01 08:00:00',
        close_time: '2030-12-01 10:00:00',
        questions: [{
          content: 'Hai cộng hai bằng mấy?',
          options: [
            { content: 'Bốn', is_correct: true },
            { content: 'Năm', is_correct: false }
          ]
        }]
      })
    ));
  });

  it.each([401, 403, 409, 422, 429])(
    'shows the API error when saving a draft returns %i',
    async (status) => {
      vi.spyOn(api, 'get').mockResolvedValue({
        items: [],
        page: 1,
        limit: 20,
        total: 0
      });
      vi.spyOn(api, 'post').mockRejectedValue(new ApiError({
        status,
        message: `API error ${status}`,
        details: status === 422
          ? [{ field: 'title', message: 'Tiêu đề không hợp lệ' }]
          : null
      }));
      const user = userEvent.setup();
      renderTab();

      await user.click(await screen.findByRole('button', { name: 'Tạo đề thi' }));
      const dialog = screen.getByRole('dialog');
      await user.type(within(dialog).getByLabelText(/Tiêu đề/), 'Đề nháp');
      fireEvent.change(within(dialog).getByLabelText(/Mở đề/), {
        target: { value: '2030-12-01T08:00' }
      });
      fireEvent.change(within(dialog).getByLabelText(/Đóng đề/), {
        target: { value: '2030-12-01T10:00' }
      });
      await user.click(within(dialog).getByRole('button', { name: 'Lưu bản nháp' }));

      await within(dialog).findByText(`API error ${status}`);
      expect(within(dialog).getAllByRole('alert').map((alert) => alert.textContent)).toContain(`API error ${status}`);
      if (status === 422) {
        expect(within(dialog).getAllByText('Tiêu đề không hợp lệ').length).toBeGreaterThan(0);
      }
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    }
  );

  it('disables draft controls while the create request is pending', async () => {
    let resolvePost;
    vi.spyOn(api, 'get').mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0
    });
    const post = vi.spyOn(api, 'post').mockReturnValue(new Promise((resolve) => {
      resolvePost = resolve;
    }));
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Tạo đề thi' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Tiêu đề/), 'Đề nháp');
    fireEvent.change(within(dialog).getByLabelText(/Mở đề/), {
      target: { value: '2030-12-01T08:00' }
    });
    fireEvent.change(within(dialog).getByLabelText(/Đóng đề/), {
      target: { value: '2030-12-01T10:00' }
    });
    await user.click(within(dialog).getByRole('button', { name: 'Lưu bản nháp' }));

    expect(within(dialog).getByRole('button', { name: 'Đang lưu...' })).toBeDisabled();
    expect(within(dialog).getByLabelText(/Tiêu đề/)).toBeDisabled();
    expect(post).toHaveBeenCalledTimes(1);
    resolvePost({ id: 22, status: 'DRAFT' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('requires at least one question before publishing and publishes a draft', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      items: [ownerQuiz],
      page: 1,
      limit: 20,
      total: 1
    });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ...ownerQuiz, status: 'PUBLISHED' });
    const user = userEvent.setup();
    renderTab();

    const publishButton = await screen.findByRole('button', { name: 'Công bố' });
    expect(publishButton).toBeEnabled();
    await user.click(publishButton);
    await waitFor(() => expect(post).toHaveBeenCalledWith('/quizzes/11/publish'));
  });

  it('disables publishing while the quiz has no questions', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      items: [{ ...ownerQuiz, questionCount: 0 }],
      page: 1,
      limit: 20,
      total: 1
    });
    renderTab();

    expect(await screen.findByRole('button', { name: 'Công bố' })).toBeDisabled();
  });

  it('edits quiz settings and replaces questions through the documented APIs', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({
        items: [{ ...ownerQuiz, status: 'PUBLISHED', questionCount: 1 }],
        page: 1,
        limit: 20,
        total: 1
      })
      .mockResolvedValueOnce({
        ...ownerQuiz,
        questions: [{
          id: 1,
          content: 'Câu cũ',
          options: [
            { id: 1, content: 'Đúng', isCorrect: true },
            { id: 2, content: 'Sai', isCorrect: false }
          ]
        }]
      })
      .mockResolvedValue({
        items: [{ ...ownerQuiz, title: 'Đề đã sửa' }],
        page: 1,
        limit: 20,
        total: 1
      });
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ ...ownerQuiz, title: 'Đề đã sửa' });
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ...ownerQuiz, title: 'Đề đã sửa' });
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Sửa' }));
    const dialog = await screen.findByRole('dialog');
    const title = await within(dialog).findByLabelText(/Tiêu đề/);
    await user.clear(title);
    await user.type(title, 'Đề đã sửa');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith(
      '/quizzes/11',
      expect.objectContaining({ title: 'Đề đã sửa' })
    ));
    expect(put).toHaveBeenCalledWith('/quizzes/11/questions', {
      questions: [{
        content: 'Câu cũ',
        options: [
          { content: 'Đúng', is_correct: true },
          { content: 'Sai', is_correct: false }
        ]
      }]
    });
  });

  it('shows the EC-07 lock and does not offer editing after attempts exist', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      items: [{ ...ownerQuiz, hasAttempts: true }],
      page: 1,
      limit: 20,
      total: 1
    });
    renderTab();

    expect(await screen.findByText(/máy chủ khóa chỉnh sửa \(EC-07\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa' })).toBeDisabled();
  });

  it('shows student attempt status and enables entry only when the server allows it', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      items: [{
        id: 12,
        courseId: 3,
        title: 'Đề đã công bố',
        description: null,
        durationMinutes: 30,
        openTime: '2030-12-01T01:00:00.000Z',
        closeTime: '2030-12-01T03:00:00.000Z',
        status: 'PUBLISHED',
        attemptId: null,
        attemptStatus: 'NOT_STARTED',
        canStart: true,
        visibleToStudent: false
      }],
      page: 1,
      limit: 20,
      total: 1
    });
    renderTab({ role: 'SINH_VIEN', isOwner: false });

    expect(await screen.findByText('Đề đã công bố')).toBeInTheDocument();
    expect(screen.getByText('Chưa làm')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vào thi' })).toHaveAttribute(
      'href',
      '/quizzes/12/take'
    );
    expect(screen.getByText('Điểm sẽ được công bố sau.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo đề thi' })).not.toBeInTheDocument();
  });

  it('allows an in-progress student to resume even though canStart is false', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      items: [{
        id: 13,
        courseId: 3,
        title: 'Đề đang làm',
        description: null,
        durationMinutes: 30,
        openTime: '2030-12-01T01:00:00.000Z',
        closeTime: '2030-12-01T03:00:00.000Z',
        status: 'PUBLISHED',
        attemptId: 130,
        attemptStatus: 'IN_PROGRESS',
        canStart: false,
        visibleToStudent: false
      }],
      page: 1,
      limit: 20,
      total: 1
    });
    renderTab({ role: 'SINH_VIEN', isOwner: false });

    expect(await screen.findByRole('link', { name: 'Tiếp tục làm bài' })).toHaveAttribute(
      'href',
      '/quizzes/13/take'
    );
  });

  it('links a submitted student attempt to its result using attemptId', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      items: [{
        id: 14,
        courseId: 3,
        title: 'Đề đã nộp',
        description: null,
        durationMinutes: 30,
        openTime: '2030-12-01T01:00:00.000Z',
        closeTime: '2030-12-01T03:00:00.000Z',
        status: 'PUBLISHED',
        attemptId: 140,
        attemptStatus: 'SUBMITTED',
        canStart: false,
        visibleToStudent: true,
        score: 8
      }],
      page: 1,
      limit: 20,
      total: 1
    });
    renderTab({ role: 'SINH_VIEN', isOwner: false });

    expect(await screen.findByRole('link', { name: 'Xem kết quả' })).toHaveAttribute(
      'href',
      '/attempts/140/results'
    );
  });

  it('links an auto-submitted student attempt to its result using attemptId', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      items: [{
        id: 15,
        courseId: 3,
        title: 'Đề tự thu',
        description: null,
        durationMinutes: 30,
        openTime: '2030-12-01T01:00:00.000Z',
        closeTime: '2030-12-01T03:00:00.000Z',
        status: 'CLOSED',
        attemptId: 150,
        attemptStatus: 'AUTO_SUBMITTED',
        canStart: false,
        visibleToStudent: true,
        score: 7
      }],
      page: 1,
      limit: 20,
      total: 1
    });
    renderTab({ role: 'SINH_VIEN', isOwner: false });

    expect(await screen.findByRole('link', { name: 'Xem kết quả' })).toHaveAttribute(
      'href',
      '/attempts/150/results'
    );
  });
});
