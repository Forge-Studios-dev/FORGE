import { FeedGridSkeleton } from '@forge/design-system';

export default function HomeLoading() {
  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <div className="mb-6 h-8 w-40 forge-shimmer rounded-lg bg-surface-container-high" />
      <div className="mb-8 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 shrink-0 forge-shimmer rounded-full bg-surface-container-high"
          />
        ))}
      </div>
      <FeedGridSkeleton count={8} />
    </main>
  );
}
