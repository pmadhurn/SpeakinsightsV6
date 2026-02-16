import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

type GlassVariant = 'default' | 'heavy' | 'surface' | 'gradient';
type GlowType = 'none' | 'cyan' | 'lavender';
type Padding = 'none' | 'sm' | 'md' | 'lg';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: GlassVariant;
  shimmer?: boolean;
  glow?: GlowType;
  onClick?: () => void;
  padding?: Padding;
}

const variantClasses: Record<GlassVariant, string> = {
  default: 'glass',
  heavy: 'glass-heavy',
  surface: 'glass-surface',
  gradient: 'glass-gradient-border',
};

const glowClasses: Record<GlowType, string> = {
  none: '',
  cyan: 'glow-cyan',
  lavender: 'glow-lavender',
};

const paddingClasses: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
};

export default function GlassCard({
  children,
  className = '',
  variant = 'default',
  shimmer = false,
  glow = 'none',
  onClick,
  padding = 'md',
}: GlassCardProps) {
  const classes = [
    variantClasses[variant],
    glowClasses[glow],
    paddingClasses[padding],
    shimmer ? 'glass-shimmer' : '',
    onClick ? 'cursor-pointer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <motion.div
        className={classes}
        onClick={onClick}
        whileHover={{ scale: 1.01, y: -2 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {children}
      </motion.div>
    );
  }

  return <div className={classes}>{children}</div>;
}
