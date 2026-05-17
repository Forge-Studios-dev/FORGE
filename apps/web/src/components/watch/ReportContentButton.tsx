'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthGateModal } from '@/components/gates/AuthGateModal';

type Props = {
  targetType: 'video' | 'user' | 'comment';
  targetId: string;
};

export function ReportContentButton({ targetType, targetId }: Props) {
  const { isGuest } = useAuth();
  const [authGate, setAuthGate] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      await api.post('/reports', {
        targetType,
        targetId,
        reason: reason.trim() || 'Reported by user',
      });
    },
    onSuccess: () => {
      setDone(true);
      setOpen(false);
      setReason('');
    },
  });

  const handleClick = () => {
    if (isGuest) {
      setAuthGate(true);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="text-sm text-on-surface-variant hover:text-error"
      >
        {done ? 'Reported' : 'Report'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" role="dialog">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display-forge text-lg font-semibold">Report content</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Tell us why this content should be reviewed. Our team will investigate.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-2 text-sm"
              placeholder="Reason (optional)"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 text-sm text-on-surface-variant"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submit.isPending}
                onClick={() => submit.mutate()}
                className="primary-button rounded-full px-5 py-2 text-sm font-semibold text-on-primary"
              >
                {submit.isPending ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}
      <AuthGateModal open={authGate} onClose={() => setAuthGate(false)} message="Sign in to report content." />
    </>
  );
}
