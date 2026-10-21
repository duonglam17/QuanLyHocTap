import React from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { Spinner } from '../atoms/Spinner';
import { Button } from '../atoms/Button';

/**
 * StateHandler: Molecule chuẩn hóa xử lý 3 trạng thái mạng:
 * 1. Loading: hiển thị spinner hoặc loading placeholder
 * 2. Error: hiển thị thông báo lỗi kèm nút Thử lại (Retry)
 * 3. Empty: hiển thị thông báo khi không có dữ liệu
 * 4. Success: render children
 */
export function StateHandler({
  isLoading,
  error,
  isEmpty,
  emptyMessage = 'Chưa có dữ liệu để hiển thị.',
  loadingMessage = 'Đang tải dữ liệu...',
  onRetry,
  children,
}) {
  if (isLoading) {
    return (
      <div
        data-testid="state-loading"
        className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground"
      >
        <Spinner size="lg" className="mb-3" />
        <p className="text-sm">{loadingMessage}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="state-error"
        className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive"
      >
        <AlertCircle className="mb-2 h-8 w-8" />
        <h3 className="text-base font-semibold">Đã xảy ra lỗi</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {typeof error === 'string' ? error : error?.message || 'Có sự cố xảy ra.'}
        </p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-4 border-destructive text-destructive hover:bg-destructive/10"
          >
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        data-testid="state-empty"
        className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground"
      >
        <Inbox className="mb-2 h-10 w-10 text-muted" />
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}

