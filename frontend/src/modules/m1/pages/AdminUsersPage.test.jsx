import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import { ApiError } from '@/shared/api/ApiError.js';
import * as usersApi from '../api/users.js';
import { AdminUsersPage } from './AdminUsersPage.jsx';

vi.mock('../api/users.js');

const mockAdminUser = {
  id: 1,
  username: 'admin',
  email: 'admin@lms.local',
  fullName: 'Quản trị viên Hệ thống',
  role: 'ADMIN'
};

const mockUsersList = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@lms.local',
    fullName: 'Quản trị viên Hệ thống',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 2,
    username: 'giangvien_mai',
    email: 'mai.nt@lms.local',
    fullName: 'Nguyễn Thị Mai',
    role: 'GIANG_VIEN',
    status: 'ACTIVE',
    createdAt: '2026-02-15T09:30:00.000Z'
  },
  {
    id: 3,
    username: 'sinhvien_an',
    email: 'an.nv@lms.local',
    fullName: 'Nguyễn Văn An',
    role: 'SINH_VIEN',
    status: 'LOCKED',
    createdAt: '2026-03-20T14:00:00.000Z'
  }
];

function renderAdminUsersPage({ user = mockAdminUser } = {}) {
  return render(
    <AuthContext.Provider value={{ user, status: 'authenticated', login: vi.fn(), logout: vi.fn() }}>
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route element={<AdminUsersPage />} path="/admin/users" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('AdminUsersPage (US-02 Quản lý người dùng)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it('renders loading skeleton when fetching users', () => {
    usersApi.listUsers.mockReturnValue(new Promise(() => {}));
    const { container } = renderAdminUsersPage();

    expect(screen.getByText('Quản lý người dùng')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders error state and retries on failure', async () => {
    usersApi.listUsers.mockRejectedValueOnce(new Error('Lỗi máy chủ không xác định'));
    renderAdminUsersPage();

    expect(await screen.findByText('Lỗi máy chủ không xác định')).toBeInTheDocument();

    usersApi.listUsers.mockResolvedValueOnce({ items: [], total: 0 });
    const retryButton = screen.getByRole('button', { name: 'Thử lại' });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(usersApi.listUsers).toHaveBeenCalledTimes(2);
    });
  });

  it('renders empty state when no users are found', async () => {
    usersApi.listUsers.mockResolvedValue({ items: [], total: 0 });
    renderAdminUsersPage();

    expect(await screen.findByText('Không tìm thấy người dùng')).toBeInTheDocument();
  });

  it('renders list of users with proper tags and prevents self-locking', async () => {
    usersApi.listUsers.mockResolvedValue({
      items: mockUsersList,
      total: 3,
      page: 1,
      limit: 10
    });
    renderAdminUsersPage();

    expect(await screen.findByText('Nguyễn Thị Mai')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(screen.getByText('admin@lms.local')).toBeInTheDocument();

    // Current admin user has "Bạn" tag
    expect(screen.getByText('Bạn')).toBeInTheDocument();

    // Check status badges (2 users in table + 1 option in filter select)
    expect(screen.getAllByText('Đang hoạt động').length).toBe(3);
    expect(screen.getAllByText('Đã khóa').length).toBe(2); // 1 user + 1 filter option

    // Check self-action prevention (EC-14)
    const selfLockButton = screen.getByRole('button', { name: 'Không thể tự khóa tài khoản' });
    expect(selfLockButton).toBeDisabled();

    const selfDeleteButton = screen.getByRole('button', { name: 'Không thể xóa chính mình' });
    expect(selfDeleteButton).toBeDisabled();
  });

  it('filters users by search, role, and status', async () => {
    usersApi.listUsers.mockResolvedValue({ items: mockUsersList, total: 3 });
    renderAdminUsersPage();

    await screen.findByText('Nguyễn Thị Mai');

    // Search input
    const searchInput = screen.getByPlaceholderText('Tìm theo tên, username, email...');
    fireEvent.change(searchInput, { target: { value: 'Mai' } });

    await waitFor(() => {
      expect(usersApi.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Mai', page: 1 })
      );
    });

    // Role filter
    const roleSelect = screen.getByLabelText('Lọc theo vai trò');
    fireEvent.change(roleSelect, { target: { value: 'GIANG_VIEN' } });

    await waitFor(() => {
      expect(usersApi.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'GIANG_VIEN', page: 1 })
      );
    });

    // Status filter
    const statusSelect = screen.getByLabelText('Lọc theo trạng thái');
    fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } });

    await waitFor(() => {
      expect(usersApi.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE', page: 1 })
      );
    });
  });

  it('allows admin to create a new user and displays initial password modal', async () => {
    usersApi.listUsers.mockResolvedValue({ items: mockUsersList, total: 3 });
    renderAdminUsersPage();

    await screen.findByText('Nguyễn Thị Mai');

    // Open UserFormDialog
    const createBtn = screen.getByRole('button', { name: 'Tạo người dùng mới' });
    fireEvent.click(createBtn);

    expect(screen.getByRole('heading', { name: 'Tạo người dùng mới' })).toBeInTheDocument();

    // Fill in form
    fireEvent.change(screen.getByLabelText(/Họ và tên/), { target: { value: 'Trần Văn Bình' } });
    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/), { target: { value: 'binhtv' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'binh.tv@lms.local' } });
    fireEvent.change(screen.getByLabelText(/Vai trò/), { target: { value: 'SINH_VIEN' } });

    // Mock API response
    usersApi.createUser.mockResolvedValueOnce({
      user: {
        id: 4,
        fullName: 'Trần Văn Bình',
        username: 'binhtv',
        email: 'binh.tv@lms.local',
        role: 'SINH_VIEN'
      },
      initialPassword: 'A1-TempPassword123'
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    // Initial password modal should show
    expect(await screen.findByRole('heading', { name: 'Tạo tài khoản thành công' })).toBeInTheDocument();
    expect(screen.getByText('A1-TempPassword123')).toBeInTheDocument();
    expect(screen.getByText(/Mật khẩu ban đầu chỉ hiển thị duy nhất một lần/)).toBeInTheDocument();

    // Copy password button
    const copyBtn = screen.getByRole('button', { name: 'Sao chép mật khẩu' });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('A1-TempPassword123');

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }));
    expect(screen.queryByRole('heading', { name: 'Tạo tài khoản thành công' })).not.toBeInTheDocument();
  });

  it('handles 409 conflict when creating a user with existing username/email', async () => {
    usersApi.listUsers.mockResolvedValue({ items: mockUsersList, total: 3 });
    renderAdminUsersPage();

    await screen.findByText('Nguyễn Thị Mai');

    fireEvent.click(screen.getByRole('button', { name: 'Tạo người dùng mới' }));

    fireEvent.change(screen.getByLabelText(/Họ và tên/), { target: { value: 'Admin Trùng' } });
    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'admin@lms.local' } });

    usersApi.createUser.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: 'USER_IDENTIFIER_EXISTS',
        message: 'Tên đăng nhập hoặc email đã được sử dụng'
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(
      await screen.findByText('Tên đăng nhập hoặc email đã được sử dụng trong hệ thống.')
    ).toBeInTheDocument();
  });

  it('locks an active user via ConfirmDialog', async () => {
    usersApi.listUsers.mockResolvedValue({ items: mockUsersList, total: 3 });
    renderAdminUsersPage();

    await screen.findByText('Nguyễn Thị Mai');

    const lockTrigger = screen.getByRole('button', { name: 'Khóa tài khoản giangvien_mai' });
    fireEvent.click(lockTrigger);

    expect(screen.getByRole('heading', { name: 'Khóa tài khoản' })).toBeInTheDocument();

    usersApi.updateUserStatus.mockResolvedValueOnce({
      user: { id: 2, status: 'LOCKED' }
    });

    const confirmButton = screen.getByRole('button', { name: 'Khóa tài khoản' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(usersApi.updateUserStatus).toHaveBeenCalledWith(2, 'LOCKED');
    });
  });

  it('unlocks a locked user via ConfirmDialog', async () => {
    usersApi.listUsers.mockResolvedValue({ items: mockUsersList, total: 3 });
    renderAdminUsersPage();

    await screen.findByText('Nguyễn Văn An');

    const unlockTrigger = screen.getByRole('button', { name: 'Mở khóa tài khoản sinhvien_an' });
    fireEvent.click(unlockTrigger);

    expect(screen.getByRole('heading', { name: 'Mở khóa tài khoản' })).toBeInTheDocument();

    usersApi.updateUserStatus.mockResolvedValueOnce({
      user: { id: 3, status: 'ACTIVE' }
    });

    const confirmButton = screen.getByRole('button', { name: 'Mở khóa' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(usersApi.updateUserStatus).toHaveBeenCalledWith(3, 'ACTIVE');
    });
  });

  it('changes user role via ChangeRoleDialog', async () => {
    usersApi.listUsers.mockResolvedValue({ items: mockUsersList, total: 3 });
    renderAdminUsersPage();

    await screen.findByText('Nguyễn Văn An');

    const changeRoleTrigger = screen.getByRole('button', { name: 'Đổi vai trò cho sinhvien_an' });
    fireEvent.click(changeRoleTrigger);

    expect(screen.getByRole('heading', { name: 'Thay đổi vai trò người dùng' })).toBeInTheDocument();

    const roleSelect = screen.getByLabelText(/Chọn vai trò mới/);
    fireEvent.change(roleSelect, { target: { value: 'GIANG_VIEN' } });

    usersApi.updateUserRole.mockResolvedValueOnce({
      user: { id: 3, role: 'GIANG_VIEN' }
    });

    const saveButton = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(usersApi.updateUserRole).toHaveBeenCalledWith(3, 'GIANG_VIEN');
    });
  });

  it('deletes a user via ConfirmDialog', async () => {
    usersApi.listUsers.mockResolvedValue({ items: mockUsersList, total: 3 });
    renderAdminUsersPage();

    await screen.findByText('Nguyễn Văn An');

    const deleteTrigger = screen.getByRole('button', { name: 'Xóa tài khoản sinhvien_an' });
    fireEvent.click(deleteTrigger);

    expect(screen.getByRole('heading', { name: 'Xóa tài khoản người dùng' })).toBeInTheDocument();

    usersApi.deleteUser.mockResolvedValueOnce({ userId: 3, deleted: true });

    const confirmButton = screen.getByRole('button', { name: 'Xác nhận xóa' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(usersApi.deleteUser).toHaveBeenCalledWith(3);
    });
  });

  it('disables submit button and input fields while submitting UserFormDialog (trạng thái đang gửi)', async () => {
    usersApi.listUsers.mockResolvedValue({ items: mockUsersList, total: 3 });
    let resolveCreate;
    usersApi.createUser.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    renderAdminUsersPage();
    await screen.findByText('Nguyễn Thị Mai');

    fireEvent.click(screen.getByRole('button', { name: 'Tạo người dùng mới' }));

    const fullNameInput = screen.getByLabelText(/Họ và tên/);
    const usernameInput = screen.getByLabelText(/Tên đăng nhập/);
    const emailInput = screen.getByLabelText(/Email/);

    fireEvent.change(fullNameInput, { target: { value: 'Lê Hoàng Nam' } });
    fireEvent.change(usernameInput, { target: { value: 'namlh' } });
    fireEvent.change(emailInput, { target: { value: 'nam.lh@lms.local' } });

    const submitBtn = screen.getByRole('button', { name: 'Tạo tài khoản' });
    fireEvent.click(submitBtn);

    expect(screen.getByRole('button', { name: /Đang xử lý/ })).toBeDisabled();
    expect(fullNameInput).toBeDisabled();
    expect(usernameInput).toBeDisabled();
    expect(emailInput).toBeDisabled();

    resolveCreate({
      user: { id: 5, fullName: 'Lê Hoàng Nam', username: 'namlh', email: 'nam.lh@lms.local', role: 'SINH_VIEN' },
      initialPassword: 'TempPass123!'
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tạo tài khoản thành công' })).toBeInTheDocument();
    });
  });

  it('disables submit button while submitting ChangeRoleDialog (trạng thái đang gửi)', async () => {
    usersApi.listUsers.mockResolvedValue({ items: mockUsersList, total: 3 });
    let resolveChangeRole;
    usersApi.updateUserRole.mockReturnValue(
      new Promise((resolve) => {
        resolveChangeRole = resolve;
      })
    );

    renderAdminUsersPage();
    await screen.findByText('Nguyễn Văn An');

    fireEvent.click(screen.getByRole('button', { name: 'Đổi vai trò cho sinhvien_an' }));

    const roleSelect = screen.getByLabelText(/Chọn vai trò mới/);
    fireEvent.change(roleSelect, { target: { value: 'GIANG_VIEN' } });

    const saveButton = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(saveButton);

    expect(screen.getByRole('button', { name: /Đang lưu/ })).toBeDisabled();
    expect(roleSelect).toBeDisabled();

    resolveChangeRole({ user: { id: 3, role: 'GIANG_VIEN' } });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Thay đổi vai trò người dùng' })).not.toBeInTheDocument();
    });
  });

  it('handles HTTP errors (401, 403, 422, 429) when creating a user', async () => {
    usersApi.listUsers.mockResolvedValue({ items: mockUsersList, total: 3 });
    renderAdminUsersPage();
    await screen.findByText('Nguyễn Thị Mai');

    fireEvent.click(screen.getByRole('button', { name: 'Tạo người dùng mới' }));

    fireEvent.change(screen.getByLabelText(/Họ và tên/), { target: { value: 'Test Error' } });
    fireEvent.change(screen.getByLabelText(/Tên đăng nhập/), { target: { value: 'testerror' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'test@lms.local' } });

    const submitBtn = screen.getByRole('button', { name: 'Tạo tài khoản' });

    // 401 Unauthorized
    usersApi.createUser.mockRejectedValueOnce(
      new ApiError({ status: 401, message: 'Phiên làm việc hết hạn' })
    );
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Phiên làm việc hết hạn')).toBeInTheDocument();

    // 403 Forbidden
    usersApi.createUser.mockRejectedValueOnce(
      new ApiError({ status: 403, message: 'Chỉ Quản trị viên mới có quyền tạo người dùng' })
    );
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Chỉ Quản trị viên mới có quyền tạo người dùng')).toBeInTheDocument();

    // 422 Validation Error
    usersApi.createUser.mockRejectedValueOnce(
      new ApiError({ status: 422, message: 'Tên đăng nhập không hợp lệ hoặc chứa ký tự đặc biệt' })
    );
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Tên đăng nhập không hợp lệ hoặc chứa ký tự đặc biệt')).toBeInTheDocument();

    // 429 Rate Limit
    usersApi.createUser.mockRejectedValueOnce(
      new ApiError({ status: 429, message: 'Bạn đã thực hiện quá nhiều thao tác, vui lòng thử lại sau.' })
    );
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Bạn đã thực hiện quá nhiều thao tác, vui lòng thử lại sau.')).toBeInTheDocument();
  });
});
