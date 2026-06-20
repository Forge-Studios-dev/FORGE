'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';

type Report = {
  id: string;
  communityId: string;
  channelId?: string;
  messageId?: string;
  reporterId?: string;
  reason: string;
  status: string;
  createdAt: string;
};

type ChannelMessage = {
  id: string;
  body: string;
  userId: string;
  user?: { displayName?: string; username?: string };
};

export default function AdminCommunityPage() {
  const qc = useQueryClient();

  const { data: reports, isLoading } = useQuery({
    queryKey: ['admin-community-reports'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Report[] }>('/admin/community-reports');
      return data.data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await api.patch(`/admin/community-reports/${reportId}/resolve`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-community-reports'] }),
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Community moderation" subtitle="Platform oversight of community reports" />

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {(reports ?? []).map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              onResolve={() => resolveMutation.mutate(r.id)}
              resolving={resolveMutation.isPending}
            />
          ))}
          {(reports ?? []).length === 0 ? (
            <p className="text-sm text-on-surface-variant">No open community reports.</p>
          ) : null}
        </ul>
      )}
    </main>
  );
}

function ReportCard({
  report,
  onResolve,
  resolving,
}: {
  report: Report;
  onResolve: () => void;
  resolving: boolean;
}) {
  const { data: message } = useQuery({
    queryKey: ['report-message', report.channelId, report.messageId],
    enabled: !!report.channelId && !!report.messageId,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: ChannelMessage[] } }>(
        `/channels/${report.channelId}/messages?limit=50`,
      );
      return data.data.data.find((m) => m.id === report.messageId) ?? null;
    },
  });

  return (
    <li className="glass-panel rounded-xl p-4">
      <p className="text-sm font-medium">{report.reason}</p>
      <p className="text-xs text-on-surface-variant">
        Community {report.communityId}
        {report.channelId ? ` · Channel ${report.channelId}` : ''}
        {report.reporterId ? ` · Reporter ${report.reporterId}` : ''}
      </p>
      {message ? (
        <blockquote className="mt-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
          {message.user?.displayName ?? message.userId}: {message.body}
        </blockquote>
      ) : report.messageId ? (
        <p className="mt-2 text-xs text-on-surface-variant">Message {report.messageId}</p>
      ) : null}
      <p className="mt-1 text-xs text-on-surface-variant">
        {new Date(report.createdAt).toLocaleString()}
      </p>
      <Button
        variant="outline"
        className="mt-2 text-xs"
        disabled={resolving}
        onClick={onResolve}
      >
        Resolve
      </Button>
    </li>
  );
}
