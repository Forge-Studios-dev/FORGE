'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import { Stream } from '@/types';

export const LIVE_STREAMS_QUERY_KEY = ['live-streams'] as const;
export const UPCOMING_STREAMS_QUERY_KEY = ['upcoming-streams'] as const;

/** Guests have no socket — avoid 60s hammer on every home/live tab. */
const GUEST_LIVE_POLL_MS = 5 * 60_000;
const GUEST_UPCOMING_POLL_MS = 10 * 60_000;
const AUTH_OFFLINE_LIVE_POLL_MS = 60_000;
const AUTH_OFFLINE_UPCOMING_POLL_MS = 90_000;

function liveFeedPollInterval(accessToken: string | null | undefined, guestMs: number, authMs: number) {
  const socket = accessToken ? getSocket(accessToken) : null;
  if (socket?.connected) return false;
  if (!accessToken) return guestMs;
  return authMs;
}

/** Shared live streams query — updates via LiveStreamsSocketSync + fallback poll when offline. */
export function useLiveStreamsQuery() {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: LIVE_STREAMS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ data: Stream[] }>('/streams/live');
      return data.data;
    },
    staleTime: 30_000,
    refetchInterval: () =>
      liveFeedPollInterval(accessToken, GUEST_LIVE_POLL_MS, AUTH_OFFLINE_LIVE_POLL_MS),
  });
}

export function useUpcomingStreamsQuery() {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: UPCOMING_STREAMS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ data: Stream[] }>('/streams/upcoming');
      return data.data;
    },
    staleTime: 60_000,
    refetchInterval: () =>
      liveFeedPollInterval(accessToken, GUEST_UPCOMING_POLL_MS, AUTH_OFFLINE_UPCOMING_POLL_MS),
  });
}
