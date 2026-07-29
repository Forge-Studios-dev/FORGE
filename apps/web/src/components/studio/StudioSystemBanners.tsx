'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@forge/design-system';

/**
 * Runtime Studio reliability banners for offline / degraded connectivity.
 * Complements UploadProgressBanner and keeps creators oriented when network drops.
 */
export function StudioSystemBanners() {
  const [online, setOnline] = useState(true);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const syncOnline = () => setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    syncOnline();
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);

    let cancelled = false;
    const checkLatency = async () => {
      if (!navigator.onLine) {
        setSlow(false);
        return;
      }
      const started = performance.now();
      try {
        await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' });
        if (!cancelled) setSlow(performance.now() - started > 2500);
      } catch {
        if (!cancelled && navigator.onLine) setSlow(true);
      }
    };
    void checkLatency();
    const timer = window.setInterval(() => void checkLatency(), 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
    };
  }, []);

  if (online && !slow) return null;

  return (
    <div className="mb-4 space-y-3">
      {!online ? (
        <div
          role="status"
          className="flex flex-wrap items-start gap-3 rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3"
        >
          <Icon name="wifi_off" className="mt-0.5 text-critical" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-on-surface">You are offline</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Studio actions that need the network are paused. Uploads already in progress will resume when you reconnect.
            </p>
          </div>
          <Link href="/studio/videos" className="text-xs font-semibold text-primary hover:underline">
            Check videos
          </Link>
        </div>
      ) : null}

      {online && slow ? (
        <div
          role="status"
          className="flex flex-wrap items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3"
        >
          <Icon name="speed" className="mt-0.5 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-on-surface">Connection looks slow</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Large uploads may take longer. Prefer resumable uploads and avoid cancelling mid-transfer.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
