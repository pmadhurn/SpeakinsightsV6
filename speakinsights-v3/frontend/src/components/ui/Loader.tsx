import { Loader2 } from 'lucide-react';

type LoaderSize = 'sm' | 'md' | 'lg';

interface LoaderProps {
  size?: LoaderSize;
  text?: string;
  className?: string;
}

const sizeMap: Record<LoaderSize, number> = {
  sm: 16,
  md: 24,
  lg: 36,
};

export default function Loader({ size = 'md', text, className = '' }: LoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2
        className="animate-spin text-cyan"
        size={sizeMap[size]}
      />
      {text && (
        <p className="text-sm text-white/50 animate-pulse">{text}</p>
      )}
    </div>
  );
}
