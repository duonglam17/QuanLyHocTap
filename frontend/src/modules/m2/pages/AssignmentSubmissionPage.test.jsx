import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../../shared/auth/authContext.js';
import * as submissionApi from '../api/submissions.js';
import { AssignmentSubmissionPage } from './AssignmentSubmissionPage.jsx';

vi.mock('../api/submissions.js');

const assignment = {
  id: 42,
  title: 'Báo cáo cuối kỳ',
  description: 'Nộp báo cáo theo hướng dẫn trên lớp.',
  due_date: '2026-12-12T10:00:00.000Z',
  max_score: 10,
  allow_late_submission: true,
  status: 'OPEN'
};

function renderPage() {
  return render(
    <AuthContext.Provider
      value={{
        user: { id: 8, role: 'SINH_VIEN', fullName: 'Nguyễn An' },
        status: 'authenticated',
        login: vi.fn(),
        logout: vi.fn()
      }}
    >
      <MemoryRouter initialEntries={['/assignments/42']}>
        <Routes>
          <Route element={<AssignmentSubmissionPage />} path="/assignments/:assignmentId" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('AssignmentSubmissionPage (US-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading while assignment details are being fetched', () => {
    submissionApi.getAssignment.mockReturnValue(new Promise(() => {}));
    submissionApi.getMySubmission.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows the server error and retry action when assignment details fail to load', async () => {
    submissionApi.getAssignment.mockRejectedValue(new Error('Không thể tải bài tập'));

    renderPage();

    expect(await screen.findByText('Không thể tải bài tập')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(submissionApi.getMySubmission).not.toHaveBeenCalled();
  });

  it('shows the assignment empty state when no assignment is returned', async () => {
    submissionApi.getAssignment.mockResolvedValue(null);
    submissionApi.getMySubmission.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText('Không tìm thấy bài tập')).toBeInTheDocument();
  });

  it('explains that a closed assignment does not accept late submissions', async () => {
    submissionApi.getAssignment.mockResolvedValue({
      ...assignment,
      allow_late_submission: false,
      status: 'CLOSED'
    });
    submissionApi.getMySubmission.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText(/Bài tập không cho phép nộp trễ/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Bài tập hiện không nhận bài nộp.');
    expect(screen.queryByRole('button', { name: 'Nộp bài' })).not.toBeInTheDocument();
    expect(submissionApi.submitAssignment).not.toHaveBeenCalled();
  });

  it('uploads a selected file, locks the submit button, and displays server receipt data', async () => {
    const user = userEvent.setup();
    let finishUpload;
    submissionApi.getAssignment.mockResolvedValue(assignment);
    submissionApi.getMySubmission.mockResolvedValue(null);
    submissionApi.submitAssignment.mockImplementation((_id, _file, onProgress) => {
      onProgress(45);
      return new Promise((resolve) => {
        finishUpload = resolve;
      });
    });

    renderPage();
    await screen.findByText('Báo cáo cuối kỳ');
    await screen.findByText('Chưa có bài nộp');

    const file = new File(['bài làm'], 'baocao.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/Tệp bài làm/), file);
    const submitButton = screen.getByRole('button', { name: 'Nộp bài' });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByRole('progressbar', { name: 'Tiến trình tải tệp' })).toHaveValue(45);
    await user.click(submitButton);
    expect(submissionApi.submitAssignment).toHaveBeenCalledWith(
      '42',
      file,
      expect.any(Function)
    );
    expect(submissionApi.submitAssignment).toHaveBeenCalledTimes(1);

    finishUpload({
      assignment_id: 42,
      original_filename: 'baocao.pdf',
      submitted_at: '2026-12-10T08:30:00.000Z',
      is_late: false,
      late_minutes: 0,
      submission_count: 1,
      status: 'SUBMITTED'
    });

    expect(await screen.findByText(/Thời điểm nộp:/)).toHaveTextContent('15:30 10/12/2026');
    const resubmitButton = screen.getByRole('button', { name: 'Nộp lại bài' });
    expect(resubmitButton).toBeDisabled();

    await user.upload(
      screen.getByLabelText(/Tệp bài làm/),
      new File(['bài làm mới'], 'baocao-moi.pdf', { type: 'application/pdf' })
    );
    expect(resubmitButton).toBeEnabled();
  });

  it('renders the exact server message when an upload fails', async () => {
    const user = userEvent.setup();
    submissionApi.getAssignment.mockResolvedValue(assignment);
    submissionApi.getMySubmission.mockResolvedValue(null);
    submissionApi.submitAssignment.mockRejectedValue(
      Object.assign(new Error('Tệp bài nộp không được vượt quá 20MB.'), { status: 413 })
    );

    renderPage();
    await screen.findByText('Báo cáo cuối kỳ');
    await screen.findByText('Chưa có bài nộp');
    await user.upload(
      screen.getByLabelText(/Tệp bài làm/),
      new File(['bài làm'], 'baocao.pdf', { type: 'application/pdf' })
    );
    await user.click(screen.getByRole('button', { name: 'Nộp bài' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tệp bài nộp không được vượt quá 20MB.'
    );
    expect(screen.getByRole('button', { name: 'Nộp bài' })).toBeEnabled();
  });

  it.each([
    [401, 'Phiên đăng nhập đã hết hạn.'],
    [403, 'Bạn không có quyền nộp bài tập này.'],
    [409, 'Bài tập đã được khóa.'],
    [422, 'Tệp bài làm không hợp lệ.'],
    [429, 'Bạn đã nộp quá nhiều lần.']
  ])('shows the server message for upload status %i', async (status, message) => {
    const user = userEvent.setup();
    submissionApi.getAssignment.mockResolvedValue(assignment);
    submissionApi.getMySubmission.mockResolvedValue(null);
    submissionApi.submitAssignment.mockRejectedValue(Object.assign(new Error(message), { status }));

    renderPage();
    await screen.findByText('Báo cáo cuối kỳ');
    await screen.findByText('Chưa có bài nộp');
    await user.upload(
      screen.getByLabelText(/Tệp bài làm/),
      new File(['bài làm'], 'baocao.pdf', { type: 'application/pdf' })
    );
    await user.click(screen.getByRole('button', { name: 'Nộp bài' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Nộp bài' })).toBeEnabled();
  });

  it('shows the late-submission status and server-reported lateness after upload', async () => {
    const user = userEvent.setup();
    submissionApi.getAssignment.mockResolvedValue(assignment);
    submissionApi.getMySubmission.mockResolvedValue(null);
    submissionApi.submitAssignment.mockResolvedValue({
      assignment_id: 42,
      original_filename: 'baocao-tre.pdf',
      submitted_at: '2026-12-12T10:00:00.000Z',
      is_late: true,
      late_minutes: 480,
      submission_count: 1,
      status: 'SUBMITTED_LATE'
    });

    renderPage();
    await screen.findByText('Báo cáo cuối kỳ');
    await screen.findByText('Chưa có bài nộp');
    await user.upload(
      screen.getByLabelText(/Tệp bài làm/),
      new File(['bài làm'], 'baocao-tre.pdf', { type: 'application/pdf' })
    );
    await user.click(screen.getByRole('button', { name: 'Nộp bài' }));

    expect(await screen.findByText('Nộp trễ 480 phút')).toBeInTheDocument();
    expect(screen.getByText(/Tệp: baocao-tre\.pdf/)).toBeInTheDocument();
    expect(screen.getByText('Số lần nộp: 1')).toBeInTheDocument();
  });

  it('resubmits a selected file and displays the latest server receipt', async () => {
    const user = userEvent.setup();
    submissionApi.getAssignment.mockResolvedValue(assignment);
    submissionApi.getMySubmission.mockResolvedValue({
      original_filename: 'baocao-v1.pdf',
      submitted_at: '2026-12-10T08:30:00.000Z',
      is_late: false,
      late_minutes: 0,
      submission_count: 1,
      status: 'SUBMITTED'
    });
    submissionApi.submitAssignment.mockResolvedValue({
      assignment_id: 42,
      original_filename: 'baocao-v2.pdf',
      submitted_at: '2026-12-11T08:30:00.000Z',
      is_late: false,
      late_minutes: 0,
      submission_count: 2,
      status: 'SUBMITTED'
    });

    renderPage();
    await screen.findByText(/Tệp: baocao-v1\.pdf/);
    await user.upload(
      screen.getByLabelText(/Tệp bài làm/),
      new File(['bài làm mới'], 'baocao-v2.pdf', { type: 'application/pdf' })
    );
    await user.click(screen.getByRole('button', { name: 'Nộp lại bài' }));

    expect(submissionApi.submitAssignment).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({ name: 'baocao-v2.pdf' }),
      expect.any(Function)
    );
    expect(await screen.findByText(/Tệp: baocao-v2\.pdf/)).toBeInTheDocument();
    expect(screen.getByText('Số lần nộp: 2')).toBeInTheDocument();
  });
});
