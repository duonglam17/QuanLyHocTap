import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export function Spinner({ className, label = 'Đang xử lý' }) {
  return (
    <LoaderCircle
      className={cn('size-4 animate-spin', className)}
      role="status"
      aria-label={label}
    />
  );
}
