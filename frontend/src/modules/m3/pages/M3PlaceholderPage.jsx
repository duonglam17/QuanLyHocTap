import React from 'react';
import { CheckSquare } from 'lucide-react';
import { Badge } from '../../../shared/components/atoms/Badge';

export function M3PlaceholderPage({ title = 'Module M3 - Đề thi trắc nghiệm & Tương tác' }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Phân hệ Đề thi trắc nghiệm, Thi trực tuyến, Bảng tin & Diễn đàn thảo luận (Epics E4, E6)
          </p>
        </div>
        <Badge variant="outline">Module M3</Badge>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <CheckSquare className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Trang khung Module M3</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Giao diện phòng thi trực tuyến với đồng hồ đếm ngược căn server, auto-save đáp án và bảng tin
          trao đổi bảo mật (chống XSS) sẽ được tích hợp tại đây.
        </p>
      </div>
    </div>
  );
}

