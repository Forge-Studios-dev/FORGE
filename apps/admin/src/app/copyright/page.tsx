'use client';

import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, PageHeader, StatusPill, type StatusTone } from '@forge/design-system';
import { DataTable, Dialog, Tabs, TabPanel, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminPagination } from '@/components/admin/AdminPagination';

const PAGE_SIZE = 20;

type CopyrightNotice = {
  id: string;
  videoId: string;
  video?: { id: string; title: string } | null;
  claimantName: string;
  claimantEmail: string;
  status: 'pending' | 'takedown_issued' | 'counter_noticed' | 'reinstated' | 'rejected';
  createdAt: string;
};

type CopyrightCounterNotice = {
  id: string;
  noticeId: string;
  notice?: { id: string; videoId: string; claimantName: string } | null;
  uploaderUserId: string;
  uploader?: { id: string; username: string; displayName: string } | null;
  status: 'pending' | 'reinstated' | 'rejected';
  reinstateEligibleAt: string;
  createdAt: string;
};

type AccountStrike = {
  id: string;
  userId: string;
  user?: { id: string; username: string; displayName: string } | null;
  type: 'community_guideline' | 'copyright';
  reason: string;
  consequence: 'warning' | 'upload_restriction_2w' | 'termination_recommended';
  status: 'active' | 'expired' | 'rescinded';
  appealStatus: 'none' | 'pending' | 'granted' | 'denied';
  appealReason: string | null;
  createdAt: string;
};

const NOTICE_STATUS_TONE: Record<string, StatusTone> = {
  pending: 'warning',
  takedown_issued: 'critical',
  counter_noticed: 'primary',
  reinstated: 'success',
  rejected: 'neutral',
};

const COUNTER_NOTICE_STATUS_TONE: Record<string, StatusTone> = {
  pending: 'warning',
  reinstated: 'success',
  rejected: 'neutral',
};

const CONSEQUENCE_LABEL: Record<string, string> = {
  warning: 'Warning',
  upload_restriction_2w: 'Upload restriction (2w)',
  termination_recommended: 'Termination recommended',
};

function NoticesTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['copyright-notices', page],
    queryFn: async () => {
      const res = await api.get<{
        data: CopyrightNotice[];
        meta: { total: number; totalPages: number };
      }>(`/admin/copyright/notices?page=${page}&limit=${PAGE_SIZE}`);
      return res.data;
    },
  });

  const notices = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

  const columns: ColumnDef<CopyrightNotice, unknown>[] = [
    {
      accessorKey: 'video',
      header: 'Video',
      cell: ({ row }) => (
        <span className="block max-w-[200px] truncate">
          {row.original.video?.title ?? row.original.videoId}
        </span>
      ),
    },
    { accessorKey: 'claimantName', header: 'Claimant' },
    { accessorKey: 'claimantEmail', header: 'Email' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue<string>();
        return <StatusPill tone={NOTICE_STATUS_TONE[status] ?? 'neutral'} label={status.replace(/_/g, ' ')} />;
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Filed',
      cell: ({ getValue }) => (
        <span className="text-xs text-on-surface-variant">
          {new Date(getValue<string>()).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable<CopyrightNotice>
        columns={columns}
        data={notices}
        getRowId={(n) => n.id}
        loading={isLoading}
        emptyState={{ title: 'No DMCA notices' }}
      />
      {!isLoading && total > 0 ? (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="notices"
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      ) : null}
    </div>
  );
}

function CounterNoticesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const dialogTitleId = useId();
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<CopyrightCounterNotice | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['copyright-counter-notices', page],
    queryFn: async () => {
      const res = await api.get<{
        data: CopyrightCounterNotice[];
        meta: { total: number; totalPages: number };
      }>(`/admin/copyright/counter-notices?page=${page}&limit=${PAGE_SIZE}`);
      return res.data;
    },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => api.post(`/admin/copyright/counter-notices/${id}/reject`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['copyright-counter-notices'] });
      setConfirming(null);
      toast({ title: 'Counter-notice rejected — reinstatement blocked', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not reject counter-notice', variant: 'critical' }),
  });

  const counterNotices = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

  // Resolving the last pending item on a later page can shrink totalPages
  // below the current page (filtered list), leaving a "no results" page the
  // admin has to manually back out of — clamp instead.
  useEffect(() => {
    if (data && data.meta.totalPages > 0 && page > data.meta.totalPages) {
      setPage(data.meta.totalPages);
    }
  }, [data, page]);

  const columns: ColumnDef<CopyrightCounterNotice, unknown>[] = [
    {
      accessorKey: 'uploader',
      header: 'Uploader',
      cell: ({ row }) => row.original.uploader?.username ?? row.original.uploaderUserId,
    },
    {
      accessorKey: 'notice',
      header: 'Original claimant',
      cell: ({ row }) => row.original.notice?.claimantName ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue<string>();
        return (
          <StatusPill tone={COUNTER_NOTICE_STATUS_TONE[status] ?? 'neutral'} label={status} />
        );
      },
    },
    {
      accessorKey: 'reinstateEligibleAt',
      header: 'Auto-reinstates',
      cell: ({ getValue }) => (
        <span className="text-xs text-on-surface-variant">
          {new Date(getValue<string>()).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'pending' ? (
          <Button
            type="button"
            variant="secondary"
            className="!px-2 !py-1 text-xs"
            onClick={() => setConfirming(row.original)}
          >
            Reject
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        Pending counter-notices auto-reinstate on their eligibility date unless rejected here
        (e.g. the claimant reports they&apos;ve filed litigation).
      </p>
      <DataTable<CopyrightCounterNotice>
        columns={columns}
        data={counterNotices}
        getRowId={(cn) => cn.id}
        loading={isLoading}
        emptyState={{ title: 'No counter-notices' }}
      />
      {!isLoading && total > 0 ? (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="counter-notices"
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      ) : null}

      <Dialog open={!!confirming} onClose={() => setConfirming(null)} labelledBy={dialogTitleId} size="sm">
        {confirming ? (
          <div className="space-y-4">
            <h2 id={dialogTitleId} className="text-lg font-bold text-on-surface">
              Reject counter-notice?
            </h2>
            <p className="text-sm text-on-surface-variant">
              Blocks the automatic reinstatement for this video. Only do this if the claimant has
              reported filing litigation.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={reject.isPending}
                onClick={() => reject.mutate(confirming.id)}
              >
                {reject.isPending ? 'Rejecting...' : 'Reject'}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function StrikesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const dialogTitleId = useId();
  const [page, setPage] = useState(1);
  const [appealFilter, setAppealFilter] = useState<'pending' | ''>('pending');
  const [reviewing, setReviewing] = useState<AccountStrike | null>(null);

  useEffect(() => {
    setPage(1);
  }, [appealFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['strikes', page, appealFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (appealFilter) params.set('appealStatus', appealFilter);
      const res = await api.get<{ data: AccountStrike[]; meta: { total: number; totalPages: number } }>(
        `/admin/strikes?${params}`,
      );
      return res.data;
    },
  });

  const resolveAppeal = useMutation({
    mutationFn: async ({ strikeId, granted }: { strikeId: string; granted: boolean }) =>
      api.patch(`/admin/strikes/${strikeId}/appeal`, { granted }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['strikes'] });
      setReviewing(null);
      toast({ title: vars.granted ? 'Appeal granted — strike rescinded' : 'Appeal denied', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not resolve appeal', variant: 'critical' }),
  });

  const strikes = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

  // Resolving the last pending appeal on a later page can shrink totalPages
  // below the current page (filtered list) — clamp instead of showing "no
  // strikes found" with no way back except manually clicking Prev.
  useEffect(() => {
    if (data && data.meta.totalPages > 0 && page > data.meta.totalPages) {
      setPage(data.meta.totalPages);
    }
  }, [data, page]);

  const columns: ColumnDef<AccountStrike, unknown>[] = [
    {
      accessorKey: 'user',
      header: 'User',
      cell: ({ row }) => row.original.user?.username ?? row.original.userId,
    },
    { accessorKey: 'type', header: 'Type' },
    {
      accessorKey: 'consequence',
      header: 'Consequence',
      cell: ({ getValue }) => CONSEQUENCE_LABEL[getValue<string>()] ?? getValue<string>(),
    },
    {
      accessorKey: 'appealStatus',
      header: 'Appeal',
      cell: ({ getValue }) => {
        const status = getValue<string>();
        if (status === 'none') return <span className="text-on-surface-variant">—</span>;
        return (
          <StatusPill
            tone={status === 'pending' ? 'warning' : status === 'granted' ? 'success' : 'neutral'}
            label={status}
          />
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Issued',
      cell: ({ getValue }) => (
        <span className="text-xs text-on-surface-variant">
          {new Date(getValue<string>()).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.appealStatus === 'pending' ? (
          <Button
            type="button"
            variant="secondary"
            className="!px-2 !py-1 text-xs"
            onClick={() => setReviewing(row.original)}
          >
            Review appeal
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['pending', ''] as const).map((f) => (
          <Button
            key={f || 'all'}
            type="button"
            variant={appealFilter === f ? 'primary' : 'secondary'}
            className="!px-3 !py-1 text-sm"
            onClick={() => setAppealFilter(f)}
          >
            {f ? 'Pending appeals' : 'All strikes'}
          </Button>
        ))}
      </div>

      <DataTable<AccountStrike>
        columns={columns}
        data={strikes}
        getRowId={(s) => s.id}
        loading={isLoading}
        emptyState={{ title: 'No strikes found' }}
      />
      {!isLoading && total > 0 ? (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="strikes"
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      ) : null}

      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} labelledBy={dialogTitleId} size="md">
        {reviewing ? (
          <div className="space-y-4">
            <h2 id={dialogTitleId} className="text-lg font-bold text-on-surface">
              Review strike appeal
            </h2>
            <div className="space-y-2 text-sm text-on-surface-variant">
              <p>
                <span className="text-on-surface">User:</span>{' '}
                {reviewing.user?.username ?? reviewing.userId}
              </p>
              <p>
                <span className="text-on-surface">Strike reason:</span> {reviewing.reason}
              </p>
              <p>
                <span className="text-on-surface">Consequence:</span>{' '}
                {CONSEQUENCE_LABEL[reviewing.consequence]}
              </p>
              {reviewing.appealReason ? (
                <p>
                  <span className="text-on-surface">Appeal reason:</span> {reviewing.appealReason}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setReviewing(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={resolveAppeal.isPending}
                onClick={() => resolveAppeal.mutate({ strikeId: reviewing.id, granted: false })}
              >
                Deny
              </Button>
              <Button
                type="button"
                disabled={resolveAppeal.isPending}
                onClick={() => resolveAppeal.mutate({ strikeId: reviewing.id, granted: true })}
              >
                Grant
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

export default function CopyrightPage() {
  const [tab, setTab] = useState('notices');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Copyright & Strikes"
        subtitle="DMCA notices, counter-notices, and account-strike appeals."
      />

      <Tabs
        tabs={[
          { id: 'notices', label: 'DMCA notices' },
          { id: 'counter-notices', label: 'Counter-notices' },
          { id: 'strikes', label: 'Strikes & appeals' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id="notices" value={tab}>
        <NoticesTab />
      </TabPanel>
      <TabPanel id="counter-notices" value={tab}>
        <CounterNoticesTab />
      </TabPanel>
      <TabPanel id="strikes" value={tab}>
        <StrikesTab />
      </TabPanel>
    </div>
  );
}
