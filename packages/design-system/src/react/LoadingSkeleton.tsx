export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`forge-shimmer rounded-lg bg-surface-container-high ${className}`} />;
}

export function FeedGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} className="overflow-hidden rounded-xl bg-surface-container">
          <div className="aspect-video w-full forge-shimmer bg-surface-container-high" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-3/4 forge-shimmer rounded bg-surface-container-high" />
            <div className="h-3 w-1/2 forge-shimmer rounded bg-surface-container-high" />
          </div>
        </article>
      ))}
    </div>
  );
}

export function HorizontalCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="hide-scrollbar -mx-5 flex gap-6 overflow-x-auto px-5 md:mx-0 md:px-0">
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} className="w-[280px] shrink-0 sm:w-[300px] md:w-[320px]">
          <div className="aspect-video w-full forge-shimmer rounded-xl bg-surface-container-high" />
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full forge-shimmer rounded bg-surface-container-high" />
            <div className="h-3 w-2/3 forge-shimmer rounded bg-surface-container-high" />
          </div>
        </article>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="glass-panel rounded-xl p-4">
          <div className="mb-2 h-4 w-1/3 forge-shimmer rounded bg-surface-container-high" />
          <div className="h-3 w-full forge-shimmer rounded bg-surface-container-high" />
        </li>
      ))}
    </ul>
  );
}

export function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 forge-shimmer rounded-xl bg-surface-container-high" />
      ))}
    </div>
  );
}
