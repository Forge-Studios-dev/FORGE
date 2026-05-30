'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSessionId } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth';
import { Button } from '@forge/design-system';

type SessionRow = {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
};

export function ActiveSessions() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const currentSessionId = getSessionId();

  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SessionRow[] }>('/auth/sessions');
      return data.data;
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });

  if (isLoading) {
    return <p className="text-sm text-on-surface-variant">Loading devices…</p>;
  }

  if (error) {
    return <p className="text-sm text-error">Could not load active sessions.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        Devices where you are signed in. Revoke any session you do not recognize.
      </p>
      <ul className="space-y-3">
        {sessions.map((s) => {
          const isCurrent = s.id === currentSessionId;
          const label = s.deviceLabel || s.userAgent || 'Unknown device';
          return (
            <li
              key={s.id}
              className="flex flex-col gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-on-surface">
                  {label}
                  {isCurrent ? (
                    <span className="ml-2 rounded-full bg-secondary/20 px-2 py-0.5 text-xs text-secondary">
                      This device
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Started {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>
              {!isCurrent ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 text-sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(s.id)}
                >
                  {revoke.isPending ? 'Revoking…' : 'Revoke'}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {sessions.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No other active sessions.</p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="text-sm text-error"
        onClick={() => logout({ allDevices: true })}
      >
        Sign out on all devices
      </Button>
    </div>
  );
}
