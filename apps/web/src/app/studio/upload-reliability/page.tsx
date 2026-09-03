'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Icon, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';
import { getActiveUpload, subscribeActiveUpload, type ActiveUploadMeta } from '@/lib/upload-manager';

const PHASES = [
  { id: 'checksum', label: 'Checksum / prepare', detail: 'File validated and upload slot reserved.' },
  { id: 'chunks', label: 'Chunked transfer', detail: 'Parts upload concurrently with checkpointing.' },
  { id: 'verify', label: 'Upload verification', detail: 'Completed parts reconciled against server progress.' },
  { id: 'assemble', label: 'Server assemble', detail: 'Multipart complete assembles the object for processing.' },
  { id: 'process', label: 'Transcoding queue', detail: 'Mux/VOD pipeline starts after finalize.' },
] as const;

export default function StudioUploadReliabilityPage() {
  const [active, setActive] = useState<ActiveUploadMeta | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  useEffect(() => {
    setActive(getActiveUpload());
    return subscribeActiveUpload(setActive);
  }, []);

  const multipart = active?.multipart;
  const completed = multipart?.completedParts ?? 0;
  const total = multipart?.partCount ?? 0;

  async function clearStuckUploads() {
    if (clearing) return;
    if (!window.confirm('Release incomplete uploads that appear stuck so you can start fresh?')) {
      return;
    }
    setClearing(true);
    setClearMsg(null);
    try {
      await api.post('/videos/release-stuck-uploads');
      setClearMsg('Stuck uploads cleared.');
    } catch (e: unknown) {
      setClearMsg(getApiErrorMessage(e, 'Could not clear stuck uploads.'));
    } finally {
      setClearing(false);
    }
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Upload reliability"
        subtitle="How FORGE keeps large video uploads resumable, checkpointed, and recoverable."
      />

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-label-caps text-xs text-outline">Live status</p>
            <h2 className="mt-1 text-lg font-semibold">
              {active ? 'Upload in progress' : 'No active multipart upload'}
            </h2>
          </div>
          <StatusPill
            tone={active ? 'warning' : 'neutral'}
            label={active?.uploadVia === 'multipart' ? 'Resumable multipart' : active ? active.phase : 'Idle'}
          />
        </div>

        {active ? (
          <>
            <p className="text-sm text-on-surface-variant">
              {active.fileName} · {active.progress}% complete
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full bg-tertiary transition-all" style={{ width: `${active.progress}%` }} />
            </div>
            {multipart ? (
              <p className="text-sm text-on-surface">
                Chunks {completed} of {total} uploaded
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/studio/videos" className="text-primary hover:underline">
                Track in Videos
              </Link>
              <Link href="/upload/step/3" className="text-primary hover:underline">
                Return to upload flow
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Start a video upload from Create. Files above the multipart threshold use resumable chunked upload with
            server checkpoints so unstable networks can recover safely.
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {PHASES.map((phase, index) => (
          <article key={phase.id} className="glass-panel rounded-2xl p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="font-semibold">{phase.label}</h3>
            </div>
            <p className="text-sm text-on-surface-variant">{phase.detail}</p>
          </article>
        ))}
      </section>

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <Icon name="wifi_tethering" className="mt-0.5 text-secondary" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Recovery tips</h2>
            <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
              <li>Leave Studio open or return later — multipart progress is checkpointed.</li>
              <li>Use Clear stuck uploads below (or in Videos) if a transfer is abandoned.</li>
              <li>Offline and slow-network banners appear automatically while you work.</li>
              <li>Metadata is autosaved in the upload draft before finalize.</li>
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => void clearStuckUploads()} disabled={clearing}>
                {clearing ? 'Clearing…' : 'Clear stuck uploads'}
              </Button>
              <Link href="/upload" className="text-sm text-primary hover:underline">
                Start an upload
              </Link>
              <Link href="/studio/videos" className="text-sm text-primary hover:underline">
                Open Videos
              </Link>
            </div>
            {clearMsg ? <p className="mt-3 text-sm text-on-surface-variant">{clearMsg}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
