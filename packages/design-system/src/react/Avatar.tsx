import type { ImgHTMLAttributes } from 'react';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-2xl',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function Avatar({
  src,
  name = '',
  size = 'md',
  className = '',
  alt,
  ...props
}: {
  src?: string | null;
  name?: string;
  size?: Size;
  className?: string;
  alt?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'>) {
  const sizeClass = SIZE_CLASS[size];
  const label = alt ?? (name ? `${name} avatar` : 'Avatar');

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={`inline-block shrink-0 rounded-full object-cover bg-surface-container-high ${sizeClass} ${className}`}
        {...props}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-surface-container-highest font-semibold text-on-surface ${sizeClass} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
