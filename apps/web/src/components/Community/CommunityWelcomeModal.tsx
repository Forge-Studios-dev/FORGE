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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sessionStorage.setItem(`forge-community-welcome-${communityName}`, '1');
        setOpen(false);
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, communityName, onDismiss]);

  if (!open) return null;

  const dismiss = () => {
    sessionStorage.setItem(`forge-community-welcome-${communityName}`, '1');
    setOpen(false);
    onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-welcome-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="community-welcome-title" className="text-lg font-semibold">
          Welcome to {communityName}
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          You now have member access. Explore posts, polls, text and voice rooms, and events from
          the community tabs.
        </p>
        <Button className="mt-4 w-full" onClick={dismiss}>
          Start exploring
        </Button>
      </div>
    </div>
  );
}
