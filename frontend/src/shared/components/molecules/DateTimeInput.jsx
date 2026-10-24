import { forwardRef } from 'react';
import { Input } from '../atoms/Input.jsx';

export const DateTimeInput = forwardRef(function DateTimeInput(props, ref) {
  return <Input ref={ref} type="datetime-local" {...props} />;
});
