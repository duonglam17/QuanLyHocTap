import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/ApiError.js';
import { api } from '../../../shared/api/client.js';
import { getCourseTabs } from '../../../shared/lib/slots.js';
import { renderWithProviders } from '../../../shared/test-utils/renderWithProviders.jsx';
import { AnnouncementTab } from './AnnouncementTab.jsx';

const announcements = [{
  id: 71,
  courseId: 3,
  authorId: 9,
  title: 'Lịch học tuần này',
  content: '<script>alert("not html")</script>\nNội dung thông báo',
  createdAt: '2030-12-01T01:00:00.000Z',
  updatedAt: '2030-12-01T01:00:00.000Z'
}];

function createPage(overrides = {}) {
  return {
    items: announcements,
    page: 1,
    limit: 20,
    total: 1,
    ...overrides
  };
}

function renderTab({ role = 'SINH_VIEN', isOwner = false } = {}) {
  return renderWithProviders(
    <AnnouncementTab courseId="3" isOwner={isOwner} role={role} />
  );
}

describe('AnnouncementTab', () => {
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

  it('registers the announcements tab for course members and admins', () => {
    for (const role of ['SINH_VIEN', 'GIANG_VIEN', 'ADMIN']) {
      expect(getCourseTabs(role)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'announcements',
            label: 'Thông báo khóa học',
            moduleName: 'm3'
          })
        ])
      );
    }
  });

  it('shows loading, retryable error, and an empty state', async () => {
    let rejectAnnouncements;
    vi.spyOn(api, 'get')
      .mockReturnValueOnce(new Promise((_, reject) => {
        rejectAnnouncements = reject;
      }))
      .mockResolvedValueOnce(createPage({ items: [], total: 0 }));
    const user = userEvent.setup();
    const view = renderTab({ role: 'GIANG_VIEN', isOwner: true });

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải thông báo khóa học');
    await waitFor(() => expect(rejectAnnouncements).toBeDefined());
    rejectAnnouncements(new Error('Không tải được thông báo.'));
    expect(await screen.findByText('Không tải được thông báo.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có thông báo khóa học')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo thông báo đầu tiên' })).toBeInTheDocument();
    view.unmount();
  });

  it('shows announcements as text to members without management actions', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createPage());
    renderTab();

    expect(await screen.findByRole('heading', { name: 'Lịch học tuần này' })).toBeInTheDocument();
    expect(screen.getByText(/<script>alert\("not html"\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạo thông báo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa Lịch học tuần này' })).not.toBeInTheDocument();
  });

  it('paginates announcements using the contract page and limit parameters', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce(createPage({ total: 21 }))
      .mockResolvedValueOnce(createPage({ page: 2, total: 21 }));
    const user = userEvent.setup();
    renderTab();

    expect(await screen.findByText('Trang 1 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sau' }));

    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(
      '/courses/3/announcements',
      { params: { page: 2, limit: 20 } }
    ));
    expect(await screen.findByText('Trang 2 / 2')).toBeInTheDocument();
  });

  it('creates an announcement for a course owner', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createPage({ items: [], total: 0 }));
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      id: 72,
      courseId: 3,
      authorId: 9,
      title: 'Thông báo mới',
      content: 'Nội dung mới',
      createdAt: '2030-12-01T01:00:00.000Z',
      updatedAt: '2030-12-01T01:00:00.000Z'
    });
    const user = userEvent.setup();
    renderTab({ role: 'GIANG_VIEN', isOwner: true });

    await user.click(await screen.findByRole('button', { name: 'Tạo thông báo' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Tiêu đề/), 'Thông báo mới');
    await user.type(within(dialog).getByLabelText(/Nội dung/), 'Nội dung mới');
    await user.click(within(dialog).getByRole('button', { name: 'Đăng thông báo' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/courses/3/announcements',
      { title: 'Thông báo mới', content: 'Nội dung mới' }
    ));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each([401, 403, 409, 422, 429])(
    'shows the API error when creating an announcement returns %i',
    async (status) => {
      vi.spyOn(api, 'get').mockResolvedValue(createPage({ items: [], total: 0 }));
      vi.spyOn(api, 'post').mockRejectedValue(new ApiError({
        status,
        message: `API error ${status}`
      }));
      const user = userEvent.setup();
      renderTab({ role: 'GIANG_VIEN', isOwner: true });

      await user.click(await screen.findByRole('button', { name: 'Tạo thông báo' }));
      const dialog = screen.getByRole('dialog');
      await user.type(within(dialog).getByLabelText(/Tiêu đề/), 'Thông báo mới');
      await user.type(within(dialog).getByLabelText(/Nội dung/), 'Nội dung mới');
      await user.click(within(dialog).getByRole('button', { name: 'Đăng thông báo' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(`API error ${status}`);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    }
  );

  it('disables announcement submission while the API request is pending', async () => {
    let resolvePost;
    vi.spyOn(api, 'get').mockResolvedValue(createPage({ items: [], total: 0 }));
    const post = vi.spyOn(api, 'post').mockReturnValue(new Promise((resolve) => {
      resolvePost = resolve;
    }));
    const user = userEvent.setup();
    renderTab({ role: 'GIANG_VIEN', isOwner: true });

    await user.click(await screen.findByRole('button', { name: 'Tạo thông báo' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Tiêu đề/), 'Thông báo mới');
    await user.type(within(dialog).getByLabelText(/Nội dung/), 'Nội dung mới');
    await user.click(within(dialog).getByRole('button', { name: 'Đăng thông báo' }));

    const pendingButton = within(dialog).getByRole('button', { name: 'Đang đăng...' });
    expect(pendingButton).toBeDisabled();
    expect(post).toHaveBeenCalledTimes(1);
    resolvePost({ id: 72, title: 'Thông báo mới', content: 'Nội dung mới' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('deletes an announcement only after confirmation for an admin', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(createPage());
    const remove = vi.spyOn(api, 'delete').mockResolvedValue({ id: 71, deleted: true });
    const user = userEvent.setup();
    renderTab({ role: 'ADMIN' });

    await user.click(await screen.findByRole('button', { name: 'Xóa Lịch học tuần này' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Bạn có chắc muốn xóa thông báo/)).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Xóa thông báo' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('/announcements/71'));
  });
});
