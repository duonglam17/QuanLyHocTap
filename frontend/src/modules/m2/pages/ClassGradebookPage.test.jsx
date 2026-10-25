import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as gradebookApi from '../api/classGradebook.js';
import { ClassGradebookPage } from './ClassGradebookPage.jsx';

vi.mock('../api/classGradebook.js', () => ({
  downloadClassGradebook: vi.fn(),
  getClassGradebook: vi.fn()
}));

const assignments = [{ id: 2, title: 'Bài tập 1', max_score: 10 }];
const quizzes = [{ id: 7, title: 'Quiz 1' }];

function pageResponse({
  data = [
    {
      student_id: 23,
      student_number: 'SV0023',
      full_name: 'Nguyễn An',
      assignments: { 2: null },
      quizzes: { 7: 8.5 }
    }
  ],
  page = 1,
  totalPages = 1
} = {}) {
  return {
    success: true,
    data,
    assignments,
    quizzes,
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
    <MemoryRouter initialEntries={['/courses/3/grades']}>
      <Routes>
        <Route element={<ClassGradebookPage />} path="/courses/:courseId/grades" />
      </Routes>
    </MemoryRouter>
  );
}

describe('ClassGradebookPage (US-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading while the gradebook is being fetched', () => {
    gradebookApi.getClassGradebook.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải bảng điểm lớp');
  });

  it('shows the server error with a retry action', async () => {
    gradebookApi.getClassGradebook
      .mockRejectedValueOnce(new Error('Không thể tải bảng điểm lớp.'))
      .mockResolvedValueOnce(pageResponse());

    renderPage();

    expect(await screen.findByText('Không thể tải bảng điểm lớp.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Nguyễn An')).toBeInTheDocument();
  });

  it('shows an empty state when there are no enrolled students', async () => {
    gradebookApi.getClassGradebook.mockResolvedValue(pageResponse({ data: [] }));

    renderPage();

    expect(await screen.findByText('Chưa có sinh viên trong bảng điểm')).toBeInTheDocument();
  });

  it('renders assignment and quiz score columns and keeps null scores as "Chưa có"', async () => {
    gradebookApi.getClassGradebook.mockResolvedValue(pageResponse());

    renderPage();

    const row = await screen.findByRole('row', { name: /SV0023/ });
    expect(screen.getByRole('columnheader', { name: /Bài tập 1/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Quiz 1' })).toBeInTheDocument();
    expect(within(row).getByText('Nguyễn An')).toBeInTheDocument();
    expect(within(row).getByText('Chưa có')).toBeInTheDocument();
    expect(within(row).getByText('8,5')).toBeInTheDocument();
  });

  it('paginates using 20 students per page', async () => {
    gradebookApi.getClassGradebook
      .mockResolvedValueOnce(pageResponse({ page: 1, totalPages: 3 }))
      .mockResolvedValueOnce(pageResponse({ page: 2, totalPages: 3 }));

    renderPage();

    expect(await screen.findByText('Trang 1 / 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sau' }));

    await waitFor(() => {
      expect(gradebookApi.getClassGradebook).toHaveBeenLastCalledWith('3', 2);
    });
    expect(await screen.findByText('Trang 2 / 3')).toBeInTheDocument();
  });

  it('exports CSV and disables the button while the file is being created', async () => {
    let completeExport;
    gradebookApi.getClassGradebook.mockResolvedValue(pageResponse());
    gradebookApi.downloadClassGradebook.mockReturnValue(
      new Promise((resolve) => {
        completeExport = resolve;
      })
    );

    renderPage();

    const exportButton = await screen.findByRole('button', { name: 'Xuất CSV' });
    await userEvent.click(exportButton);

    expect(gradebookApi.downloadClassGradebook).toHaveBeenCalledWith('3');
    expect(screen.getByRole('button', { name: 'Đang tạo tệp...' })).toBeDisabled();
    completeExport();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Xuất CSV' })).toBeEnabled();
    });
  });

  it('shows the server error when CSV export fails', async () => {
    gradebookApi.getClassGradebook.mockResolvedValue(pageResponse());
    gradebookApi.downloadClassGradebook.mockRejectedValue(new Error('Không thể tạo tệp CSV.'));

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Xuất CSV' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tạo tệp CSV.');
    expect(screen.getByRole('button', { name: 'Xuất CSV' })).toBeEnabled();
  });
});
