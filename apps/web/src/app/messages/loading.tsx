import { SkeletonBlock } from '@forge/design-system';

export default function MessagesLoading() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-4 px-5 py-8 md:flex-row md:px-12">
      <div className="w-full space-y-2 md:w-72">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-16 w-full" />
        ))}
      </div>
      <div className="flex-1 space-y-3">
        <SkeletonBlock className="h-full min-h-[300px] w-full" />
      </div>
    </main>
  );
}
