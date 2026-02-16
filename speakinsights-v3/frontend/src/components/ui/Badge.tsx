type BadgeVariant = 'cyan' | 'lavender' | 'green' | 'red' | 'yellow' | 'gray';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  cyan: 'bg-cyan/15 text-cyan border-cyan/30',
  lavender: 'bg-lavender/15 text-lavender border-lavender/30',
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  gray: 'bg-white/10 text-white/60 border-white/20',
};

export default function Badge({ text, variant = 'cyan', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5
        text-xs font-medium rounded-full border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {text}
    </span>
  );
}
