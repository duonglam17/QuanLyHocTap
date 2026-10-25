import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormField } from './FormField.jsx';
import { FileInput } from './FileInput.jsx';
import { SearchInput } from './SearchInput.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { statusEntries } from './statusLabels.js';
import { Pagination } from './Pagination.jsx';
import { Input } from '../atoms/Input.jsx';

describe('shared molecules', () => {
  it('associates a field label and displays server field errors', () => {
    render(
      <FormField id="title" label="Tiêu đề" error="Tiêu đề đã tồn tại">
        <Input id="title" />
      </FormField>
    );
    expect(screen.getByLabelText('Tiêu đề')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Tiêu đề đã tồn tại');
  });

  it('forwards search text and clears it on request', () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<SearchInput value="bài" onChange={onChange} onClear={onClear} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bài tập' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xóa nội dung tìm kiếm' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('rejects a disallowed file type before upload', () => {
    const onFileChange = vi.fn();
    const { container } = render(<FileInput accept=".pdf" onFileChange={onFileChange} />);
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: {
        files: [new File(['text'], 'baocao.exe', { type: 'application/octet-stream' })]
      }
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Định dạng tệp không được hỗ trợ.');
    expect(onFileChange).toHaveBeenCalledWith(null);
  });

  it('maps submission statuses and paginates', () => {
    const onPageChange = vi.fn();
    render(
      <>
        <StatusBadge type="submission" value="SUBMITTED_LATE" />
        <Pagination page={2} totalPages={3} onPageChange={onPageChange} />
      </>
    );
    expect(screen.getByText('Nộp trễ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('keeps every status table unique and covers the contract enums', () => {
    Object.values(statusEntries).forEach((entries) => {
      const values = entries.map(([value]) => value);
      expect(new Set(values).size).toBe(values.length);
    });

    expect(statusEntries.account.map(([value]) => value)).toEqual([
      'ACTIVE',
      'LOCKED',
      'TEMPORARY_LOCKED'
    ]);
    expect(statusEntries.course.map(([value]) => value)).toEqual([
      'DRAFT',
      'PUBLISHED',
      'ARCHIVED'
    ]);
    expect(statusEntries.submission.map(([value]) => value)).toEqual([
      'NOT_SUBMITTED',
      'SUBMITTED',
      'SUBMITTED_LATE',
      'GRADED'
    ]);
    expect(statusEntries.attempt.map(([value]) => value)).toEqual([
      'IN_PROGRESS',
      'SUBMITTED',
      'AUTO_SUBMITTED'
    ]);
    expect(statusEntries.schedule.map(([value]) => value)).toEqual([
      'SCHEDULED',
      'RESCHEDULED',
      'CANCELLED'
    ]);
  });

  it('shows an outline fallback for unknown status values', () => {
    render(<StatusBadge type="submission" value="UNRECOGNIZED" />);

    expect(screen.getByText('UNRECOGNIZED')).toBeInTheDocument();
    expect(screen.getByText('UNRECOGNIZED')).toHaveClass('border');
  });
});
