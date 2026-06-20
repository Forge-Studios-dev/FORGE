'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@forge/design-system';
import { api } from '@/lib/api';
import type { SubscriberRow } from '@/types/community';

export function SubscriberPicker({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (userId: string) => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState('');

  const { data: subscribers } = useQuery({
    queryKey: ['creator-subscribers-picker'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriberRow[] }>('/creators/me/subscribers?limit=200');
      return data.data;
    },
  });

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = subscribers ?? [];
    if (!q) return list.slice(0, 12);
    return list
      .filter(
        (s) =>
          s.userId.toLowerCase().includes(q) ||
          s.username?.toLowerCase().includes(q) ||
          s.displayName?.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [subscribers, search]);

  const selected = subscribers?.find((s) => s.userId === value);

  return (
    <div className="space-y-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
      />
      {value ? (
        <p className="text-xs text-on-surface-variant">
          Selected: {selected?.displayName ?? selected?.username ?? value}
          <button type="button" className="ml-2 text-primary" onClick={() => onChange('')}>
            Clear
          </button>
        </p>
      ) : null}
      {(search.trim() || !value) && matches.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-outline-variant/40">
          {matches.map((s) => (
            <li key={s.userId}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-container-high"
                onClick={() => {
                  onChange(s.userId);
                  setSearch(s.displayName ?? s.username ?? s.userId);
                }}
              >
                {s.displayName ?? s.username ?? 'Member'}
                {s.username ? (
                  <span className="ml-2 text-xs text-outline">@{s.username}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
