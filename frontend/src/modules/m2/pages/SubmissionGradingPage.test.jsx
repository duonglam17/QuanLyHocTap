import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../../shared/auth/authContext.js';
import * as gradingApi from '../api/grading.js';
import { SubmissionGradingPage } from './SubmissionGradingPage.jsx';

vi.mock('../api/grading.js');

const submission = {
  id: 12,
  assignment_id: 4,
  assignment_title: 'Bài tập tuần 4',
  student_id: 5,
  student_name: 'Nguyễn An',
  original_filename: 'baocao.pdf',
  submitted_at: '2026-10-24T08:00:00.000Z',
  submission_count: 1,
  status: 'SUBMITTED',
  score: null,
  feedback: null
};

function response(data = [submission], page = 1, totalPages = 1) {
  return {
    success: true,
    data,
    pagination: {
      page,
      page_size: 20,
      total: data.length,
      total_pages: totalPages
    }
  };
}

function renderPage() {
  return render(
    <AuthContext.Provider
      value={{
        user: { id: 3, role: 'GIANG_VIEN', fullName: 'Cô Mai' },
        status: 'authenticated',
        login: vi.fn(),
        logout: vi.fn()
      }}
    >
      <MemoryRouter initialEntries={['/courses/9/assignments/grading']}>
        <Routes>
          <Route element={<SubmissionGradingPage />} path="/courses/:courseId/assignments/grading" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('SubmissionGradingPage (US-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading while the submission list is being fetched', () => {
    gradingApi.listCourseSubmissions.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows the server authorization error and retry action', async () => {
    gradingApi.listCourseSubmissions.mockRejectedValue(
      Object.assign(new Error('Chỉ chủ khóa học mới có quyền truy cập bài nộp và chấm điểm.'), {
        status: 403
      })
    );

    renderPage();

    expect(await screen.findByText('Chỉ chủ khóa học mới có quyền truy cập bài nộp và chấm điểm.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('shows an actionable empty state when there are no submissions', async () => {
    gradingApi.listCourseSubmissions.mockResolvedValue(response([]));

    renderPage();

    expect(await screen.findByText('Chưa có bài nộp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quay lại bài tập' })).toBeInTheDocument();
  });

  it('validates score increments in the form and saves a grade', async () => {
    let isGraded = false;
    gradingApi.listCourseSubmissions.mockImplementation(async () => response([{
      ...submission,
      status: isGraded ? 'GRADED' : 'SUBMITTED',
      score: isGraded ? 8.25 : null,
      feedback: isGraded ? 'Bài làm tốt.' : null
    }]));
    gradingApi.gradeSubmission.mockImplementation(async (id, values) => {
      isGraded = true;
      return {
        success: true,
        data: { id: 21, submission_id: id, score: values.score, feedback: values.feedback }
      };
    });

    renderPage();

    expect(await screen.findAllByText('Bài tập tuần 4')).toHaveLength(2);
    const form = screen.getByRole('form', { name: 'Biểu mẫu chấm điểm' });
    const scoreInput = within(form).getByLabelText(/^Điểm/);
    fireEvent.change(scoreInput, { target: { value: '8.1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu điểm' }));
    expect(await screen.findByText('Điểm phải từ 0 đến 10 và theo bước 0.25.')).toBeInTheDocument();
    expect(gradingApi.gradeSubmission).not.toHaveBeenCalled();

    fireEvent.change(scoreInput, { target: { value: '8.25' } });
    fireEvent.change(within(form).getByLabelText('Nhận xét'), {
      target: { value: 'Bài làm tốt.' }
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu điểm' }));

    expect(gradingApi.gradeSubmission).toHaveBeenCalledWith(12, {
      score: 8.25,
      feedback: 'Bài làm tốt.'
    });
    expect(await screen.findAllByText('Đã chấm')).toHaveLength(2);
  });

  it('downloads the selected submission through the authenticated API helper', async () => {
    const user = userEvent.setup();
    gradingApi.listCourseSubmissions.mockResolvedValue(response());
    gradingApi.downloadSubmission.mockResolvedValue({ filename: 'baocao.pdf' });

    renderPage();

    await screen.findAllByText('Bài tập tuần 4');
    await user.click(screen.getByRole('button', { name: 'Tải tệp bài nộp' }));

    expect(gradingApi.downloadSubmission).toHaveBeenCalledWith(12);
  });

  it('moves to the next submission across pages', async () => {
    const user = userEvent.setup();
    gradingApi.listCourseSubmissions.mockImplementation(async (_courseId, page) => (
      page === 1
        ? response([submission], 1, 2)
        : response([{ ...submission, id: 13, student_name: 'Trần Bình' }], 2, 2)
    ));

    renderPage();

    await screen.findAllByText('Nguyễn An');
    await user.click(screen.getByRole('button', { name: 'Bài tiếp' }));

    expect(await screen.findAllByText('Trần Bình')).toHaveLength(2);
    expect(gradingApi.listCourseSubmissions).toHaveBeenLastCalledWith('9', 2, 20);
  });
});
