import { getAvatarColor, getAvatarBg } from '@/utils/colors';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  color?: string;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

export default function Avatar({ name, size = 'md', color, className = '' }: AvatarProps) {
  const avatarColor = color || getAvatarColor(name);
  const avatarBg = getAvatarBg(name, 0.2);
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full flex items-center justify-center font-semibold
        select-none shrink-0
        ${className}
      `}
      style={{
        backgroundColor: avatarBg,
        color: avatarColor,
        boxShadow: `0 0 12px ${avatarBg}`,
      }}
    >
      {initial}
    </div>
  );
}
