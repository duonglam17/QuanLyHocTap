import { toast as sonnerToast } from 'sonner';

export const toast = {
  success: (message, options) => sonnerToast.success(message, options),
  error: (message, options) => sonnerToast.error(message, options),
  message: (message, options) => sonnerToast(message, options)
};
