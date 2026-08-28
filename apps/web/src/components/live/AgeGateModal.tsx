'use client';

import { useState } from 'react';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';

type Props = {
  onConfirmed: () => void;
};

export function AgeGateModal({ onConfirmed }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true);
    setError('');
    try {
      await api.post('/users/me/mature-content/acknowledge');
      onConfirmed();
    } catch {
      setError('Could not save confirmation. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-panel flex aspect-video flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-medium">Age-restricted content</p>
      <p className="max-w-md text-sm text-on-surface-variant">
        This live session may include mature content. Confirm you are 18 or older to continue.
      </p>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <Button
        type="button"
        variant="primary"
        disabled={loading}
        onClick={() => void confirm()}
        className="py-2"
      >
        {loading ? 'Saving…' : 'I am 18 or older'}
      </Button>
    </div>
  );
}
