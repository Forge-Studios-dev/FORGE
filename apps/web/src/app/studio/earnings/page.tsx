'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, EmptyState, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';

type EarningsSummary = {
  periodDays: number;
  subscriptions: { mrrCents: number; activeSubscribers: number };
  superThanks: { totalAmountCents: number; creatorNetCents: number; tipCount: number };
  superChat: { totalAmountCents: number; creatorNetCents: number; tipCount: number };
  totalCreatorNetCents: number;
  adRevenueCents: number;
};

type MonetizationEligibility = {
  eligible: boolean;
  subscriberCount: number;
  subscriberThreshold: number;
  watchHours365d: number;
  watchHoursThreshold: number;
  shortsViews90d: number;
  shortsViewsThreshold: number;
  meetsAudienceThreshold: boolean;
  isApprovedCreator: boolean;
  hasActiveUploadRestriction: boolean;
  uploadRestrictedUntil: string | null;
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

function formatHours(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n);
}

const DAY_OPTIONS = [7, 30, 90, 365] as const;

export default function StudioEarningsPage() {
  const { isCreator } = useAuth();
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['studio-earnings', days],
    enabled: isCreator,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: EarningsSummary }>(
        `/creators/me/earnings?days=${days}`,
      );
      return res.data;
    },
  });

  const {
    data: eligibility,
    isLoading: eligibilityLoading,
  } = useQuery({
    queryKey: ['studio-monetization-eligibility'],
    enabled: isCreator,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: MonetizationEligibility }>(
        '/creators/me/monetization/eligibility',
      );
      return res.data;
    },
  });

  async function downloadCsv() {
    setExporting(true);
    setExportError('');
    try {
      const { data: blob } = await api.get<Blob>(`/creators/me/earnings/export?days=${days}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forge-earnings-${days}d.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(getApiErrorMessage(err, 'Could not export earnings.'));
    } finally {
      setExporting(false);
    }
  }

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Earnings"
          subtitle="Memberships, Super Thanks, and Super Chat — one Studio revenue view"
        />
        <div className="flex flex-wrap items-center gap-2">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                days === d
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant/40 text-on-surface-variant hover:border-primary'
              }`}
            >
              {d}d
            </button>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={exporting || isLoading}
            onClick={() => void downloadCsv()}
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {exportError ? (
        <p className="text-sm text-error" role="alert">
          {exportError}
        </p>
      ) : null}

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-on-surface">Monetization eligibility</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Partner Program-style thresholds (1,000 subscribers and 4,000 watch hours / 12 mo or
              10M Shorts views / 90d). Read-only until ad revenue ships.
            </p>
          </div>
          {eligibilityLoading ? (
            <StatusPill tone="neutral" label="Checking…" />
          ) : eligibility ? (
            <StatusPill
              tone={eligibility.eligible ? 'success' : 'warning'}
              label={eligibility.eligible ? 'Eligible' : 'Not yet eligible'}
            />
          ) : null}
        </div>
        {eligibility ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <li>
              <p className="text-xs text-outline">Subscribers</p>
              <p className="mt-0.5 font-medium">
                {formatCount(eligibility.subscriberCount)} /{' '}
                {formatCount(eligibility.subscriberThreshold)}
              </p>
            </li>
            <li>
              <p className="text-xs text-outline">Watch hours (12 mo)</p>
              <p className="mt-0.5 font-medium">
                {formatHours(eligibility.watchHours365d)} /{' '}
                {formatCount(eligibility.watchHoursThreshold)}
              </p>
            </li>
            <li>
              <p className="text-xs text-outline">Shorts views (90d)</p>
              <p className="mt-0.5 font-medium">
                {formatCount(eligibility.shortsViews90d)} /{' '}
                {formatCount(eligibility.shortsViewsThreshold)}
              </p>
            </li>
            <li>
              <p className="text-xs text-outline">Audience threshold</p>
              <p className="mt-0.5 font-medium">
                {eligibility.meetsAudienceThreshold ? 'Met' : 'Not met'}
              </p>
            </li>
            <li>
              <p className="text-xs text-outline">Creator status</p>
              <p className="mt-0.5 font-medium">
                {eligibility.isApprovedCreator ? 'Approved' : 'Not approved'}
              </p>
            </li>
            <li>
              <p className="text-xs text-outline">Upload restriction</p>
              <p className="mt-0.5 font-medium">
                {eligibility.hasActiveUploadRestriction
                  ? eligibility.uploadRestrictedUntil
                    ? `Until ${new Date(eligibility.uploadRestrictedUntil).toLocaleDateString()}`
                    : 'Active'
                  : 'None'}
              </p>
            </li>
          </ul>
        ) : !eligibilityLoading ? (
          <p className="text-sm text-on-surface-variant">Couldn’t load eligibility snapshot.</p>
        ) : null}
      </section>

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading earnings…</p>
      ) : isError || !data ? (
        <EmptyState
          title="Couldn’t load earnings"
          description="Confirm Stripe Connect and try again."
          action={{ label: 'Retry', href: '#' }}
          onAction={() => void refetch()}
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-panel rounded-2xl p-4">
              <p className="font-label-caps text-xs text-outline">Tips net ({data.periodDays}d)</p>
              <p className="mt-2 text-2xl font-semibold">{formatUsd(data.totalCreatorNetCents)}</p>
              <p className="mt-1 text-xs text-on-surface-variant">Super Thanks + Super Chat</p>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <p className="font-label-caps text-xs text-outline">Membership MRR</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatUsd(data.subscriptions.mrrCents)}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {data.subscriptions.activeSubscribers} active members
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <p className="font-label-caps text-xs text-outline">Super Thanks</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatUsd(data.superThanks.creatorNetCents)}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {data.superThanks.tipCount} tips · gross {formatUsd(data.superThanks.totalAmountCents)}
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <p className="font-label-caps text-xs text-outline">Super Chat</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatUsd(data.superChat.creatorNetCents)}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {data.superChat.tipCount} tips · gross {formatUsd(data.superChat.totalAmountCents)}
              </p>
            </div>
          </section>

          <section className="glass-panel space-y-3 rounded-2xl p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="neutral" label="Ad revenue" />
              <span className="text-sm text-on-surface-variant">
                {formatUsd(data.adRevenueCents)} — not integrated yet
              </span>
            </div>
            <p className="text-sm text-on-surface-variant">
              Payouts settle through Stripe Connect. Review memberships, Super Thanks ledger, and
              Connect status below.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/studio/tiers" className="text-primary hover:underline">
                Memberships & Connect
              </Link>
              <Link href="/studio/super-thanks" className="text-primary hover:underline">
                Super Thanks ledger
              </Link>
              <Link href="/studio/subscribers" className="text-primary hover:underline">
                Members
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
