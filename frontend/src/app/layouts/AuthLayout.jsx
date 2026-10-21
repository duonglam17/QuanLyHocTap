import React from 'react';
import { Outlet } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">LMS Mini</h1>
          <p className="text-xs text-muted-foreground">Hệ thống Quản lý Học tập</p>
        </div>
      </div>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <Outlet />
      </div>
    </div>
  );
}

