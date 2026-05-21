'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getActiveUpload,
  isUploadInFlight,
  subscribeActiveUpload,
  type ActiveUploadMeta,
} from '@/lib/upload-manager';

const PHASE_LABEL: Record<ActiveUploadMeta['phase'], string> = {
  presigning: 'Preparing upload…',
  uploading: 'Uploading to storage…',
  completing: 'Finalizing lesson…',
};

export function UploadProgressBanner() {
  const [active, setActive] = useState<ActiveUploadMeta | null>(null);

  useEffect(() => {
    setActive(getActiveUpload());
    return subscribeActiveUpload(setActive);
  }, []);

  if (!active && !isUploadInFlight()) return null;
  if (!active) return null;

  return (
    <div className="mb-6 rounded-xl border border-tertiary/40 bg-tertiary/10 px-4 py-3">
      <p className="text-sm font-medium text-on-surface">
        {PHASE_LABEL[active.phase]}
        {active.phase === 'uploading' ? ` — ${active.progress}%` : ''}
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">
        {active.fileName}
        {active.title ? ` · ${active.title}` : ''}. You can leave this page; upload continues in the
        background. Track status below or on the upload screen.
      </p>
      {active.phase === 'uploading' ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full bg-tertiary transition-all"
            style={{ width: `${active.progress}%` }}
          />
        </div>
      ) : null}
      <Link href="/upload/step/3" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
        Back to upload
      </Link>
    </div>
  );
}
