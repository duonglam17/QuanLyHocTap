import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '../../shared/components/atoms/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <FileQuestion className="mb-4 h-14 w-14 text-muted-foreground" />
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">404 - Trang không tồn tại</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển sang địa chỉ khác.
      </p>
      <Link to="/" className="mt-6">
        <Button variant="default">Về trang chủ</Button>
      </Link>
    </div>
  );
}

