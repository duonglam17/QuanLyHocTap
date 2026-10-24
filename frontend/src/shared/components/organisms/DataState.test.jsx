import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataState } from './DataState.jsx';

describe('DataState', () => {
  it('shows skeleton loading state', () => {
    const { container } = render(
      <DataState query={{ status: 'loading' }}>
        {(data) => <p>{data.title}</p>}
      </DataState>
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows the server error and retries', () => {
    const refetch = vi.fn();
    render(
      <DataState
        query={{ status: 'error', error: new Error('Không thể tải'), refetch }}
      >
        {() => null}
      </DataState>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(screen.getByText('Không thể tải')).toBeInTheDocument();
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows an actionable empty state and renders successful data', () => {
    const onClick = vi.fn();
    const empty = render(
      <DataState
        empty={{ title: 'Chưa có bài tập', description: 'Hãy tạo bài đầu tiên.', action: { label: 'Tạo bài tập', onClick } }}
        isEmpty={(data) => data.length === 0}
        query={{ status: 'success', data: [] }}
      >
        {(data) => <p>{data.length}</p>}
      </DataState>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bài tập' }));
    expect(onClick).toHaveBeenCalledOnce();
    empty.unmount();

    render(
      <DataState query={{ status: 'success', data: ['Đã tải'] }}>
        {(data) => <p>{data[0]}</p>}
      </DataState>
    );
    expect(screen.getByText('Đã tải')).toBeInTheDocument();
  });
});
