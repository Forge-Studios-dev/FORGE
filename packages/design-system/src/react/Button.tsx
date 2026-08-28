import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';

const BUTTON_BASE =
  'inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const BUTTON_VARIANTS: Record<Variant, string> = {
  primary: 'primary-button text-on-primary',
  secondary: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
  ghost: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50',
  outline: 'border border-outline-variant text-on-surface hover:border-primary',
};

/** Full Button class string (base + variant) for Links and other non-button elements. */
export function buttonClassName(variant: Variant = 'primary'): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]}`;
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button type={type} className={`${buttonClassName(variant)} ${className}`} {...props}>
      {children}
    </button>
  );
}
