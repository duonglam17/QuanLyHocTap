import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Spinner({ className, size = 'default' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-10 w-10',
  };

  return (
    <Loader2
      className={cn('animate-spin text-primary', sizeClasses[size] || sizeClasses.default, className)}
      aria-label="Đang tải dữ liệu"
    />
  );
}

