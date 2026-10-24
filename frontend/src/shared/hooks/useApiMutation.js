import { useCallback, useState } from 'react';

function fieldErrorsFrom(error) {
  if (!Array.isArray(error?.details)) return {};
  return error.details.reduce((result, item) => {
    if (item?.field && item?.message) result[item.field] = item.message;
    return result;
  }, {});
}

export function useApiMutation(mutationFn, { onSuccess, invalidate = [] } = {}) {
  const [state, setState] = useState({
    error: null,
    fieldErrors: {},
    status: 'success'
  });

  const mutate = useCallback(
    async (...args) => {
      setState({ error: null, fieldErrors: {}, status: 'loading' });
      try {
        const result = await mutationFn(...args);
        await onSuccess?.(result);
        invalidate.forEach((key) => {
          window.dispatchEvent(
            new CustomEvent('lms:query-invalidate', {
              detail: { key }
            })
          );
        });
        setState({ error: null, fieldErrors: {}, status: 'success' });
        return result;
      } catch (error) {
        setState({
          error,
          fieldErrors: fieldErrorsFrom(error),
          status: 'error'
        });
        throw error;
      }
    },
    [invalidate, mutationFn, onSuccess]
  );

  return { ...state, mutate };
}
