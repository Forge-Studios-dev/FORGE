export default function WatchLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8">
      <div className="aspect-video rounded-xl bg-surface-container" />
      <div className="mt-4 h-8 w-2/3 rounded bg-surface-container" />
      <div className="mt-2 h-4 w-1/3 rounded bg-surface-container" />
    </div>
  );
}
