import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable.jsx';

describe('DataTable', () => {
  it('renders rows and optional pagination actions', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={[{ key: 'title', header: 'Tiêu đề' }]}
        onPageChange={onPageChange}
        page={1}
        rows={[{ id: 7, title: 'Bài tập tuần 1' }]}
        totalPages={2}
      />
    );

    expect(screen.getByRole('cell', { name: 'Bài tập tuần 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
