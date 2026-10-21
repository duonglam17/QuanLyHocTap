import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from '../organisms/AppHeader';
import { RoleSidebar } from '../organisms/RoleSidebar';

/**
 * BasePageLayout: Template khung giao diện có Header, Sidebar theo vai trò,
 * và khu vực nội dung chính hiển thị Outlet.
 */
export function BasePageLayout({ user, role, onLogout }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader user={user} onLogout={onLogout} />
      <div className="flex flex-1">
        <RoleSidebar role={role} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

