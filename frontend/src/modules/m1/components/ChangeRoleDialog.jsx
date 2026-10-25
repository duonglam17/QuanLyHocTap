import { useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/components/atoms/Dialog.jsx';
import { FormField } from '@/shared/components/molecules/FormField.jsx';
import { Spinner } from '@/shared/components/atoms/Spinner.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { updateUserRole } from '../api/users.js';

const roleLabels = {
  ADMIN: 'Quản trị viên',
  GIANG_VIEN: 'Giảng viên',
  SINH_VIEN: 'Sinh viên'
};

export function ChangeRoleDialog({ open, onOpenChange, user, onSuccess }) {
  const [selectedRole, setSelectedRole] = useState(user?.role || 'SINH_VIEN');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (user?.role) {
      setSelectedRole(user.role);
    }
  }, [user]);

  if (!user) return null;

  const isSameRole = selectedRole === user.role;

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSameRole) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      await updateUserRole(user.id, selectedRole);
      toast.success(`Đã cập nhật vai trò của ${user.fullName} thành ${roleLabels[selectedRole]}`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      setServerError(error.message || 'Không thể cập nhật vai trò người dùng');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <UserCheck aria-hidden="true" className="size-5" />
            <DialogTitle>Thay đổi vai trò người dùng</DialogTitle>
          </div>
          <DialogDescription>
            Cập nhật quyền hạn và phạm vi truy cập hệ thống của người dùng.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 py-2" onSubmit={handleSubmit}>
          {serverError ? (
            <div
              aria-live="polite"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {serverError}
            </div>
          ) : null}

          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Người dùng:</span>
              <span className="font-medium text-foreground">{user.fullName}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Tên đăng nhập:</span>
              <span className="font-mono text-foreground">{user.username}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Vai trò hiện tại:</span>
              <span className="font-semibold text-primary">{roleLabels[user.role] || user.role}</span>
            </div>
          </div>

          <FormField
            id="new-role-select"
            label="Chọn vai trò mới"
            required
          >
            <select
              aria-label="Chọn vai trò mới"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              id="new-role-select"
              onChange={(e) => setSelectedRole(e.target.value)}
              value={selectedRole}
            >
              <option value="SINH_VIEN">Sinh viên</option>
              <option value="GIANG_VIEN">Giảng viên</option>
              <option value="ADMIN">Quản trị viên (Admin)</option>
            </select>
          </FormField>

          <DialogFooter className="pt-2">
            <Button
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button disabled={isSubmitting || isSameRole} type="submit">
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                'Lưu thay đổi'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
