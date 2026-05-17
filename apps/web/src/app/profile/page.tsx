'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { user, isGuest } = useAuth();

  useEffect(() => {
    if (isGuest) {
      router.replace('/login?next=/profile');
      return;
    }
    if (user?.username) {
      router.replace(`/${user.username}`);
    }
  }, [user, isGuest, router]);

  return (
    <main className="flex min-h-[40vh] items-center justify-center text-on-surface-variant">
      Loading profile…
    </main>
  );
}
