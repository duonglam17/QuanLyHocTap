import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../shared/test-utils/index.js';
import { listNotifications, markNotificationRead } from '../api/notifications.js';
import { NotificationsPage } from './NotificationsPage.jsx';

vi.mock('../api/notifications.js', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn()
}));

const notification = {
  id: 13,
  title: 'Thông báo kiểm tra',
  message: 'Lịch kiểm tra đã được cập nhật.',
  type: 'ANNOUNCEMENT',
  link: '/courses/4',
  isRead: false,
  createdAt: '2026-10-25T05:00:00.000Z'
};

function CurrentPath() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the loading state', () => {
    listNotifications.mockReturnValue(new Promise(() => {}));

    renderWithProviders(
      <>
        <NotificationsPage />
        <CurrentPath />
      </>
    );

    expect(screen.getByLabelText('Đang tải thông báo')).toBeInTheDocument();
  });

  it('shows the API error and supports retry', async () => {
    listNotifications
      .mockRejectedValueOnce(new Error('Không thể tải danh sách'))
      .mockResolvedValueOnce({ items: [], page: 1, limit: 20, total: 0 });

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <NotificationsPage />
        <CurrentPath />
      </>
    );

    expect(await screen.findByText('Không thể tải danh sách')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có thông báo')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    listNotifications.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });

    renderWithProviders(<NotificationsPage />);

    expect(await screen.findByText('Chưa có thông báo')).toBeInTheDocument();
  });

  it('marks notifications read, navigates to their link, and paginates', async () => {
    listNotifications.mockImplementation(({ page }) => Promise.resolve({
      items: page === 1 ? [notification] : [{ ...notification, id: 14, title: 'Trang hai' }],
      page,
      limit: 20,
      total: 40
    }));
    markNotificationRead.mockResolvedValue({ id: 13, isRead: true });

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <NotificationsPage />
        <CurrentPath />
      </>
    );
    expect(await screen.findByText('Thông báo kiểm tra')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith(13));
    await user.click(screen.getByRole('link', { name: 'Mở thông báo' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/courses/4');

    await user.click(screen.getByRole('button', { name: 'Sau' }));
    expect(await screen.findByText('Trang hai')).toBeInTheDocument();
    expect(listNotifications).toHaveBeenCalledWith({ page: 2, limit: 20 });
  });
});
