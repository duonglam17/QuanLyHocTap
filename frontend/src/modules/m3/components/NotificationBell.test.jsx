import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../shared/test-utils/index.js';
import { NotificationBell } from './NotificationBell.jsx';
import { listNotifications, markNotificationRead } from '../api/notifications.js';

vi.mock('../api/notifications.js', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn()
}));

const notification = {
  id: 7,
  title: 'Bài tập mới',
  message: 'Có bài tập mới trong khóa học.',
  type: 'NEW_ASSIGNMENT',
  link: '/courses/12',
  isRead: false,
  createdAt: '2026-10-25T05:00:00.000Z'
};

function CurrentPath() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading and empty states', async () => {
    let resolveNotifications;
    listNotifications.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNotifications = resolve;
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await user.click(screen.getByRole('button', { name: /Thông báo/ }));
    expect(screen.getByLabelText('Đang tải thông báo')).toBeInTheDocument();

    await act(async () => {
      resolveNotifications({ items: [], page: 1, limit: 100, total: 0 });
    });
    expect(await screen.findByText('Chưa có thông báo.')).toBeInTheDocument();
  });

  it('shows the server error and retries', async () => {
    listNotifications
      .mockRejectedValueOnce(new Error('Lỗi máy chủ'))
      .mockResolvedValueOnce({ items: [], page: 1, limit: 100, total: 0 });

    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await user.click(screen.getByRole('button', { name: /Thông báo/ }));

    expect(await screen.findByText('Lỗi máy chủ')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có thông báo.')).toBeInTheDocument();
  });

  it('counts unread notifications, marks one as read, and navigates to its safe link', async () => {
    listNotifications.mockResolvedValue({ items: [notification], page: 1, limit: 100, total: 1 });
    markNotificationRead.mockResolvedValue({ id: 7, isRead: true });

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <NotificationBell />
        <CurrentPath />
      </>
    );
    const bell = await screen.findByRole('button', { name: /1 chưa đọc/ });
    await user.click(bell);
    await user.click(await screen.findByText('Bài tập mới'));

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/courses/12'));
  });

  it('refreshes periodically only while the page is visible', async () => {
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    vi.useFakeTimers();
    listNotifications.mockResolvedValue({ items: [], page: 1, limit: 100, total: 0 });
    renderWithProviders(<NotificationBell />);
    await act(async () => Promise.resolve());
    const initialCalls = listNotifications.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(listNotifications).toHaveBeenCalledTimes(initialCalls + 1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(listNotifications).toHaveBeenCalledTimes(initialCalls + 1);

    vi.useRealTimers();
    if (visibilityDescriptor) {
      Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
    } else {
      delete document.visibilityState;
    }
  });
});
