import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api/client.js';
import { mockAuth, renderWithProviders } from '../../../shared/test-utils/renderWithProviders.jsx';
import { CourseAssignmentsPage } from './CourseAssignmentsPage.jsx';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route element={<CourseAssignmentsPage />} path="/courses/:courseId/assignments" />
    </Routes>,
    { auth: mockAuth('GIANG_VIEN', { user: { id: 8, role: 'GIANG_VIEN' } }), route: '/courses/3/assignments' }
  );
}

describe('CourseAssignmentsPage', () => {
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

  it('shows loading while the course is loading', () => {
    vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải khóa học');
  });

  it('shows the course API error', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('Không tải được khóa học.'));

    renderPage();

    expect(await screen.findByText('Không tải được khóa học.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it.each([
    [401, 'Phiên đăng nhập đã hết hạn.'],
    [403, 'Bạn không có quyền xem khóa học này.']
  ])('shows the exact course API message for status %i', async (status, message) => {
    vi.spyOn(api, 'get').mockRejectedValue(Object.assign(new Error(message), { status }));

    renderPage();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('shows an empty state when the course is unavailable', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ course: null });

    renderPage();

    expect(await screen.findByText('Không tìm thấy khóa học')).toBeInTheDocument();
  });

  it('lets the course owner open the create assignment form', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({
        course: { id: 3, ownerId: 8, status: 'PUBLISHED' }
      })
      .mockResolvedValue({ data: [] });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Tạo bài tập' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByLabelText(/Tiêu đề/)).toBeInTheDocument();
  });
});
