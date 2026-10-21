import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const user = JSON.parse(rawUser);
      if (user.role === 'ADMIN') {
        navigate('/admin/users', { replace: true });
      } else if (user.role === 'GIANG_VIEN') {
        navigate('/instructor/courses', { replace: true });
      } else {
        navigate('/student/my-courses', { replace: true });
      }
    } catch (e) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return null;
}

