import { cn } from '../../lib/utils.js';

export function Form({ className, ...props }) {
  return <form className={cn('grid gap-4', className)} {...props} />;
}
