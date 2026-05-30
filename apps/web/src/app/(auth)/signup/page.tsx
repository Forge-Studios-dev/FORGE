import { SignupForm } from './SignupForm';
import { safeReturnPath } from '@/lib/safe-return-path';

type SignupPageProps = {
  searchParams?: { next?: string };
};

export default function SignupPage({ searchParams }: SignupPageProps) {
  const nextPath = safeReturnPath(searchParams?.next, '/');
  return <SignupForm nextPath={nextPath} />;
}
