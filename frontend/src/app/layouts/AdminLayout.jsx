import React from 'react';
import { BasePageLayout } from '../../shared/components/templates/BasePageLayout';

export function AdminLayout() {
  const user = JSON.parse(localStorage.getItem('user') || '{"username":"admin","full_name":"Quản trị viên","role":"ADMIN"}');

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return <BasePageLayout user={user} role="ADMIN" onLogout={handleLogout} />;
}

