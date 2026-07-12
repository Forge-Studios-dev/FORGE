'use client';

import { useEffect, type ReactNode } from 'react';

/** Base modal shell — escape-to-close, click-outside-to-close, focus-visible on open. Compose with your own header/body/footer. */
export function Dialog({
  open,
  onClose,
  labelledBy,
  size = 'md',
  role = 'dialog',
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  size?: 'sm' | 'md' | 'lg';
  role?: 'dialog' | 'alertdialog';
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`glass-panel shadow-xl w-full ${widths[size]} rounded-2xl p-6 forge-fade-in`}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  );
}
