import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';

export function Button({
  variant = 'primary',
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  const base =
    'inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<Variant, string> = {
    primary: 'primary-button text-on-primary',
    secondary: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
    ghost: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50',
    outline: 'border border-outline-variant text-on-surface hover:border-primary',
  };
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
