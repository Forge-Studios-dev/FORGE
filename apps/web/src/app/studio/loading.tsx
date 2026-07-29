export default function StudioLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-48 rounded bg-surface-container" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-surface-container" />
        ))}
      </div>
    </div>
  );
}
