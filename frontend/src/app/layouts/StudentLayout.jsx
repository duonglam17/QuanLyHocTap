import React from 'react';
import { BasePageLayout } from '../../shared/components/templates/BasePageLayout';

export function StudentLayout() {
  const user = JSON.parse(
    localStorage.getItem('user') ||
      '{"username":"sv_nam","full_name":"Trần Văn Nam","role":"SINH_VIEN"}'
  );

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return <BasePageLayout user={user} role="SINH_VIEN" onLogout={handleLogout} />;
}

