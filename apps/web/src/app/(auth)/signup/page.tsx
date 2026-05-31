import { SignupForm } from './SignupForm';
import { safeReturnPath } from '@/lib/safe-return-path';
import { getServerPlatformConfig } from '@/lib/server-platform-config';
import { isGoogleOAuthEnabled } from '@/lib/platform-config';

type SignupPageProps = {
  searchParams?: { next?: string };
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const nextPath = safeReturnPath(searchParams?.next, '/');
  const platformConfig = await getServerPlatformConfig();
  const showGoogleInitially = isGoogleOAuthEnabled(platformConfig);

  return (
    <SignupForm
      nextPath={nextPath}
      initialPlatformConfig={platformConfig}
      showGoogleInitially={showGoogleInitially}
    />
  );
}
