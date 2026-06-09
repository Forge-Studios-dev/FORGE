'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import { Stream } from '@/types';

export const LIVE_STREAMS_QUERY_KEY = ['live-streams'] as const;
export const UPCOMING_STREAMS_QUERY_KEY = ['upcoming-streams'] as const;

/** Shared live streams query — updates via LiveStreamsSocketSync + fallback poll when offline. */
export function useLiveStreamsQuery() {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: LIVE_STREAMS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ data: Stream[] }>('/streams/live');
      return data.data;
    },
    refetchInterval: () => {
      const socket = accessToken ? getSocket(accessToken) : null;
      if (socket?.connected) return false;
      return 60_000;
    },
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
    refetchInterval: () => {
      const socket = accessToken ? getSocket(accessToken) : null;
      if (socket?.connected) return false;
      return 90_000;
    },
  });
}
