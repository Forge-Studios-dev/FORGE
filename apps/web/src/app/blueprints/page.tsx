import Link from 'next/link';
import { PageHeader } from '@forge/design-system';

export const metadata = { title: 'Stitch blueprints' };

export default function BlueprintsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 md:px-12">
      <PageHeader
        title="Stitch blueprints"
        subtitle="Reference screens from the FORGE creator learning platform export"
      />
      <div className="glass-panel space-y-4 rounded-xl p-6">
        <p className="text-on-surface-variant">
          The production FORGE apps mirror this Stitch UI/UX. Static HTML reference screens live in{' '}
          <code className="text-primary">docs/design/blueprints/</code> in the monorepo.
        </p>
        <p className="text-sm text-outline">
          Browse web, mobile, and admin mockups by domain. Use them to validate layout, typography, and flows
          during implementation.
        </p>
        <Link href="/" className="inline-block text-primary hover:underline">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
