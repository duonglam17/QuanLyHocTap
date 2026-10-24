import { Skeleton } from '../atoms/Skeleton.jsx';

export function LoadingState({ message = 'Đang tải dữ liệu...' }) {
  return (
    <div aria-live="polite" className="grid gap-3" role="status">
      <span className="sr-only">{message}</span>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
