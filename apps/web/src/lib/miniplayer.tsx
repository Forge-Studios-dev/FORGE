'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type MiniPlayerSession = {
  videoId: string;
  title: string;
  hlsUrl: string;
  thumbnailUrl?: string | null;
  seconds: number;
};

type MiniPlayerContextValue = {
  session: MiniPlayerSession | null;
  open: (session: MiniPlayerSession) => void;
  close: () => void;
  updateSeconds: (seconds: number) => void;
};

const MiniPlayerContext = createContext<MiniPlayerContextValue | null>(null);

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MiniPlayerSession | null>(null);

  const open = useCallback((next: MiniPlayerSession) => {
    setSession({
      ...next,
      seconds: Math.max(0, Math.floor(next.seconds)),
    });
  }, []);

  const close = useCallback(() => setSession(null), []);

  const updateSeconds = useCallback((seconds: number) => {
    setSession((prev) =>
      prev ? { ...prev, seconds: Math.max(0, Math.floor(seconds)) } : prev,
    );
  }, []);

  const value = useMemo(
    () => ({ session, open, close, updateSeconds }),
    [session, open, close, updateSeconds],
  );

  return <MiniPlayerContext.Provider value={value}>{children}</MiniPlayerContext.Provider>;
}

export function useMiniPlayer() {
  const ctx = useContext(MiniPlayerContext);
  if (!ctx) throw new Error('useMiniPlayer must be used within MiniPlayerProvider');
  return ctx;
}
