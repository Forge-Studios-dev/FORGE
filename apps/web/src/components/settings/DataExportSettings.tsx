'use client';

import { useState } from 'react';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';

/** DSAR-style download of the signed-in user's account data as JSON. */
export function DataExportSettings() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const download = async () => {
    setError('');
    setDone(false);
    setPending(true);
    try {
      const { data } = await api.get<{ data: Record<string, unknown> }>('/users/me/export');
      const payload = data.data ?? data;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forge-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not export your data. Try again.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="glass-panel mt-8 rounded-2xl p-6">
      <h2 className="font-display-forge text-lg font-semibold">Download your data</h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Get a JSON copy of your profile, videos, playlists, watch history, comments, community
        posts, and account strikes. Chat messages and analytics events are not included.
      </p>
      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        disabled={pending}
        onClick={() => void download()}
      >
        {pending ? 'Preparing…' : 'Download JSON'}
      </Button>
      {done ? (
        <p className="mt-2 text-sm text-secondary" role="status">
          Download started.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
