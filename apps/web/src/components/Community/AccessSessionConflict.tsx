'use client';

import { Button } from '@forge/design-system';

export function AccessSessionConflict({
  message,
  onTakeOver,
}: {
  message: string;
  onTakeOver: () => void;
}) {
  return (
    <div className="glass-panel flex flex-col items-center gap-3 rounded-xl p-6 text-center">
      <p className="text-sm font-medium">Active session on another device</p>
      <p className="text-sm text-on-surface-variant">{message}</p>
      <Button onClick={onTakeOver}>Use this device</Button>
    </div>
  );
}
