'use client';

import { useId } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { Dialog } from './Dialog';

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
  const titleId = useId();

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!loading) onCancel();
      }}
      labelledBy={titleId}
      size="sm"
      role="alertdialog"
    >
      <div className="mb-4 flex items-start gap-3">
        <Icon
          name={variant === 'danger' ? 'warning' : 'info'}
          className={`text-2xl ${variant === 'danger' ? 'text-error' : 'text-primary'}`}
        />
        <div>
          <h2 id={titleId} className="font-display-forge text-lg font-semibold">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-on-surface-variant">{description}</p> : null}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            if (!loading) onCancel();
          }}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="primary"
          className={variant === 'danger' ? 'bg-error text-on-error hover:opacity-90' : ''}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
