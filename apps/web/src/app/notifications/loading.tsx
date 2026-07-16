import { SkeletonBlock } from '@forge/design-system';

export default function NotificationsLoading() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <SkeletonBlock className="mb-8 h-8 w-48" />
      <ul className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <SkeletonBlock className="h-16 w-full" />
          </li>
        ))}
      </ul>
    </main>
  );
}
