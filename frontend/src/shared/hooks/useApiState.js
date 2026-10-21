import { useCallback, useState } from 'react';

export function useApiState() {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });

  const run = useCallback(async (request) => {
    setState({ status: 'loading', data: null, error: null });
    try {
      const data = await request();
      const status = Array.isArray(data) && data.length === 0 ? 'empty' : 'success';
      setState({ status, data, error: null });
      return data;
    } catch (error) {
      setState({ status: 'error', data: null, error });
      throw error;
    }
  }, []);

  return { ...state, run };
}
