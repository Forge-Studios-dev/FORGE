import { StatusPage } from '@forge/design-system';
import { loginHrefWithNext } from '@/lib/safe-return-path';

type SessionExpiredPageProps = {
  searchParams?: { next?: string };
};

export default function SessionExpiredPage({ searchParams }: SessionExpiredPageProps) {
  const rawNext = searchParams?.next;
  const loginHref = rawNext ? loginHrefWithNext(rawNext) : '/login';
  const returningToStudio = typeof rawNext === 'string' && rawNext.startsWith('/studio');

  return (
    <StatusPage
      icon="schedule"
      title="Session expired"
      description={
        returningToStudio
          ? 'Your Studio session ended for security. Sign in again to return to where you left off.'
          : 'Please sign in again to continue.'
      }
      action={{ label: returningToStudio ? 'Sign in to Studio' : 'Sign in', href: loginHref }}
    />
  );
}
