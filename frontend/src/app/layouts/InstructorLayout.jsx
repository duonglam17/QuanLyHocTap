import React from 'react';
import { BasePageLayout } from '../../shared/components/templates/BasePageLayout';

export function InstructorLayout() {
  const user = JSON.parse(
    localStorage.getItem('user') ||
      '{"username":"gv_mai","full_name":"Cô Nguyễn Thị Mai","role":"GIANG_VIEN"}'
  );

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return <BasePageLayout user={user} role="GIANG_VIEN" onLogout={handleLogout} />;
}

