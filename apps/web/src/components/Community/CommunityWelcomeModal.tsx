'use client';

import { useEffect, useState } from 'react';
import { Button } from '@forge/design-system';
import { Dialog } from '@forge/design-system/client';

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

  const dismiss = () => {
    sessionStorage.setItem(`forge-community-welcome-${communityName}`, '1');
    setOpen(false);
    onDismiss();
  };

  return (
    <Dialog open={open} onClose={dismiss} labelledBy="community-welcome-title" size="sm">
      <h2 id="community-welcome-title" className="text-lg font-semibold">
        Welcome to {communityName}
      </h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        You now have member access. Explore posts, polls, text and voice rooms, and events from the
        community tabs.
      </p>
      <Button className="mt-4 w-full" onClick={dismiss}>
        Start exploring
      </Button>
    </Dialog>
  );
}
