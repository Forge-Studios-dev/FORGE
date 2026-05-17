import { useEffect } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div
        className="glass-panel w-full max-w-md rounded-2xl p-6 forge-fade-in"
        role="alertdialog"
        aria-labelledby="confirm-title"
      >
        <div className="mb-4 flex items-start gap-3">
          <Icon
            name={variant === 'danger' ? 'warning' : 'info'}
            className={`text-2xl ${variant === 'danger' ? 'text-error' : 'text-primary'}`}
          />
          <div>
            <h2 id="confirm-title" className="font-display-forge text-lg font-semibold">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-on-surface-variant">{description}</p> : null}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'primary' : 'primary'}
            className={variant === 'danger' ? 'bg-error text-on-error hover:opacity-90' : ''}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
