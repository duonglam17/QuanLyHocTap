import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api/client.js';
import { renderWithProviders } from '../../../shared/test-utils/renderWithProviders.jsx';
import { AssignmentTab } from './AssignmentTab.jsx';

const course = { id: 3, ownerId: 8, status: 'PUBLISHED' };

function renderTab({ role = 'GIANG_VIEN', isOwner = true } = {}) {
  return renderWithProviders(
    <AssignmentTab course={course} courseId="3" isOwner={isOwner} role={role} />
  );
}

describe('AssignmentTab', () => {
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

  it('renders loading while the course assignments are being fetched', () => {
    vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {}));

    renderTab();

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải danh sách bài tập');
  });

  it('shows the server error and retries the list request', async () => {
    vi.spyOn(api, 'get')
      .mockRejectedValueOnce(new Error('Không tải được bài tập.'))
      .mockResolvedValueOnce({ data: [] });

    renderTab();

    expect(await screen.findByText('Không tải được bài tập.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có bài tập')).toBeInTheDocument();
  });

  it('shows an empty state with a suggested create action for the course owner', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [] });

    renderTab();

    expect(await screen.findByText('Tạo bài tập đầu tiên để sinh viên bắt đầu làm bài.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo bài tập đầu tiên' })).toBeInTheDocument();
  });

  it('creates an assignment and refreshes the list after the primary action', async () => {
    const assignment = {
      id: 11,
      title: 'Bài tập mới',
      description: 'Mô tả bài tập',
      due_date: '2030-12-01T16:59:00.000Z',
      max_score: 10,
      allow_late_submission: false,
      status: 'OPEN'
    };
    const get = vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValue({ data: [assignment] });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: assignment });
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Tạo bài tập' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Tiêu đề/), 'Bài tập mới');
    fireEvent.change(within(dialog).getByLabelText(/Hạn nộp/), {
      target: { value: '2030-12-01T23:59' }
    });
    await user.click(within(dialog).getByRole('button', { name: 'Giao bài tập' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/courses/3/assignments',
      expect.objectContaining({
        title: 'Bài tập mới',
        due_date: '2030-12-01T23:59:00+07:00',
        max_score: 10,
        allow_late_submission: false
      })
    ));
    expect(await screen.findByText('Bài tập mới')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('connects the server deadline validation error to its field', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
    vi.spyOn(api, 'post').mockRejectedValue(Object.assign(new Error('Hạn nộp phải hợp lệ.'), {
      status: 422,
      details: [{ field: 'due_date', message: 'Hạn nộp phải sau thời điểm hiện tại.' }]
    }));
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Tạo bài tập' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Tiêu đề/), 'Bài tập trễ hạn');
    fireEvent.change(within(dialog).getByLabelText(/Hạn nộp/), {
      target: { value: '2030-12-01T23:59' }
    });
    await user.click(within(dialog).getByRole('button', { name: 'Giao bài tập' }));

    expect(await within(dialog).findByText('Hạn nộp phải sau thời điểm hiện tại.'))
      .toBeInTheDocument();
    expect(within(dialog).getByText('Hạn nộp phải hợp lệ.')).toBeInTheDocument();
  });

  it.each([
    [401, 'Phiên đăng nhập đã hết hạn.'],
    [403, 'Bạn không có quyền giao bài tập.'],
    [409, 'Khóa học đã được lưu trữ.'],
    [429, 'Bạn đã tạo quá nhiều bài tập.']
  ])('shows the server message when creating an assignment returns %i', async (status, message) => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
    vi.spyOn(api, 'post').mockRejectedValue(Object.assign(new Error(message), { status }));
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Tạo bài tập' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Tiêu đề/), 'Bài tập mới');
    fireEvent.change(within(dialog).getByLabelText(/Hạn nộp/), {
      target: { value: '2030-12-01T23:59' }
    });
    await user.click(within(dialog).getByRole('button', { name: 'Giao bài tập' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(within(dialog).getByRole('button', { name: 'Giao bài tập' })).toBeEnabled();
  });

  it('shows submission status to students and does not expose assignment editing', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: [{
        id: 7,
        title: 'Bài tập chưa nộp',
        due_date: '2030-12-01T16:59:00.000Z',
        max_score: 10,
        allow_late_submission: false,
        submission_status: null
      }]
    });

    renderTab({ role: 'SINH_VIEN', isOwner: false });

    expect(await screen.findByText('Bài tập chưa nộp')).toBeInTheDocument();
    expect(screen.getByText('Chưa nộp')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo bài tập' })).not.toBeInTheDocument();
  });

  it('provides course gradebook access to the course instructor', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [] });

    renderTab();

    expect(await screen.findByRole('button', { name: 'Bảng điểm lớp' })).toBeInTheDocument();
  });

  it('edits an assignment for the course owner', async () => {
    const assignment = {
      id: 9,
      title: 'Bài tập cũ',
      description: '',
      due_date: '2030-12-01T16:59:00.000Z',
      max_score: 10,
      allow_late_submission: false,
      status: 'OPEN'
    };
    vi.spyOn(api, 'get').mockResolvedValue({ data: [assignment] });
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({
      data: { ...assignment, title: 'Bài tập đã sửa' }
    });
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Sửa Bài tập cũ' }));
    const dialog = screen.getByRole('dialog');
    const titleInput = within(dialog).getByLabelText(/Tiêu đề/);
    await user.clear(titleInput);
    await user.type(titleInput, 'Bài tập đã sửa');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith(
      '/assignments/9',
      expect.objectContaining({ title: 'Bài tập đã sửa' })
    ));
  });
});
