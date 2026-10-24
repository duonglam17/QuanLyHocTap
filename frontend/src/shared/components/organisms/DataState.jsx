import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { Skeleton } from '../atoms/Skeleton.jsx';

export function DataState({
  query,
  isEmpty = (data) => data == null,
  empty = {},
  loading = <Skeleton className="h-24 w-full" />,
  children
}) {
  function retry() {
    const result = query.refetch();
    if (result && typeof result.catch === 'function') result.catch(() => undefined);
  }

  if (query.status === 'loading') return loading;
  if (query.status === 'error') {
    return (
      <ErrorState
        message={query.error?.message || 'Đã xảy ra lỗi.'}
        onRetry={retry}
      />
    );
  }
  if (isEmpty(query.data)) {
    return (
      <EmptyState
        title={empty.title}
        description={empty.description}
        action={empty.action}
      />
    );
  }
  return typeof children === 'function' ? children(query.data) : children;
}
