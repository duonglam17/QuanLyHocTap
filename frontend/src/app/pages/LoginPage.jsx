import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../shared/components/atoms/Button';
import { FormField } from '../../shared/components/molecules/FormField';

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    setTimeout(() => {
      // Giả lập đăng nhập nhanh cho các vai trò để kiểm thử khung
      let mockRole = 'SINH_VIEN';
      let mockName = 'Trần Văn Nam';

      if (username === 'admin') {
        mockRole = 'ADMIN';
        mockName = 'Quản trị viên Hoàng';
      } else if (username.startsWith('gv_') || username === 'giangvien') {
        mockRole = 'GIANG_VIEN';
        mockName = 'Cô Nguyễn Thị Mai';
      }

      const mockUser = {
        id: 1,
        username: username || 'sv_nam',
        full_name: mockName,
        role: mockRole,
      };

      localStorage.setItem('access_token', 'mock_jwt_token_for_testing');
      localStorage.setItem('user', JSON.stringify(mockUser));
      setIsLoading(false);

      if (mockRole === 'ADMIN') {
        navigate('/admin/users');
      } else if (mockRole === 'GIANG_VIEN') {
        navigate('/instructor/courses');
      } else {
        navigate('/student/my-courses');
      }
    }, 400);
  };

  const handleQuickLogin = (role) => {
    const rolesMap = {
      ADMIN: {
        username: 'admin',
        full_name: 'Quản trị viên Hoàng',
        path: '/admin/users',
      },
      GIANG_VIEN: {
        username: 'gv_mai',
        full_name: 'Cô Nguyễn Thị Mai',
        path: '/instructor/courses',
      },
      SINH_VIEN: {
        username: 'sv_nam',
        full_name: 'Trần Văn Nam',
        path: '/student/my-courses',
      },
    };

    const target = rolesMap[role];
    localStorage.setItem('access_token', 'mock_token_' + role);
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 1,
        username: target.username,
        full_name: target.full_name,
        role,
      })
    );
    navigate(target.path);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Đăng nhập tài khoản</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nhập thông tin xác thực để truy cập hệ thống
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {errorMessage && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <FormField
          id="username"
          label="Tên đăng nhập"
          required
          inputProps={{
            value: username,
            onChange: (e) => setUsername(e.target.value),
            placeholder: 'admin / gv_mai / sv_nam',
          }}
        />

        <FormField
          id="password"
          label="Mật khẩu"
          required
          inputProps={{
            type: 'password',
            value: password,
            onChange: (e) => setPassword(e.target.value),
            placeholder: '••••••••',
          }}
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Đăng nhập
        </Button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Chuyển vai trò nhanh (Dev Mode)</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleQuickLogin('ADMIN')}
        >
          Admin
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleQuickLogin('GIANG_VIEN')}
        >
          Giảng viên
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleQuickLogin('SINH_VIEN')}
        >
          Sinh viên
        </Button>
      </div>
    </div>
  );
}

