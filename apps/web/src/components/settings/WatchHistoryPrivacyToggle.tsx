'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  isWatchHistoryPaused,
  setWatchHistoryPaused,
} from '@/lib/watch-history-prefs';

/** Syncs account privacy.watchHistoryPaused with a local fast-path for the player. */
export function WatchHistoryPrivacyToggle() {
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<{ data: { watchHistoryPaused: boolean } }>(
          '/users/me/privacy',
        );
        const next = !!data.data.watchHistoryPaused;
        if (!cancelled) {
          setPaused(next);
          setWatchHistoryPaused(next);
        }
      } catch {
        if (!cancelled) {
          setPaused(isWatchHistoryPaused());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = async (next: boolean) => {
    setError('');
    setPaused(next);
    setWatchHistoryPaused(next);
    setSaving(true);
    try {
      await api.put('/users/me/privacy', { watchHistoryPaused: next });
    } catch {
      setPaused(!next);
      setWatchHistoryPaused(!next);
      setError('Could not update privacy setting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={paused}
          disabled={loading || saving}
          onChange={(e) => void onToggle(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-on-surface">Pause watch history</span>
          <span className="mt-0.5 block text-xs text-on-surface-variant">
            New watches won’t be saved to History. View counts still work. Syncs across devices when
            signed in.
          </span>
        </span>
      </label>
      {error ? (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
