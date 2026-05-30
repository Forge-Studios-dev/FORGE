import { LoginForm } from './LoginForm';
import { safeReturnPath } from '@/lib/safe-return-path';

type LoginPageProps = {
  searchParams?: { next?: string; reset?: string; error?: string };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const nextPath = safeReturnPath(searchParams?.next, '/');
  const resetOk = searchParams?.reset === '1';
  const adminBlocked = searchParams?.error === 'platform_admin';

  return <LoginForm nextPath={nextPath} resetOk={resetOk} adminBlocked={adminBlocked} />;
}
