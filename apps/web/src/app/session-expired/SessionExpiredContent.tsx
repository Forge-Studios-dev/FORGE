'use client';

import { useSearchParams } from 'next/navigation';
import { StatusPage } from '@forge/design-system';

export function SessionExpiredContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <StatusPage
      icon="schedule"
      title="Session expired"
      description="Please sign in again to continue."
      action={{ label: 'Sign in', href: loginHref }}
    />
  );
}
