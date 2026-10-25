import { useMemo, useState } from 'react';
import {
  Lock,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus
} from 'lucide-react';
import { useAuth } from '@/shared/auth';
import { useApiQuery } from '@/shared/hooks';
import { formatDateTime } from '@/shared/lib';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { StatusBadge } from '@/shared/components/molecules/StatusBadge.jsx';
import { PageHeader } from '@/shared/components/molecules/PageHeader.jsx';
import { SearchInput } from '@/shared/components/molecules/SearchInput.jsx';
import { ConfirmDialog } from '@/shared/components/molecules/ConfirmDialog.jsx';
import { DataTable } from '@/shared/components/organisms/DataTable.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { deleteUser, listUsers, updateUserStatus } from '../api/users.js';
import { UserFormDialog } from '../components/UserFormDialog.jsx';
import { InitialPasswordDialog } from '../components/InitialPasswordDialog.jsx';
import { ChangeRoleDialog } from '../components/ChangeRoleDialog.jsx';

const roleDisplayMap = {
  ADMIN: 'Quản trị viên',
  GIANG_VIEN: 'Giảng viên',
  SINH_VIEN: 'Sinh viên'
};

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const limit = 10;
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [initialPasswordData, setInitialPasswordData] = useState(null);
  const [isInitialPasswordOpen, setIsInitialPasswordOpen] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState(null);
  const [isRoleChangeOpen, setIsRoleChangeOpen] = useState(false);

  // Query users
  const queryParams = useMemo(() => {
    const params = { page, limit };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (selectedRole) params.role = selectedRole;
    if (selectedStatus) params.status = selectedStatus;
    return params;
  }, [page, limit, debouncedSearch, selectedRole, selectedStatus]);

  const query = useApiQuery(['admin-users', queryParams], () => listUsers(queryParams));

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const rows = query.data?.items ?? [];

  function handleSearchChange(event) {
    const value = event.target.value;
    setSearchTerm(value);
    setDebouncedSearch(value);
    setPage(1);
  }

  function handleSearchClear() {
    setSearchTerm('');
    setDebouncedSearch('');
    setPage(1);
  }

  function handleRoleFilterChange(event) {
    setSelectedRole(event.target.value);
    setPage(1);
  }

  function handleStatusFilterChange(event) {
    setSelectedStatus(event.target.value);
    setPage(1);
  }

  function handleCreateSuccess(result) {
    query.refetch();
    setInitialPasswordData(result);
    setIsInitialPasswordOpen(true);
  }

  async function handleToggleStatus(user) {
    const nextStatus = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    try {
      await updateUserStatus(user.id, nextStatus);
      toast.success(
        nextStatus === 'LOCKED'
          ? `Đã khóa tài khoản của ${user.fullName}`
          : `Đã mở khóa tài khoản của ${user.fullName}`
      );
      query.refetch();
    } catch (error) {
      toast.error(error.message || 'Không thể cập nhật trạng thái người dùng');
    }
  }

  async function handleDeleteUser(user) {
    try {
      await deleteUser(user.id);
      toast.success(`Đã xóa tài khoản của ${user.fullName}`);
      query.refetch();
    } catch (error) {
      toast.error(error.message || 'Không thể xóa tài khoản người dùng');
    }
  }

  function openRoleChange(user) {
    setRoleChangeTarget(user);
    setIsRoleChangeOpen(true);
  }

  const columns = [
    {
      key: 'fullName',
      header: 'Họ và tên',
      cell: (user) => (
        <div className="grid gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{user.fullName}</span>
            {user.id === currentUser?.id ? (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                Bạn
              </span>
            ) : null}
          </div>
          <span className="font-mono text-xs text-muted-foreground">{user.username}</span>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      cell: (user) => <span className="text-sm text-foreground">{user.email}</span>
    },
    {
      key: 'role',
      header: 'Vai trò',
      cell: (user) => (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {roleDisplayMap[user.role] || user.role}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (user) => <StatusBadge type="account" value={user.status} />
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      cell: (user) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(user.createdAt)}</span>
      )
    },
    {
      key: 'actions',
      header: 'Thao tác',
      cell: (user) => {
        const isSelf = user.id === currentUser?.id;
        const isLocked = user.status === 'LOCKED' || user.status === 'TEMPORARY_LOCKED';

        return (
          <div className="flex items-center gap-1">
            {/* Khóa / Mở khóa */}
            {isLocked ? (
              <ConfirmDialog
                cancelLabel="Hủy"
                confirmLabel="Mở khóa"
                description={`Bạn có chắc chắn muốn mở khóa tài khoản cho "${user.fullName}" (${user.username})?`}
                onConfirm={() => handleToggleStatus(user)}
                title="Mở khóa tài khoản"
                trigger={
                  <Button
                    aria-label={`Mở khóa tài khoản ${user.username}`}
                    size="sm"
                    variant="outline"
                  >
                    <Unlock aria-hidden="true" className="mr-1.5 size-3.5 text-success" />
                    <span>Mở khóa</span>
                  </Button>
                }
              />
            ) : isSelf ? (
              <Button
                aria-label="Không thể tự khóa tài khoản"
                disabled
                size="sm"
                title="Bạn không thể tự khóa tài khoản của mình"
                variant="outline"
              >
                <Lock aria-hidden="true" className="mr-1.5 size-3.5 text-muted-foreground" />
                <span>Khóa</span>
              </Button>
            ) : (
              <ConfirmDialog
                cancelLabel="Hủy"
                confirmLabel="Khóa tài khoản"
                description={`Bạn có chắc chắn muốn khóa tài khoản "${user.fullName}" (${user.username})? Người dùng sẽ không thể đăng nhập sau khi bị khóa.`}
                onConfirm={() => handleToggleStatus(user)}
                title="Khóa tài khoản"
                trigger={
                  <Button
                    aria-label={`Khóa tài khoản ${user.username}`}
                    size="sm"
                    variant="outline"
                  >
                    <Lock aria-hidden="true" className="mr-1.5 size-3.5 text-destructive" />
                    <span>Khóa</span>
                  </Button>
                }
              />
            )}

            {/* Đổi vai trò */}
            <Button
              aria-label={`Đổi vai trò cho ${user.username}`}
              onClick={() => openRoleChange(user)}
              size="sm"
              variant="ghost"
            >
              <UserCheck aria-hidden="true" className="mr-1.5 size-3.5" />
              <span>Đổi vai trò</span>
            </Button>

            {/* Xóa người dùng */}
            {isSelf ? (
              <Button
                aria-label="Không thể xóa chính mình"
                disabled
                size="sm"
                title="Bạn không thể xóa tài khoản của chính mình"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
              </Button>
            ) : (
              <ConfirmDialog
                cancelLabel="Hủy"
                confirmLabel="Xác nhận xóa"
                description={`Bạn có chắc chắn muốn xóa tài khoản "${user.fullName}" (${user.username})? Dữ liệu người dùng sẽ được xóa mềm khỏi hệ thống.`}
                onConfirm={() => handleDeleteUser(user)}
                title="Xóa tài khoản người dùng"
                trigger={
                  <Button
                    aria-label={`Xóa tài khoản ${user.username}`}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </Button>
                }
              />
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <UserPlus aria-hidden="true" className="mr-1.5 size-4" />
            <span>Tạo người dùng mới</span>
          </Button>
        }
        description="Quản trị tài khoản, phân quyền và trạng thái hoạt động của người dùng trong hệ thống."
        title="Quản lý người dùng"
      />

      {/* Filter toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <SearchInput
            onChange={handleSearchChange}
            onClear={handleSearchClear}
            placeholder="Tìm theo tên, username, email..."
            value={searchTerm}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lọc vai trò */}
          <select
            aria-label="Lọc theo vai trò"
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={handleRoleFilterChange}
            value={selectedRole}
          >
            <option value="">Tất cả vai trò</option>
            <option value="ADMIN">Quản trị viên (Admin)</option>
            <option value="GIANG_VIEN">Giảng viên</option>
            <option value="SINH_VIEN">Sinh viên</option>
          </select>

          {/* Lọc trạng thái */}
          <select
            aria-label="Lọc theo trạng thái"
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={handleStatusFilterChange}
            value={selectedStatus}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
            <option value="TEMPORARY_LOCKED">Tạm khóa</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        empty={{
          title: 'Không tìm thấy người dùng',
          description: searchTerm || selectedRole || selectedStatus
            ? 'Không có tài khoản nào phù hợp với bộ lọc hiện tại. Thử thay đổi từ khóa hoặc điều kiện lọc.'
            : 'Hệ thống chưa có người dùng nào được tạo.'
        }}
        error={query.error}
        loading={query.status === 'loading'}
        onPageChange={setPage}
        onRetry={query.refetch}
        page={page}
        rowKey="id"
        rows={rows}
        totalPages={totalPages}
      />

      {/* Modals */}
      <UserFormDialog
        onOpenChange={setIsCreateOpen}
        onSuccess={handleCreateSuccess}
        open={isCreateOpen}
      />

      <InitialPasswordDialog
        data={initialPasswordData}
        onOpenChange={setIsInitialPasswordOpen}
        open={isInitialPasswordOpen}
      />

      <ChangeRoleDialog
        onOpenChange={setIsRoleChangeOpen}
        onSuccess={() => query.refetch()}
        open={isRoleChangeOpen}
        user={roleChangeTarget}
      />
    </div>
  );
}
