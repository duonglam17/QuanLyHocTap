import React from 'react';
import { FileText } from 'lucide-react';
import { Badge } from '../../../shared/components/atoms/Badge';

export function M2PlaceholderPage({ title = 'Module M2 - Bài tập tự luận & Bảng điểm' }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Phân hệ Quản lý Bài tập, Chấm bài, Nộp bài & Bảng điểm tổng hợp (Epics E3, E5)
          </p>
        </div>
        <Badge variant="secondary">Module M2</Badge>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Trang khung Module M2</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Giao diện nộp bài tập (chống double submit, kiểm soát deadline), chấm điểm thang 10 và xuất
          CSV bảng điểm an toàn sẽ được gắn kết tại đây.
        </p>
      </div>
    </div>
  );
}

