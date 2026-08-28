import Link from 'next/link';
import { buttonClassName } from '@forge/design-system';

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display-forge text-3xl font-bold text-on-surface">Access denied</p>
      <p className="mt-3 max-w-md text-sm text-on-surface-variant">
        This account does not have admin privileges. Use an admin account or contact your platform operator.
      </p>
      <Link href="/login" className={`${buttonClassName('primary')} mt-8 !px-8 !py-3`}>
        Back to admin sign in
      </Link>
    </main>
  );
}
