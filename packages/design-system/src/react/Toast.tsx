'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type ToastVariant = 'default' | 'success' | 'warning' | 'critical';

type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms before auto-dismiss; 0 disables auto-dismiss (use for toasts with an action the user must act on). */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type ToastEntry = ToastOptions & { id: number };

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

const VARIANT_ICON: Record<ToastVariant, string> = {
  default: 'info',
  success: 'check_circle',
  warning: 'warning',
  critical: 'error',
};

const VARIANT_COLOR: Record<ToastVariant, string> = {
  default: 'text-secondary',
  success: 'text-success',
  warning: 'text-warning',
  critical: 'text-critical',
};

/** Mount once near the app root. Descendants call `useToast()` to fire toasts — including the
 * "N items updated — Undo" pattern for bulk actions instead of a blocking `window.confirm`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = idRef.current++;
      setToasts((current) => [...current, { ...options, id }]);
      const duration = options.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === 'critical' ? 'alert' : 'status'}
            className="glass-panel shadow-lg pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl p-4 forge-fade-in"
          >
            <Icon name={VARIANT_ICON[t.variant ?? 'default']} className={`text-xl ${VARIANT_COLOR[t.variant ?? 'default']}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-on-surface">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-xs text-on-surface-variant">{t.description}</p> : null}
            </div>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 text-sm font-semibold text-primary hover:opacity-80"
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-on-surface-variant hover:text-on-surface"
            >
              <Icon name="close" className="text-base" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  return useMemo(() => {
    if (!toast) {
      throw new Error('useToast() must be called within a <ToastProvider>');
    }
    return { toast };
  }, [toast]);
}
