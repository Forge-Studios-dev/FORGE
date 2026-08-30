'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';

/**
 * Public DMCA takedown notice form (POST /copyright/notices).
 * Prefills videoId from ?videoId= when opened from the report dialog.
 */
function CopyrightNoticeForm() {
  const searchParams = useSearchParams();
  const [videoId, setVideoId] = useState(searchParams.get('videoId') || '');
  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [claimantAddress, setClaimantAddress] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [infringingDescription, setInfringingDescription] = useState('');
  const [goodFaith, setGoodFaith] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  const [signature, setSignature] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [doneId, setDoneId] = useState<string | null>(null);

  const canSubmit =
    videoId.trim().length >= 36 &&
    claimantName.trim().length >= 2 &&
    claimantEmail.includes('@') &&
    claimantAddress.trim().length >= 10 &&
    workDescription.trim().length >= 10 &&
    infringingDescription.trim().length >= 10 &&
    goodFaith &&
    accuracy &&
    signature.trim().length >= 2 &&
    !pending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const { data } = await api.post<{ data: { id: string } }>('/copyright/notices', {
        videoId: videoId.trim(),
        claimantName: claimantName.trim(),
        claimantEmail: claimantEmail.trim(),
        claimantAddress: claimantAddress.trim(),
        workDescription: workDescription.trim(),
        infringingDescription: infringingDescription.trim(),
        goodFaithStatement: true,
        accuracyStatement: true,
        signature: signature.trim(),
      });
      setDoneId(data.data?.id ?? 'submitted');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not submit the notice. Check the fields and try again.'));
    } finally {
      setPending(false);
    }
  };

  if (doneId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-on-surface">
          Your notice was received{doneId !== 'submitted' ? ` (reference ${doneId})` : ''}. If the
          notice is valid, the video is taken down pending any counter-notice process.
        </p>
        <Link href="/" className="text-sm text-primary hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void submit(e)}>
      <p className="text-sm text-on-surface-variant">
        Use this form only if you are the copyright owner or authorized to act on their behalf. For
        other policy issues,{' '}
        <Link href="/" className="text-primary hover:underline">
          report the content
        </Link>{' '}
        from the video menu instead. Interim contact:{' '}
        <a href="mailto:legal@forgestudios.net" className="text-primary hover:underline">
          legal@forgestudios.net
        </a>
        .
      </p>

      <div>
        <label htmlFor="dmca-video-id" className="mb-1 block text-sm font-medium">
          Video ID
        </label>
        <Input
          id="dmca-video-id"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          required
          placeholder="UUID of the infringing video"
        />
      </div>
      <div>
        <label htmlFor="dmca-name" className="mb-1 block text-sm font-medium">
          Your full legal name
        </label>
        <Input
          id="dmca-name"
          value={claimantName}
          onChange={(e) => setClaimantName(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="dmca-email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <Input
          id="dmca-email"
          type="email"
          value={claimantEmail}
          onChange={(e) => setClaimantEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="dmca-address" className="mb-1 block text-sm font-medium">
          Mailing address
        </label>
        <textarea
          id="dmca-address"
          value={claimantAddress}
          onChange={(e) => setClaimantAddress(e.target.value)}
          required
          rows={2}
          className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="dmca-work" className="mb-1 block text-sm font-medium">
          Copyrighted work
        </label>
        <textarea
          id="dmca-work"
          value={workDescription}
          onChange={(e) => setWorkDescription(e.target.value)}
          required
          rows={3}
          placeholder="Identify the copyrighted work claimed to be infringed…"
          className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="dmca-infringing" className="mb-1 block text-sm font-medium">
          Infringing material on FORGE
        </label>
        <textarea
          id="dmca-infringing"
          value={infringingDescription}
          onChange={(e) => setInfringingDescription(e.target.value)}
          required
          rows={3}
          placeholder="Describe what on this video infringes and where…"
          className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={goodFaith}
          onChange={(e) => setGoodFaith(e.target.checked)}
        />
        <span>
          I have a good faith belief that use of the material in the manner complained of is not
          authorized by the copyright owner, its agent, or the law.
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={accuracy}
          onChange={(e) => setAccuracy(e.target.checked)}
        />
        <span>
          The information in this notification is accurate, and under penalty of perjury I am
          authorized to act on behalf of the copyright owner.
        </span>
      </label>
      <div>
        <label htmlFor="dmca-signature" className="mb-1 block text-sm font-medium">
          Electronic signature (full legal name)
        </label>
        <Input
          id="dmca-signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          required
        />
      </div>

      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={!canSubmit}>
        {pending ? 'Submitting…' : 'Submit DMCA notice'}
      </Button>
    </form>
  );
}

export default function CopyrightNoticePage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-display-forge mb-2 text-2xl font-semibold">Copyright takedown notice</h1>
      <p className="mb-8 text-sm text-on-surface-variant">
        Statutory DMCA-style notice. Filing a valid notice may make the video private and issue a
        copyright strike to the uploader.
      </p>
      <Suspense fallback={<p className="text-sm text-on-surface-variant">Loading…</p>}>
        <CopyrightNoticeForm />
      </Suspense>
    </main>
  );
}
