'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, EmptyState, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';
import { useAuth } from '@/lib/auth';

type AccountStrike = {
  id: string;
  type: 'community_guideline' | 'copyright';
  reason: string;
  consequence: 'warning' | 'upload_restriction_2w' | 'termination_recommended';
  status: 'active' | 'expired' | 'rescinded';
  appealStatus: 'none' | 'pending' | 'granted' | 'denied';
  appealReason: string | null;
  sourceReportId: string | null;
  createdAt: string;
  expiresAt: string | null;
  resolvedAt: string | null;
};

type CopyrightNotice = {
  id: string;
  videoId: string | null;
  claimantName: string;
  workDescription: string;
  infringingDescription: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

const CONSEQUENCE_LABEL: Record<AccountStrike['consequence'], string> = {
  warning: 'Warning — no restriction',
  upload_restriction_2w: '2-week upload restriction',
  termination_recommended: 'Channel under review for termination',
};

const STATUS_TONE: Record<AccountStrike['status'], 'critical' | 'neutral' | 'success'> = {
  active: 'critical',
  expired: 'neutral',
  rescinded: 'success',
};

function AppealForm({ strikeId, onDone }: { strikeId: string; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post(`/account-strikes/${strikeId}/appeal`, { reason });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-strikes'] });
      onDone();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not submit your appeal.')),
  });

  return (
    <div className="mt-3 space-y-2">
      <textarea
        className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
        rows={3}
        minLength={10}
        maxLength={2000}
        placeholder="Explain why you believe this strike was issued in error…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error ? <p className="text-xs text-critical">{error}</p> : null}
      <Button disabled={reason.trim().length < 10 || mutation.isPending} onClick={() => mutation.mutate()}>
        Submit appeal
      </Button>
    </div>
  );
}

function CounterNoticeForm({ noticeId, onDone }: { noticeId: string; onDone: () => void }) {
  const [contactInfo, setContactInfo] = useState('');
  const [goodFaith, setGoodFaith] = useState(false);
  const [jurisdiction, setJurisdiction] = useState(false);
  const [signature, setSignature] = useState('');
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post(`/copyright/notices/${noticeId}/counter-notice`, {
        contactInfo,
        goodFaithMistakeStatement: goodFaith,
        consentToJurisdiction: jurisdiction,
        signature,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-strikes'] });
      onDone();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not submit your counter-notice.')),
  });

  const canSubmit =
    contactInfo.trim().length >= 10 && goodFaith && jurisdiction && signature.trim().length >= 2;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-outline-variant p-3">
      <p className="text-xs text-on-surface-variant">
        Filing a false counter-notice can expose you to legal liability. Only proceed if you
        believe this video was removed as a result of a mistake or misidentification.
      </p>
      <div>
        <label className="text-xs font-medium">Contact information</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
          rows={2}
          minLength={10}
          maxLength={1000}
          placeholder="Your name, address, phone number, and email"
          value={contactInfo}
          onChange={(e) => setContactInfo(e.target.value)}
        />
      </div>
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={goodFaith}
          onChange={(e) => setGoodFaith(e.target.checked)}
        />
        I have a good faith belief that the material was removed or disabled as a result of a
        mistake or misidentification.
      </label>
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.checked)}
        />
        I consent to the jurisdiction of the claimant&apos;s federal district court (or, if
        outside the US, an appropriate judicial district).
      </label>
      <div>
        <label className="text-xs font-medium">Electronic signature (your full legal name)</label>
        <input
          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
          minLength={2}
          maxLength={300}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
        />
      </div>
      {error ? <p className="text-xs text-critical">{error}</p> : null}
      <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
        Submit counter-notice
      </Button>
    </div>
  );
}

