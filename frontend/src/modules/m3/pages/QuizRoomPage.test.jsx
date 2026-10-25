import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { api } from '../../../shared/api/client.js';
import { renderWithProviders } from '../../../shared/test-utils/renderWithProviders.jsx';
import { routes } from '../routes/index.jsx';
import { QuizRoomPage } from './QuizRoomPage.jsx';

const instanceId = 'tab-instance-1';

function createSession(overrides = {}) {
  return {
    attemptId: 101,
    clientInstanceId: instanceId,
    sessionToken: 'session-token-1',
    startedAt: '2030-12-01T01:00:00.000Z',
    expiresAt: '2030-12-01T02:00:00.000Z',
    remaining_seconds: 3600,
    questions: [{
      id: 201,
      content: 'Hai cộng hai bằng mấy?',
      orderIndex: 1,
      is_correct: true,
      options: [
        { id: 301, content: 'Bốn', orderIndex: 1, isCorrect: true },
        { id: 302, content: 'Năm', orderIndex: 2, isCorrect: false }
      ]
    }],
    savedAnswers: [],
    ...overrides
  };
}

function renderRoom() {
  return renderWithProviders(
    <Routes>
      <Route element={<QuizRoomPage />} path="/quizzes/:quizId/take" />
    </Routes>,
    { route: '/quizzes/55/take', auth: { user: { role: 'SINH_VIEN' } } }
  );
}

