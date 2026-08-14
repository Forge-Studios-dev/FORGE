'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';
import { clearAuthSession } from '@/lib/auth-storage';
import { getApiErrorMessage } from '@/lib/api-message';
import { useAuth } from '@/lib/auth';

/** Landing page for the emailed account-deletion confirmation link (Google-OAuth-only accounts). */
function DeleteAccountConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isGuest, isLoading } = useAuth();
  const token = searchParams.get('confirmationToken') || '';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const confirmDelete = async () => {
    setError('');
    setPending(true);
    try {
      await api.delete('/users/me', { data: { confirmationToken: token } });
      clearAuthSession();
      router.push('/');
    } catch (err) {
      setError(getApiErrorMessage(err, 'This link may have expired — request a new one from Settings.'));
    } finally {
      setPending(false);
    }
  };

  if (!token) {
    return (
      <p className="text-on-surface-variant">
        Missing confirmation token. Use the link from your email, or request a new one from{' '}
        <Link href="/profile/settings" className="text-primary hover:underline">
          Settings
        </Link>
        .
      </p>
    );
  }

  if (isLoading) return <p className="text-on-surface-variant">Loading…</p>;

  if (isGuest || !user) {
    return (
      <p className="text-on-surface-variant">
        Sign in with the account you want to delete, then open this link again.{' '}
        <Link
          href={`/login?next=${encodeURIComponent(`/settings/delete-account?confirmationToken=${token}`)}`}
          className="text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-on-surface">
        Permanently delete <span className="font-semibold">{user.email}</span>? This hides your
        videos, ends any active streams, and cannot be undone.
      </p>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => void confirmDelete()}
          className="bg-error text-on-error hover:bg-error/90"
        >
          {pending ? 'Deleting…' : 'Permanently delete my account'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push('/profile/settings')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display-forge mb-4 text-xl font-semibold">Confirm account deletion</h1>
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <DeleteAccountConfirm />
      </Suspense>
    </main>
  );
}
