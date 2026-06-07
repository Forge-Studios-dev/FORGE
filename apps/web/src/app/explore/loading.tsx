import { FeedGridSkeleton } from '@forge/design-system';

export default function ExploreLoading() {
  return (
    <div className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <div className="mb-8 h-8 w-48 forge-shimmer rounded-lg bg-surface-container-high" />
      <FeedGridSkeleton count={8} />
    </div>
  );
}
