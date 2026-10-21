import React from 'react';
import { LogOut, GraduationCap } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';

export function AppHeader({ user, onLogout }) {
  const roleDisplayMap = {
    ADMIN: { label: 'Quản trị viên', variant: 'destructive' },
    GIANG_VIEN: { label: 'Giảng viên', variant: 'default' },
    SINH_VIEN: { label: 'Sinh viên', variant: 'secondary' },
  };

  const currentRole = user?.role ? roleDisplayMap[user.role] : null;

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow">
          <GraduationCap className="h-5 w-5" />
        </div>
        <span className="text-base font-bold tracking-tight">LMS Mini</span>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">{user.full_name || user.username}</span>
            {currentRole && <Badge variant={currentRole.variant}>{currentRole.label}</Badge>}
          </div>
        )}
        {onLogout && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Đăng xuất
          </Button>
        )}
      </div>
    </header>
  );
}

