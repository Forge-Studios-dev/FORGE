'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export type AccessSessionType = 'playback' | 'live' | 'course' | 'community';

type SessionState = {
  sessionToken: string;
  heartbeatIntervalSec: number;
};

const STORAGE_KEY = 'forge_access_session_token';

export function useAccessSession(
  sessionType: AccessSessionType,
  resourceId: string | null | undefined,
  enabled: boolean,
  creatorId?: string | null,
) {
  const [ready, setReady] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const sessionRef = useRef<SessionState | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const heartbeat = useCallback(async (token: string) => {
    try {
      await api.post('/access-sessions/heartbeat', { sessionToken: token });
    } catch {
      /* session expired — will restart on next effect */
    }
  }, []);

  const startSession = useCallback(
    async (force = false) => {
      if (!resourceId || !enabled) return;
      try {
        const { data } = await api.post<{
          data: { sessionToken: string; heartbeatIntervalSec: number; maxDevices?: number };
        }>('/access-sessions/start', {
          sessionType,
          resourceId,
          force,
          ...(creatorId ? { creatorId } : {}),
        });
        const payload = data.data;
        sessionRef.current = {
          sessionToken: payload.sessionToken,
          heartbeatIntervalSec: payload.heartbeatIntervalSec,
        };
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(STORAGE_KEY, payload.sessionToken);
        }
        setConflict(null);
        setReady(true);

        clearHeartbeat();
        intervalRef.current = setInterval(
          () => heartbeat(payload.sessionToken),
          payload.heartbeatIntervalSec * 1000,
        );
      } catch (err) {
        const code =
          err &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { data?: { code?: string; message?: string } } }).response?.data
            ?.code;
        if (code === 'concurrent_session' || code === 'device_limit') {
          setConflict(
            code === 'device_limit'
              ? 'Device limit reached for your membership. Take over this session?'
              : 'Another active session exists. Take over this session?',
          );
          setReady(false);
        }
      }
    },
    [resourceId, enabled, sessionType, creatorId, clearHeartbeat, heartbeat],
  );

  const takeOver = useCallback(() => startSession(true), [startSession]);

  useEffect(() => {
    if (!enabled || !resourceId) {
      setReady(false);
      return;
    }
    void startSession(false);
    return () => {
      clearHeartbeat();
      const token = sessionRef.current?.sessionToken;
      if (token) {
        void api.delete('/access-sessions/current', { data: { sessionToken: token } }).catch(() => {});
      }
    };
  }, [enabled, resourceId, startSession, clearHeartbeat]);

  return { ready, conflict, takeOver };
}
