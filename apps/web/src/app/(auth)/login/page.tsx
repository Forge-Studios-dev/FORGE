import { LoginForm } from './LoginForm';
import { safeReturnPath } from '@/lib/safe-return-path';
import { getServerPlatformConfig } from '@/lib/server-platform-config';
import { isGoogleOAuthEnabled } from '@/lib/platform-config';

type LoginPageProps = {
  searchParams?: { next?: string; reset?: string; error?: string };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const nextPath = safeReturnPath(searchParams?.next, '/');
  const resetOk = searchParams?.reset === '1';
  const adminBlocked = searchParams?.error === 'platform_admin';
  const platformConfig = await getServerPlatformConfig();
  const showGoogleInitially = isGoogleOAuthEnabled(platformConfig);

  return (
    <LoginForm
      nextPath={nextPath}
      resetOk={resetOk}
      adminBlocked={adminBlocked}
      initialPlatformConfig={platformConfig}
      showGoogleInitially={showGoogleInitially}
    />
  );
}
