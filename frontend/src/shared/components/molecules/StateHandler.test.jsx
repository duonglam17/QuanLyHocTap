import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StateHandler } from './StateHandler';

describe('StateHandler - Kiểm thử khung 3 trạng thái mạng (Loading/Error/Empty)', () => {
  it('1. Hiển thị Spinner và thông điệp tải khi isLoading = true', () => {
    render(
      <StateHandler isLoading={true} loadingMessage="Đang tải danh sách khóa học...">
        <div>Nội dung thành công</div>
      </StateHandler>
    );

    expect(screen.getByTestId('state-loading')).toBeInTheDocument();
    expect(screen.getByText('Đang tải danh sách khóa học...')).toBeInTheDocument();
    expect(screen.queryByText('Nội dung thành công')).not.toBeInTheDocument();
  });

  it('2. Hiển thị thông báo lỗi và kích hoạt sự kiện Thử lại khi có error', () => {
    const handleRetry = vi.fn();
    render(
      <StateHandler
        isLoading={false}
        error="Lỗi không thể kết nối API máy chủ"
        onRetry={handleRetry}
      >
        <div>Nội dung thành công</div>
      </StateHandler>
    );

    expect(screen.getByTestId('state-error')).toBeInTheDocument();
    expect(screen.getByText('Lỗi không thể kết nối API máy chủ')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /thử lại/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('3. Hiển thị trạng thái rỗng khi isEmpty = true', () => {
    render(
      <StateHandler
        isLoading={false}
        error={null}
        isEmpty={true}
        emptyMessage="Không có bài tập nào cần nộp"
      >
        <div>Nội dung thành công</div>
      </StateHandler>
    );

    expect(screen.getByTestId('state-empty')).toBeInTheDocument();
    expect(screen.getByText('Không có bài tập nào cần nộp')).toBeInTheDocument();
  });

  it('4. Hiển thị nội dung children khi ở trạng thái thành công', () => {
    render(
      <StateHandler isLoading={false} error={null} isEmpty={false}>
        <div data-testid="success-content">Danh sách bài nộp hiển thị thành công</div>
      </StateHandler>
    );

    expect(screen.getByTestId('success-content')).toBeInTheDocument();
    expect(screen.getByText('Danh sách bài nộp hiển thị thành công')).toBeInTheDocument();
    expect(screen.queryByTestId('state-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('state-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('state-empty')).not.toBeInTheDocument();
  });
});

