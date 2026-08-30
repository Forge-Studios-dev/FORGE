'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@forge/design-system';
import { ReportReason } from '@forge/shared-types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthGateModal } from '@/components/gates/AuthGateModal';
import { VIDEO_REPORT_REASONS, COMMENT_REPORT_REASONS } from '@/lib/report-reasons';

type Props = {
  targetType: 'video' | 'user' | 'comment';
  targetId: string;
  className?: string;
  /** e.g. menuitem when rendered inside PopoverMenu */
  role?: string;
};

export function ReportContentButton({ targetType, targetId, className, role }: Props) {
  const { isGuest } = useAuth();
  const [authGate, setAuthGate] = useState(false);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState('');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets = targetType === 'comment' ? COMMENT_REPORT_REASONS : VIDEO_REPORT_REASONS;
  const isCopyrightVideo =
    targetType === 'video' && preset === ReportReason.COPYRIGHT_INFRINGEMENT;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const submit = useMutation({
    mutationFn: async () => {
      const reason =
        preset === 'Other'
          ? details.trim() || 'Other'
          : details.trim()
            ? `${preset}: ${details.trim()}`
            : preset;
      if (reason.trim().length < 3) {
        throw new Error('Please choose a reason');
      }
      await api.post('/reports', {
        targetType,
        targetId,
        reason: reason.slice(0, 2000),
        ...(preset ? { reasonCategory: preset } : {}),
      });
    },
    onSuccess: () => {
      setDone(true);
      setOpen(false);
      setPreset('');
      setDetails('');
      setError(null);
    },
    onError: () => setError('Could not submit report. Try again.'),
  });

  const handleClick = () => {
    if (isGuest) {
      setAuthGate(true);
      return;
    }
    setOpen(true);
    setError(null);
  };

  const canSubmit =
    !isCopyrightVideo &&
    preset.length > 0 &&
    (preset !== 'Other' || details.trim().length >= 3) &&
    !submit.isPending;

  return (
    <>
      <button
        type="button"
        role={role}
        onClick={handleClick}
        className={className ?? 'text-sm text-on-surface-variant hover:text-error'}
      >
        {done ? 'Reported' : 'Report'}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-content-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-panel w-full max-w-md rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="report-content-title" className="font-display-forge text-lg font-semibold">
              Report content
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Select a reason. Our team will review this report.
            </p>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Reason</legend>
              {presets.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    preset === r
                      ? 'border-primary bg-primary/10 text-on-surface'
                      : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={preset === r}
                    onChange={() => setPreset(r)}
                    className="accent-primary"
                  />
                  {r}
                </label>
              ))}
            </fieldset>
            {isCopyrightVideo ? (
              <div className="mt-4 space-y-3 rounded-lg border border-outline-variant/30 bg-surface-container-high/50 p-4 text-sm">
                <p className="text-on-surface">
                  Copyright claims use a separate DMCA notice form. A content report will not take
                  the video down.
                </p>
                <Link
                  href={`/copyright/notice?videoId=${encodeURIComponent(targetId)}`}
                  className="inline-flex text-sm font-semibold text-primary hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Open copyright notice form →
                </Link>
              </div>
            ) : (
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                className="mt-4 w-full rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-2 text-sm"
                placeholder={
                  preset === 'Other' ? 'Describe the issue (required)…' : 'Optional details…'
                }
              />
            )}
            {error ? (
              <p className="mt-2 text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 text-sm text-on-surface-variant"
              >
                Cancel
              </button>
              {!isCopyrightVideo ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={!canSubmit}
                  onClick={() => submit.mutate()}
                  className="px-5 py-2"
                >
                  {submit.isPending ? 'Submitting…' : 'Submit report'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <AuthGateModal open={authGate} onClose={() => setAuthGate(false)} message="Sign in to report content." />
    </>
  );
}
