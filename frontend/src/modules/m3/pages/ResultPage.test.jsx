import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { ApiError } from '../../../shared/api/ApiError.js';
import { api } from '../../../shared/api/client.js';
import { renderWithProviders } from '../../../shared/test-utils/renderWithProviders.jsx';
import { routes } from '../routes/index.jsx';
import { ResultPage } from './ResultPage.jsx';

function createResult(overrides = {}) {
  return {
    attemptId: 101,
    quizId: 55,
    quizTitle: 'Kiểm tra chương 1',
    status: 'SUBMITTED',
    startedAt: '2030-12-01T01:00:00.000Z',
    submittedAt: '2030-12-01T01:30:00.000Z',
    expiresAt: '2030-12-01T02:00:00.000Z',
    totalQuestions: 10,
    answeredCount: 9,
    visibleToStudent: true,
    maxScore: 10,
    score: 8,
    correctCount: 8,
    ...overrides
  };
}

function renderResult({ role = 'SINH_VIEN' } = {}) {
  return renderWithProviders(
    <Routes>
      <Route element={<ResultPage />} path="/attempts/:attemptId/results" />
      <Route element={<p>Phòng thi 55</p>} path="/quizzes/:quizId/take" />
      <Route element={<p>Trang không có quyền</p>} path="/forbidden" />
      <Route element={<p>Trang không tìm thấy</p>} path="*" />
    </Routes>,
    {
      auth: { user: { role } },
      route: '/attempts/101/results'
    }
  );
}

describe('ResultPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('declares the result route for students and instructors without navigation metadata', () => {
    expect(routes).toContainEqual(expect.objectContaining({
      path: '/attempts/:attemptId/results',
      roles: ['SINH_VIEN', 'GIANG_VIEN'],
      layout: 'default',
      public: false
    }));
    expect(routes.find((route) => route.path === '/attempts/:attemptId/results')).not.toHaveProperty('nav');
  });

  it('shows loading, error with retry, and empty states', async () => {
    let rejectResult;
    vi.spyOn(api, 'get')
      .mockReturnValueOnce(new Promise((_, reject) => {
        rejectResult = reject;
      }))
      .mockResolvedValueOnce(null);
    const view = renderResult();

    expect(screen.getByRole('status')).toHaveAccessibleName('Đang tải kết quả lượt thi');
    await waitFor(() => expect(rejectResult).toBeDefined());
    rejectResult(new ApiError({ status: 500, message: 'Lỗi máy chủ.' }));
    expect(await screen.findByText('Lỗi máy chủ.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có kết quả')).toBeInTheDocument();
    view.unmount();
  });

  it('loads and displays a submitted result, including score, correct count and submit time', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createResult());
    renderResult();

    expect(await screen.findByRole('heading', { name: 'Kết quả bài thi' })).toBeInTheDocument();
    expect(screen.getByText('Đã nộp')).toBeInTheDocument();
    expect(screen.getByText('Điểm')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText(/Thời điểm nộp:/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/attempts/101/result');
  });

  it('displays the auto-submitted status and explanatory label', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createResult({ status: 'AUTO_SUBMITTED' }));
    renderResult();

    expect(await screen.findByText('Tự động nộp')).toBeInTheDocument();
    expect(screen.getByText('Bài thi đã được hệ thống tự thu khi hết giờ.')).toBeInTheDocument();
  });

  it('returns an in-progress attempt to its quiz room', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createResult({ status: 'IN_PROGRESS' }));
    renderResult();

    expect(await screen.findByText('Phòng thi 55')).toBeInTheDocument();
  });

  it('hides score and correct count until the score is published', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createResult({
      visibleToStudent: false,
      score: null,
      correctCount: null
    }));
    renderResult();

    expect(await screen.findByText('Điểm sẽ được công bố sau.')).toBeInTheDocument();
    expect(screen.queryByText('Điểm')).not.toBeInTheDocument();
    expect(screen.queryByText('Số câu đúng')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('formats a visible but null score as “Chưa có”, never as zero', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createResult({
      score: null,
      correctCount: null
    }));
    renderResult();

    const scoreCard = (await screen.findByText('Điểm')).parentElement;
    expect(await within(scoreCard).findByText('Chưa có')).toBeInTheDocument();
    expect(screen.queryByText('Điểm: 0')).not.toBeInTheDocument();
  });

  it('shows the application access-denied page for a 403 response', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError({ status: 403 }));
    renderResult();

    expect(await screen.findByText('Trang không có quyền')).toBeInTheDocument();
  });

  it.each([401, 409, 422, 429])(
    'shows and retries the result API error with status %i',
    async (status) => {
      vi.spyOn(api, 'get')
        .mockRejectedValueOnce(new ApiError({
          status,
          message: `API error ${status}`
        }))
        .mockResolvedValueOnce(createResult());
      const user = userEvent.setup();
      renderResult();

      expect(await screen.findByText(`API error ${status}`)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByRole('heading', { name: 'Kết quả bài thi' })).toBeInTheDocument();
    }
  );

  it('shows the application not-found page for a 404 response', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError({ status: 404 }));
    renderResult();

    expect(await screen.findByText('Trang không tìm thấy')).toBeInTheDocument();
  });
});
