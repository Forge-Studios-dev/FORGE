export default function WatchLoading() {
  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <div className="mb-8 h-10 w-48 animate-pulse rounded-lg bg-surface-container-high" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="aspect-video w-full animate-pulse rounded-xl bg-surface-container-high" />
          <div className="space-y-3">
            <div className="h-6 w-3/4 animate-pulse rounded bg-surface-container-high" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-container-high" />
          </div>
          <div className="glass-panel h-48 animate-pulse rounded-xl" />
        </div>
        <aside className="space-y-4">
          <div className="h-5 w-32 animate-pulse rounded bg-surface-container-high" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-container-high" />
          ))}
        </aside>
      </div>
    </main>
  );
}
