import Link from 'next/link';
import { Icon } from '@forge/design-system';

export default function AdminNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="glass-panel max-w-md rounded-2xl p-10">
        <Icon name="search_off" className="mb-6 text-5xl text-on-surface-variant" />
        <h1 className="font-display-forge mb-3 text-2xl font-bold">Page not found</h1>
        <p className="mb-8 text-on-surface-variant">
          This admin route does not exist or was removed.
        </p>
        <Link href="/dashboard" className="primary-button inline-block rounded-full px-8 py-3 font-semibold text-on-primary">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
