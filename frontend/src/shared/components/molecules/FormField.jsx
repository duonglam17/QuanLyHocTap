import React from 'react';
import { Input } from '../atoms/Input';
import { cn } from '../../lib/utils';

export function FormField({
  id,
  label,
  error,
  helperText,
  required = false,
  className,
  inputProps = {},
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium leading-none text-foreground">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </label>
      )}
      <Input id={id} hasError={Boolean(error)} aria-invalid={Boolean(error)} {...inputProps} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}