function CopyrightNoticeSection({ noticeId }: { noticeId: string }) {
  const [showCounterForm, setShowCounterForm] = useState(false);
  const { data: notice, isLoading } = useQuery({
    queryKey: ['copyright-notice', noticeId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CopyrightNotice }>(`/copyright/notices/${noticeId}`);
      return data.data;
    },
  });

  if (isLoading) return <p className="mt-2 text-xs text-on-surface-variant">Loading claim details…</p>;
  if (!notice) return null;

  const canCounterNotice = notice.status === 'takedown_issued';

  return (
    <div className="mt-3 border-t border-outline-variant pt-3">
      <p className="text-xs font-medium text-on-surface-variant">Claim details</p>
      <p className="mt-1 text-sm">
        <span className="text-on-surface-variant">Claimant: </span>
        {notice.claimantName}
      </p>
      <p className="mt-1 text-sm">
        <span className="text-on-surface-variant">Copyrighted work: </span>
        {notice.workDescription}
      </p>
      <p className="mt-1 text-sm">
        <span className="text-on-surface-variant">Infringing material: </span>
        {notice.infringingDescription}
      </p>
      {canCounterNotice && !showCounterForm ? (
        <Button variant="secondary" className="mt-2" onClick={() => setShowCounterForm(true)}>
          File a counter-notice
        </Button>
      ) : null}
      {showCounterForm ? (
        <CounterNoticeForm noticeId={noticeId} onDone={() => setShowCounterForm(false)} />
      ) : null}
      {!canCounterNotice ? (
        <p className="mt-2 text-xs text-on-surface-variant">
          {notice.status === 'counter_noticed'
            ? 'Counter-notice filed — pending the claimant response window.'
            : notice.status === 'reinstated'
              ? 'This claim was resolved and the video was reinstated.'
              : 'This claim has been resolved.'}
        </p>
      ) : null}
    </div>
  );
}

function StrikeCard({ strike }: { strike: AccountStrike }) {
  const [expanded, setExpanded] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);

  const canAppeal = strike.status === 'active' && strike.appealStatus === 'none';

  return (
    <li className="glass-panel rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium capitalize">{strike.type.replace('_', ' ')} strike</p>
          <p className="mt-1 text-sm text-on-surface-variant">{strike.reason}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {CONSEQUENCE_LABEL[strike.consequence]}
          </p>
        </div>
        <StatusPill tone={STATUS_TONE[strike.status]} label={strike.status} />
      </div>

      {strike.appealStatus !== 'none' ? (
        <p className="mt-2 text-xs text-on-surface-variant">
          Appeal {strike.appealStatus}
          {strike.appealReason ? `: “${strike.appealReason}”` : ''}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3">
        {strike.type === 'copyright' && strike.sourceReportId ? (
          <Button
            variant="ghost"
            className="h-auto px-0 py-0 text-xs text-primary"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide claim details' : 'View claim details'}
          </Button>
        ) : null}
        {canAppeal && !showAppealForm ? (
          <Button
            variant="ghost"
            className="h-auto px-0 py-0 text-xs text-on-surface-variant"
            onClick={() => setShowAppealForm(true)}
          >
            Appeal this strike
          </Button>
        ) : null}
      </div>

      {expanded && strike.sourceReportId ? (
        <CopyrightNoticeSection noticeId={strike.sourceReportId} />
      ) : null}
      {showAppealForm ? (
        <AppealForm strikeId={strike.id} onDone={() => setShowAppealForm(false)} />
      ) : null}
    </li>
  );
}

export default function StrikesPage() {
  const { user, isGuest } = useAuth();

  const { data: strikes, isLoading } = useQuery({
    queryKey: ['my-strikes', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{ data: AccountStrike[] }>('/users/me/strikes');
      return data.data;
    },
  });

  if (isGuest) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>{' '}
          to view your account strikes.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 md:px-12">
      <PageHeader
        title="Channel strikes"
        subtitle="Community guideline and copyright strikes on your account"
      />

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : (strikes ?? []).length === 0 ? (
        <EmptyState
          icon="verified"
          title="No strikes on your account"
          description="Community guideline and copyright strikes will show up here."
        />
      ) : (
        <ul className="space-y-3">
          {(strikes ?? []).map((strike) => (
            <StrikeCard key={strike.id} strike={strike} />
          ))}
        </ul>
      )}
    </main>
  );
}
