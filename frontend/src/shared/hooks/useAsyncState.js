import { useState, useCallback } from 'react';

/**
 * Hook quản lý đồng bộ 3 trạng thái mạng: Loading, Error, Empty & Success
 * Phù hợp với tiêu chuẩn frontend-api-integration và frontend-component-architect
 */
export function useAsyncState(initialData = null) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (asyncFn) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      setData(result);
      return result;
    } catch (err) {
      setError(err?.message || 'Đã có lỗi xảy ra');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(initialData);
    setIsLoading(false);
    setError(null);
  }, [initialData]);

  // Kiểm tra trạng thái rỗng (Empty state)
  const isEmpty =
    !isLoading &&
    !error &&
    (data === null ||
      data === undefined ||
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === 'object' && Object.keys(data).length === 0));

  return {
    data,
    isLoading,
    error,
    isEmpty,
    execute,
    setData,
    setError,
    reset,
  };
}

