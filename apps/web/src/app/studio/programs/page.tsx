'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Programs are now managed as the "Programs" tab inside Studio Courses — a
 * program is a Course row with isBundle=true (see
 * apps/api/.../1839800000000-merge-programs-into-courses.ts). Named "Programs",
 * not "Bundles", to avoid colliding with the separate, pre-existing
 * /studio/bundles feature (tier-entitlement resource bundles). This route
 * stays only to send old bookmarks/links to the right place.
 */
export default function StudioProgramsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/studio/courses?tab=programs');
  }, [router]);

  return (
    <main className="space-y-6">
      <p className="text-sm text-on-surface-variant">Redirecting to Courses → Programs…</p>
    </main>
  );
}
