'use client';

import { type CSSProperties, type ReactNode } from 'react';

type FadeInProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** Entrance fade — CSS-only, respects prefers-reduced-motion */
export function FadeIn({ children, className = '', delay = 0 }: FadeInProps) {
  const style: CSSProperties | undefined =
    delay > 0 ? ({ animationDelay: `${delay}ms` } as CSSProperties) : undefined;

  return (
    <div className={`forge-fade-in ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

type StaggerGridProps = {
  children: ReactNode;
  className?: string;
};

/** Stagger child fade-in for grids and lists */
export function StaggerGrid({ children, className = '' }: StaggerGridProps) {
  return <div className={`forge-stagger ${className}`.trim()}>{children}</div>;
}

type PageEnterProps = {
  children: ReactNode;
  className?: string;
};

/** Page-level entrance wrapper for main content areas */
export function PageEnter({ children, className = '' }: PageEnterProps) {
  return <div className={`forge-page-enter ${className}`.trim()}>{children}</div>;
}
