import { useState } from 'react';
import { AlertTriangle, Check, Copy, KeyRound } from 'lucide-react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/components/atoms/Dialog.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';

const roleLabels = {
  ADMIN: 'Quản trị viên',
  GIANG_VIEN: 'Giảng viên',
  SINH_VIEN: 'Sinh viên'
};

export function InitialPasswordDialog({ open, onOpenChange, data }) {
  const [copied, setCopied] = useState(false);

  if (!data) return null;
  const { user, initialPassword } = data;

  async function handleCopyPassword() {
    if (!initialPassword) return;
    try {
      await navigator.clipboard.writeText(initialPassword);
      setCopied(true);
      toast.success('Đã sao chép mật khẩu vào bộ nhớ tạm');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép mật khẩu');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <KeyRound aria-hidden="true" className="size-5" />
            <DialogTitle>Tạo tài khoản thành công</DialogTitle>
          </div>
          <DialogDescription>
            Tài khoản đã được khởi tạo trong hệ thống. Vui lòng lưu lại mật khẩu ban đầu bên dưới.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="grid grid-cols-3 gap-1.5 py-1">
              <span className="text-muted-foreground">Họ và tên:</span>
              <span className="col-span-2 font-medium text-foreground">{user?.fullName}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 py-1">
              <span className="text-muted-foreground">Tên đăng nhập:</span>
              <span className="col-span-2 font-mono font-medium text-foreground">{user?.username}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 py-1">
              <span className="text-muted-foreground">Email:</span>
              <span className="col-span-2 font-medium text-foreground">{user?.email}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 py-1">
              <span className="text-muted-foreground">Vai trò:</span>
              <span className="col-span-2 font-medium text-foreground">
                {roleLabels[user?.role] || user?.role}
              </span>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Mật khẩu ban đầu
            </label>
            <div className="flex items-center gap-2">
              <div
                aria-label="Mật khẩu ban đầu"
                className="flex h-10 flex-1 items-center justify-between rounded-md border border-input bg-background px-3 font-mono text-sm font-semibold tracking-wider text-foreground select-all"
              >
                <span>{initialPassword}</span>
              </div>
              <Button
                aria-label="Sao chép mật khẩu"
                className="shrink-0"
                onClick={handleCopyPassword}
                type="button"
                variant="outline"
              >
                {copied ? (
                  <>
                    <Check aria-hidden="true" className="mr-1.5 size-4 text-success" />
                    <span>Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy aria-hidden="true" className="mr-1.5 size-4" />
                    <span>Sao chép</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-foreground"
            role="alert"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p>
              <strong>Lưu ý quan trọng:</strong> Mật khẩu ban đầu chỉ hiển thị duy nhất một lần. Vui lòng gửi cho người dùng và yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button">
            Hoàn tất
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
