'use client';

import dynamic from 'next/dynamic';
import { useMiniPlayer } from '@/lib/miniplayer';

const LazyDock = dynamic(() => import('./MiniPlayerDock').then((m) => m.MiniPlayerDock), {
  ssr: false,
});

/**
 * MiniPlayerDock statically imports hls.js, which otherwise ships in every
 * page's bundle since the Dock is mounted app-wide in providers.tsx. Only
 * import (and mount) it once a miniplayer session actually exists -- most
 * page loads never open one.
 */
export function MiniPlayerDockLazy() {
  const { session } = useMiniPlayer();
  if (!session) return null;
  return <LazyDock />;
}
