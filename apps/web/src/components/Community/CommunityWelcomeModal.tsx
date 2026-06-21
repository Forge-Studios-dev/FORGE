'use client';

import { useEffect, useState } from 'react';
import { Button } from '@forge/design-system';

interface Props {
  communityName: string;
  onDismiss: () => void;
}

export function CommunityWelcomeModal({ communityName, onDismiss }: Props) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const key = `forge-community-welcome-${communityName}`;
    if (sessionStorage.getItem(key)) {
      setOpen(false);
    }
  }, [communityName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Welcome to {communityName}</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          You now have member access. Explore channels, join challenges, and connect in voice or text
          rooms from the Engage tab.
        </p>
        <Button
          className="mt-4 w-full"
          onClick={() => {
            sessionStorage.setItem(`forge-community-welcome-${communityName}`, '1');
            setOpen(false);
            onDismiss();
          }}
        >
          Start exploring
        </Button>
      </div>
    </div>
  );
}
