import { createContext, useContext } from 'react';

export interface ToastOptions {
  message: string;
  /** A button on the toast, usually "Undo" */
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  /** Milliseconds before it goes away. Longer by default when there is an action to reach. */
  duration?: number;
}

export interface ToastApi {
  toast: (options: ToastOptions) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
