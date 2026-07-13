import { FeedGridSkeleton } from '@forge/design-system';

export default function SearchLoading() {
  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <div className="mb-8 h-10 w-full max-w-md forge-shimmer rounded-full bg-surface-container-high" />
      <FeedGridSkeleton count={6} />
    </main>
  );
}
