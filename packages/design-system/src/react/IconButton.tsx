import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

type Size = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const ICON_CLASS: Record<Size, string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
};

export function IconButton({
  icon,
  label,
  filled,
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: string;
  /** Accessible name — required for icon-only buttons */
  label: string;
  filled?: boolean;
  size?: Size;
  children?: ReactNode;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={props.title ?? label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest/50 hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASS[size]} ${className}`}
      {...props}
    >
      {children ?? (icon ? <Icon name={icon} filled={filled} className={ICON_CLASS[size]} /> : null)}
    </button>
  );
}
