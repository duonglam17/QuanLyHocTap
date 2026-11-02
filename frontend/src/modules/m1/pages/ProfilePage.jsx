import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Calendar, Lock, Mail, Shield, User, UserCheck } from 'lucide-react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { Badge } from '@/shared/components/atoms/Badge.jsx';
import { Skeleton } from '@/shared/components/atoms/Skeleton.jsx';
import { formatDateTime } from '@/shared/lib/formatters.js';
import { useAuth } from '@/shared/auth/useAuth.js';
import { getMe } from '../api/users.js';
import { ChangePasswordDialog } from '../components/ChangePasswordDialog.jsx';

const roleLabels = {
  ADMIN: 'Quản trị viên',
  GIANG_VIEN: 'Giảng viên',
  SINH_VIEN: 'Sinh viên'
};

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchProfile() {
      if (user?.role === 'ADMIN') return;
      setLoading(true);
      setError(null);
      try {
        const data = await getMe();
        if (active) {
          setProfile(data?.user || data);
        }
      } catch (err) {
        if (!active) return;
        if (err?.status === 401 || err?.statusCode === 401) {
          try {
            await logout?.();
          } catch {
            // ignore
          }
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Không thể tải thông tin tài khoản.');
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProfile();

    return () => {
      active = false;
    };
  }, [navigate, logout, user?.role]);

  // Route guard: Nếu là ADMIN thì chuyển về trang chủ
  if (user?.role === 'ADMIN') {
    return <Navigate replace to="/" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <User className="size-6 text-primary" />
            Thông tin tài khoản
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý và xem chi tiết hồ sơ cá nhân của bạn trong hệ thống LMS Mini.
          </p>
        </div>
        {profile && profile.role !== 'ADMIN' ? (
          <Button
            className="flex items-center gap-2 self-start sm:self-auto"
            onClick={() => setChangePasswordOpen(true)}
            variant="outline"
          >
            <Lock className="size-4" />
            Đổi mật khẩu
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="grid gap-4" data-testid="profile-page-loading">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="space-y-3 pt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
            <p className="font-semibold">Đã xảy ra lỗi</p>
            <p className="mt-1">{error}</p>
            <Button
              className="mt-3"
              onClick={() => {
                setLoading(true);
                setError(null);
                getMe()
                  .then((data) => setProfile(data?.user || data))
                  .catch((err) => setError(err.message || 'Lỗi kết nối'))
                  .finally(() => setLoading(false));
              }}
              size="sm"
              variant="outline"
            >
              Thử lại
            </Button>
          </div>
        ) : profile ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-border pb-6">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserCheck className="size-8" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-foreground truncate">
                  {profile.fullName || 'Chưa cập nhật'}
                </h2>
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              </div>
              <Badge variant="secondary">
                {roleLabels[profile.role] || profile.role}
              </Badge>
            </div>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <Mail className="mt-0.5 size-5 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Địa chỉ Email</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">{profile.email}</dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <User className="mt-0.5 size-5 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Tên người dùng</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">{profile.username}</dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <Shield className="mt-0.5 size-5 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Vai trò hệ thống</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">
                    {roleLabels[profile.role] || profile.role}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <Calendar className="mt-0.5 size-5 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Ngày tạo tài khoản</dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">
                    {formatDateTime(profile.createdAt)}
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        ) : null}
      </div>

      <ChangePasswordDialog
        onOpenChange={setChangePasswordOpen}
        open={changePasswordOpen}
      />
    </div>
  );
}
