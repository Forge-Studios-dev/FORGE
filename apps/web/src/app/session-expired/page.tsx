import { StatusPage } from '@forge/design-system';
import { loginHrefWithNext } from '@/lib/safe-return-path';

type SessionExpiredPageProps = {
  searchParams?: { next?: string };
};

export default function SessionExpiredPage({ searchParams }: SessionExpiredPageProps) {
  const rawNext = searchParams?.next;
  const loginHref = rawNext ? loginHrefWithNext(rawNext) : '/login';

  return (
    <StatusPage
      icon="schedule"
      title="Session expired"
      description="Please sign in again to continue."
      action={{ label: 'Sign in', href: loginHref }}
    />
  );
}
