import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function toast(options: ToastOptions) {
  const { title, description, variant } = options;
  
  const message = title || description || '';
  const fullDescription = title && description ? description : undefined;
  
  if (variant === 'destructive') {
    return sonnerToast.error(message, {
      description: fullDescription,
    });
  }
  
  return sonnerToast(message, {
    description: fullDescription,
  });
}
