export default function ExploreLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-4 px-4 py-8">
      <div className="h-8 w-48 rounded bg-surface-container" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-video rounded-xl bg-surface-container" />
        ))}
      </div>
    </div>
  );
}
