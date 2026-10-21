import React from 'react';
import { BookOpen } from 'lucide-react';
import { Badge } from '../../../shared/components/atoms/Badge';

export function M1PlaceholderPage({ title = 'Module M1 - Nền tảng, Khóa học & Lịch học' }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Phân hệ Quản lý Tài khoản, Khóa học, Bài giảng & Lịch học (Epics E1, E2)
          </p>
        </div>
        <Badge variant="default">Module M1</Badge>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BookOpen className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Trang khung Module M1</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Giao diện nghiệp vụ chi tiết sẽ được hoàn thiện theo PRD và API contracts. Đã sẵn sàng các
          thành phần Atomic Design và Design Tokens để triển khai.
        </p>
      </div>
    </div>
  );
}

