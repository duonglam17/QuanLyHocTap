import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApiMutation } from './useApiMutation.js';
import { useApiQuery } from './useApiQuery.js';

describe('API hooks', () => {
  it('loads query data and refetches on demand', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useApiQuery(['assignments'], fetcher));

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toEqual([{ id: 1 }]);

    await act(async () => result.current.refetch());
    expect(result.current.data).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('reports query errors as an error state', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Lỗi máy chủ'));
    const { result } = renderHook(() => useApiQuery('grades', fetcher));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error.message).toBe('Lỗi máy chủ');
  });

  it('maps validation details and invalidates requested query keys', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ id: 4 });
    const invalidationHandler = vi.fn();
    window.addEventListener('lms:query-invalidate', invalidationHandler);
    const { result } = renderHook(() =>
      useApiMutation(mutationFn, { invalidate: [['assignments', 2]] })
    );

    await act(async () => result.current.mutate({ title: 'Bài tập' }));
    expect(result.current.status).toBe('success');
    expect(invalidationHandler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { key: ['assignments', 2] } })
    );
    window.removeEventListener('lms:query-invalidate', invalidationHandler);

    const error = Object.assign(new Error('Dữ liệu sai'), {
      details: [{ field: 'title', message: 'Tiêu đề là bắt buộc' }]
    });
    const rejected = renderHook(() => useApiMutation(vi.fn().mockRejectedValue(error)));
    await act(async () => {
      await expect(rejected.result.current.mutate({})).rejects.toBe(error);
    });
    expect(rejected.result.current.fieldErrors).toEqual({
      title: 'Tiêu đề là bắt buộc'
    });
  });
});
