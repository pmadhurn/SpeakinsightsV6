import { motion } from 'framer-motion';
import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface GlassButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  fullWidth?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-cyan/20 text-cyan border border-cyan/30 hover:bg-cyan/30 hover:border-cyan/50 shadow-glow-cyan hover:shadow-glow-cyan-lg',
  secondary:
    'bg-lavender/20 text-lavender border border-lavender/30 hover:bg-lavender/30 hover:border-lavender/50 shadow-glow-lavender hover:shadow-glow-lavender-lg',
  ghost:
    'bg-transparent text-white/80 border border-white/10 hover:bg-white/10 hover:border-white/20',
  danger:
    'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-5 py-2.5 text-sm gap-2 rounded-glass',
  lg: 'px-7 py-3.5 text-base gap-2.5 rounded-glass-lg',
};

export default function GlassButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  fullWidth = false,
  className = '',
  ...props
}: GlassButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      className={`
        inline-flex items-center justify-center font-medium
        backdrop-blur-glass transition-all duration-200
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      disabled={isDisabled}
      whileHover={isDisabled ? {} : { scale: 1.02 }}
      whileTap={isDisabled ? {} : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      {...(props as any)}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />
      ) : null}
      {children}
    </motion.button>
  );
}
