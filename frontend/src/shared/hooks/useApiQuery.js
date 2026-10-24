import { useCallback, useEffect, useRef, useState } from 'react';

function serializeKey(key) {
  return JSON.stringify(key);
}

export function useApiQuery(key, fetcher, { enabled = true, refetchInterval } = {}) {
  const keyId = serializeKey(key);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    data: null,
    error: null,
    status: enabled ? 'loading' : 'success'
  });

  const refetch = useCallback(async () => {
    setState((current) => ({ ...current, error: null, status: 'loading' }));
    try {
      const data = await fetcherRef.current();
      setState({ data, error: null, status: 'success' });
      return data;
    } catch (error) {
      setState((current) => ({ ...current, error, status: 'error' }));
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({ ...current, error: null, status: 'success' }));
      return undefined;
    }

    let active = true;
    setState((current) => ({ ...current, error: null, status: 'loading' }));
    fetcherRef.current()
      .then((data) => {
        if (active) setState({ data, error: null, status: 'success' });
      })
      .catch((error) => {
        if (active) setState((current) => ({ ...current, error, status: 'error' }));
      });
    return () => {
      active = false;
    };
  }, [enabled, keyId, revision]);

  useEffect(() => {
    const invalidate = (event) => {
      const invalidatedKey = serializeKey(event.detail?.key);
      if (invalidatedKey === keyId) setRevision((current) => current + 1);
    };
    window.addEventListener('lms:query-invalidate', invalidate);
    return () => window.removeEventListener('lms:query-invalidate', invalidate);
  }, [keyId]);

  useEffect(() => {
    if (!enabled || !refetchInterval) return undefined;
    const intervalId = window.setInterval(() => setRevision((current) => current + 1), refetchInterval);
    return () => window.clearInterval(intervalId);
  }, [enabled, refetchInterval]);

  return { ...state, refetch };
}
