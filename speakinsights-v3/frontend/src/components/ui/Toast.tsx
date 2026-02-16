import toast, { type ToastOptions } from 'react-hot-toast';

const baseStyle: React.CSSProperties = {
  background: 'rgba(30, 41, 59, 0.95)',
  backdropFilter: 'blur(24px)',
  color: 'rgba(255, 255, 255, 0.9)',
  borderRadius: '12px',
  fontSize: '14px',
  padding: '12px 16px',
};

const baseOptions: ToastOptions = {
  duration: 4000,
  position: 'bottom-right',
};

export const glassToast = {
  success: (message: string) =>
    toast.success(message, {
      ...baseOptions,
      style: {
        ...baseStyle,
        border: '1px solid rgba(34, 211, 238, 0.3)',
        boxShadow: '0 0 20px rgba(34, 211, 238, 0.1)',
      },
      iconTheme: {
        primary: '#22D3EE',
        secondary: '#0F172A',
      },
    }),

  error: (message: string) =>
    toast.error(message, {
      ...baseOptions,
      duration: 5000,
      style: {
        ...baseStyle,
        border: '1px solid rgba(239, 68, 68, 0.3)',
        boxShadow: '0 0 20px rgba(239, 68, 68, 0.1)',
      },
      iconTheme: {
        primary: '#EF4444',
        secondary: '#0F172A',
      },
    }),

  info: (message: string) =>
    toast(message, {
      ...baseOptions,
      style: {
        ...baseStyle,
        border: '1px solid rgba(167, 139, 250, 0.3)',
        boxShadow: '0 0 20px rgba(167, 139, 250, 0.1)',
      },
      icon: 'ℹ️',
    }),

  loading: (message: string) =>
    toast.loading(message, {
      ...baseOptions,
      style: {
        ...baseStyle,
        border: '1px solid rgba(255, 255, 255, 0.15)',
      },
    }),
};
