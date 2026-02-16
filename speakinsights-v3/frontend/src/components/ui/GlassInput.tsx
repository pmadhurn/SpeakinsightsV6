import { type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

interface GlassInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  icon?: LucideIcon;
  error?: string;
  disabled?: boolean;
  textarea?: boolean;
  rows?: number;
  className?: string;
  name?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement> | TextareaHTMLAttributes<HTMLTextAreaElement>;
}

export default function GlassInput({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  icon: Icon,
  error,
  disabled = false,
  textarea = false,
  rows = 4,
  className = '',
  name,
}: GlassInputProps) {
  const inputClasses = `
    w-full bg-white/5 border rounded-glass px-4 py-3
    text-white/90 placeholder-white/30
    transition-all duration-200
    focus:outline-none focus:ring-0
    ${Icon ? 'pl-11' : ''}
    ${error
      ? 'border-red-500/50 focus:border-red-500'
      : 'border-white/10 focus:border-cyan hover:border-white/20 focus:shadow-glow-cyan'
    }
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${className}
  `;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-white/60 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
            size={16}
          />
        )}
        {textarea ? (
          <textarea
            className={inputClasses}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            rows={rows}
            name={name}
          />
        ) : (
          <input
            className={inputClasses}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            name={name}
          />
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