describe('QuizRoomPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal('crypto', { ...window.crypto, randomUUID: vi.fn(() => instanceId) });
    vi.spyOn(api, 'post').mockImplementation((path) => {
      if (path.endsWith('/start')) return Promise.resolve(createSession());
      return Promise.resolve({
        attemptId: 101,
        status: 'SUBMITTED',
        submittedAt: '2030-12-01T01:30:00.000Z',
        score: 8,
        visibleToStudent: true
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('declares the student-only bare route for the quiz room', () => {
    expect(routes).toContainEqual(expect.objectContaining({
      path: '/quizzes/:quizId/take',
      roles: ['SINH_VIEN'],
      layout: 'bare',
      public: false
    }));
  });

  it('shows an empty state when the server returns an attempt without questions', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(createSession({ questions: [] }));
    renderRoom();

    expect(await screen.findByText('Đề thi chưa có câu hỏi')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('shows start errors and retries with the same tab identity', async () => {
    vi.mocked(api.post)
      .mockRejectedValueOnce(new Error('Đề thi chưa mở.'))
      .mockResolvedValueOnce(createSession());
    const user = userEvent.setup();
    renderRoom();

    expect(await screen.findByText('Đề thi chưa mở.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('group', { name: /Hai cộng hai bằng mấy/ })).toBeInTheDocument();
    expect(api.post).toHaveBeenNthCalledWith(2, '/quizzes/55/start', {
      clientInstanceId: instanceId,
      takeOver: false
    });
  });

  it('starts with a tab-scoped id, keeps it in sessionStorage, and never renders answer keys', async () => {
    const post = vi.mocked(api.post);
    const firstView = renderRoom();

    expect(await screen.findByRole('group', { name: /Hai cộng hai bằng mấy/ })).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/quizzes/55/start', {
      clientInstanceId: instanceId,
      takeOver: false
    });
    expect(window.sessionStorage.getItem('m3.quiz.clientInstanceId.55')).toBe(instanceId);
    expect(window.localStorage.getItem('m3.quiz.clientInstanceId.55')).toBeNull();
    expect(document.body.textContent).not.toMatch(/is_correct|isCorrect|correct/i);
    firstView.unmount();

    post.mockClear();
    post.mockResolvedValueOnce(createSession({
      savedAnswers: [{ questionId: 201, optionId: 302 }]
    }));
    renderRoom();

    expect(await screen.findByLabelText('Năm')).toBeChecked();
    expect(post).toHaveBeenCalledWith('/quizzes/55/start', {
      clientInstanceId: instanceId,
      takeOver: false
    });
  });

  it('asks before taking over another tab and sends takeOver only after confirmation', async () => {
    const conflict = Object.assign(new Error('Lượt thi đang hoạt động ở một cửa sổ khác.'), {
      code: 'SESSION_ACTIVE_ELSEWHERE',
      status: 409
    });
    vi.mocked(api.post)
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(createSession());
    const user = userEvent.setup();
    renderRoom();

    expect(await screen.findByText('Bài thi đang mở ở nơi khác, chuyển sang tab này?')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Chuyển sang tab này' }));

    expect(await screen.findByRole('group', { name: /Hai cộng hai bằng mấy/ })).toBeInTheDocument();
    expect(api.post).toHaveBeenNthCalledWith(2, '/quizzes/55/start', {
      clientInstanceId: instanceId,
      takeOver: true
    });
  });

  it('saves answers sequentially and shows an explicit replaced-session lock', async () => {
    vi.spyOn(api, 'patch').mockRejectedValueOnce(Object.assign(
      new Error('Phiên làm bài này đã được thay thế.'),
      { code: 'SESSION_REPLACED', status: 409 }
    ));
    const user = userEvent.setup();
    renderRoom();
    await user.click(await screen.findByLabelText('Bốn'));

    expect(await screen.findByText('Phiên làm bài này đã được thay thế.')).toBeInTheDocument();
    expect(screen.getByLabelText('Bốn')).toBeDisabled();
    expect(api.patch).toHaveBeenCalledWith('/attempts/101/save-answer', {
      questionId: 201,
      optionId: 301,
      clientInstanceId: instanceId,
      sessionToken: 'session-token-1'
    });
  });

  it('keeps a queued answer offline and saves it when the browser reconnects', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({
      saved: true,
      remaining_seconds: 3500
    });
    const user = userEvent.setup();
    renderRoom();
    await screen.findByRole('group', { name: /Hai cộng hai bằng mấy/ });
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    fireEvent(window, new Event('offline'));
    await user.click(screen.getByLabelText('Năm'));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });

    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByText(/Mất kết nối/)).toBeInTheDocument();

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith('/attempts/101/save-answer', {
      questionId: 201,
      optionId: 302,
      clientInstanceId: instanceId,
      sessionToken: 'session-token-1'
    });
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
    expect(screen.getByLabelText('Thời gian còn lại')).toHaveTextContent('58:20');
  });

  it('automatically submits when the server-synchronized countdown reaches zero', async () => {
    vi.useFakeTimers();
    let monotonicNow = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow);
    vi.mocked(api.post).mockImplementation((path) => {
      if (path.endsWith('/start')) {
        return Promise.resolve(createSession({ remaining_seconds: 2 }));
      }
      return Promise.resolve({
        attemptId: 101,
        status: 'AUTO_SUBMITTED',
        submittedAt: '2030-12-01T01:30:00.000Z',
        score: null,
        visibleToStudent: false
      });
    });

    renderRoom();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      monotonicNow = 2500;
      await vi.advanceTimersByTimeAsync(250);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Đã nộp bài thi')).toBeInTheDocument();
    expect(screen.getByText('Điểm sẽ được công bố sau.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/attempts/101/submit', {
      clientInstanceId: instanceId,
      sessionToken: 'session-token-1'
    });
  });

  it('confirms submission, reports unanswered questions, and prevents duplicate submits', async () => {
    let resolveSubmission;
    vi.mocked(api.post).mockImplementation((path) => {
      if (path.endsWith('/start')) return Promise.resolve(createSession());
      return new Promise((resolve) => {
        resolveSubmission = resolve;
      });
    });
    const user = userEvent.setup();
    renderRoom();
    await screen.findByRole('group', { name: /Hai cộng hai bằng mấy/ });
    await user.click(screen.getByRole('button', { name: 'Nộp bài' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/còn 1 câu chưa làm/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Nộp bài' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Nộp bài' })).toBeDisabled();
    await act(async () => {
      resolveSubmission({
        attemptId: 101,
        status: 'SUBMITTED',
        submittedAt: '2030-12-01T01:30:00.000Z',
        score: 8,
        visibleToStudent: true
      });
    });
    expect(await screen.findByText('Điểm: 8')).toBeInTheDocument();
  });

  it('renders an idempotent prior submission result without revealing a hidden score', async () => {
    vi.mocked(api.post).mockImplementation((path) => {
      if (path.endsWith('/start')) return Promise.resolve(createSession());
      return Promise.resolve({
        attemptId: 101,
        status: 'SUBMITTED',
        submittedAt: '2030-12-01T01:15:00.000Z',
        score: null,
        visibleToStudent: false
      });
    });
    const user = userEvent.setup();
    renderRoom();

    await screen.findByRole('group', { name: /Hai cộng hai bằng mấy/ });
    await user.click(screen.getByRole('button', { name: 'Nộp bài' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Nộp bài' }));

    expect(await screen.findByText('Đã nộp bài thi')).toBeInTheDocument();
    expect(screen.getByText('Điểm sẽ được công bố sau.')).toBeInTheDocument();
    expect(screen.queryByText(/Điểm:/)).not.toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/attempts/101/submit', {
      clientInstanceId: instanceId,
      sessionToken: 'session-token-1'
    });
  });
});
