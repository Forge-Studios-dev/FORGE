'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import {
  abortActiveUpload,
  getActiveUpload,
  isUploadInFlight,
  subscribeActiveUpload,
  type ActiveUploadMeta,
} from '@/lib/upload-manager';

const PHASE_LABEL: Record<ActiveUploadMeta['phase'], string> = {
  presigning: 'Preparing upload…',
  uploading: 'Uploading to storage…',
  completing: 'Finalizing video…',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function UploadProgressBanner() {
  const [active, setActive] = useState<ActiveUploadMeta | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    setActive(getActiveUpload());
    return subscribeActiveUpload(setActive);
  }, []);

  useEffect(() => {
    if (!active || active.phase === 'completing') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const etaLabel = useMemo(() => {
    if (!active || active.phase !== 'uploading' || active.progress <= 0) return null;
    const elapsedMs = Math.max(1, now - new Date(active.startedAt).getTime());
    const totalMs = elapsedMs / (active.progress / 100);
    const remainingSec = Math.max(0, Math.round((totalMs - elapsedMs) / 1000));
    if (remainingSec < 60) return `~${remainingSec}s remaining`;
    return `~${Math.ceil(remainingSec / 60)}m remaining`;
  }, [active, now]);

  if (!active && !isUploadInFlight()) return null;
  if (!active) return null;

  const isMultipart = active.uploadVia === 'multipart' && !!active.multipart;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 rounded-2xl border border-tertiary/40 bg-tertiary/10 px-4 py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface">
            {PHASE_LABEL[active.phase]}
            {active.phase === 'uploading' ? ` — ${active.progress}%` : ''}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {active.fileName}
            {active.title ? ` · ${active.title}` : ''}
            {etaLabel ? ` · ${etaLabel}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Link href="/studio/videos" className="font-semibold text-primary hover:underline">
            Open videos
          </Link>
          <Link href="/upload/step/3" className="font-semibold text-primary hover:underline">
            Upload flow
          </Link>
          {active.phase === 'uploading' || active.phase === 'presigning' ? (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="font-semibold text-error hover:underline"
            >
              Cancel upload
            </button>
          ) : null}
        </div>
      </div>

      {active.phase === 'uploading' ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full bg-tertiary transition-all"
            style={{ width: `${active.progress}%` }}
          />
        </div>
      ) : null}

      {isMultipart && active.multipart ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-outline">Chunks</p>
            <p className="mt-1 text-sm font-medium">
              {active.multipart.completedParts} / {active.multipart.partCount}
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-outline">Part size</p>
            <p className="mt-1 text-sm font-medium">{formatBytes(active.multipart.partSize)}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-outline">File size</p>
            <p className="mt-1 text-sm font-medium">{formatBytes(active.multipart.fileSizeBytes)}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-outline">Mode</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium">
              <Icon name="cloud_sync" className="text-base text-tertiary" />
              Resumable multipart
            </p>
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-on-surface-variant">
        {isMultipart
          ? 'Safe to leave this page — chunk progress is checkpointed and can resume later if the connection drops.'
          : 'You can leave this page; upload continues in the background.'}
      </p>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel upload?"
        description="This stops the current upload and frees the slot."
        confirmLabel="Cancel upload"
        onConfirm={() => {
          abortActiveUpload();
          setCancelOpen(false);
        }}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
