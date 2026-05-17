import { Suspense } from 'react';
import { StatusPage } from '@forge/design-system';
import { SessionExpiredContent } from './SessionExpiredContent';

export default function SessionExpiredPage() {
  return (
    <Suspense
      fallback={
        <StatusPage
          icon="schedule"
          title="Session expired"
          description="Please sign in again to continue."
          action={{ label: 'Sign in', href: '/login' }}
        />
      }
    >
      <SessionExpiredContent />
    </Suspense>
  );
}
