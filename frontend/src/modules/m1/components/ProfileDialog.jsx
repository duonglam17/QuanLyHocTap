import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Lock, Mail, Shield, User, UserCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/components/atoms/Dialog.jsx';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { Badge } from '@/shared/components/atoms/Badge.jsx';
import { Skeleton } from '@/shared/components/atoms/Skeleton.jsx';
import { formatDateTime } from '@/shared/lib/formatters.js';
import { APP_NAME } from '@/shared/lib/index.js';
import { useAuth } from '@/shared/auth/useAuth.js';
import { getMe } from '../api/users.js';
import { ChangePasswordDialog } from './ChangePasswordDialog.jsx';

const roleLabels = {
  ADMIN: 'Quản trị viên',
  GIANG_VIEN: 'Giảng viên',
  SINH_VIEN: 'Sinh viên'
};

export function ProfileDialog({ open, onOpenChange }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    let active = true;

    async function fetchProfile() {
      if (!open) return;
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
            // ignore logout error
          }
          onOpenChange(false);
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
  }, [open, navigate, logout, onOpenChange]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            Thông tin tài khoản
          </DialogTitle>
          <DialogDescription>
            Chi tiết hồ sơ và quyền hạn cá nhân của bạn trong hệ thống {APP_NAME}.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid gap-4 py-2" data-testid="profile-loading">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="space-y-3 pt-2">
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
          <div className="grid gap-4 py-2">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserCheck className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {profile.fullName || 'Chưa cập nhật'}
                </h3>
                <p className="text-xs text-muted-foreground">@{profile.username}</p>
              </div>
              <Badge variant="secondary">
                {roleLabels[profile.role] || profile.role}
              </Badge>
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-start gap-3 rounded-md bg-muted/40 p-2.5">
                <Mail className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">Địa chỉ email</dt>
                  <dd className="font-medium text-foreground">{profile.email}</dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-md bg-muted/40 p-2.5">
                <Shield className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">Vai trò trong hệ thống</dt>
                  <dd className="font-medium text-foreground">
                    {roleLabels[profile.role] || profile.role}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-md bg-muted/40 p-2.5">
                <Calendar className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">Ngày tạo tài khoản</dt>
                  <dd className="font-medium text-foreground">
                    {formatDateTime(profile.createdAt)}
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        ) : null}

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
          {profile && profile.role !== 'ADMIN' ? (
            <Button
              className="flex items-center gap-2"
              onClick={() => setChangePasswordOpen(true)}
              variant="outline"
            >
              <Lock className="size-4" />
              Đổi mật khẩu
            </Button>
          ) : <span />}
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>

      <ChangePasswordDialog
        onOpenChange={setChangePasswordOpen}
        onSuccess={() => onOpenChange(false)}
        open={changePasswordOpen}
      />
    </Dialog>
  );
}

