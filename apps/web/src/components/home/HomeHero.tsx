'use client';

import { useAuth } from '@/lib/auth';
import { HeroSection } from '@/components/HeroSection';

/** Marketing hero — guests only (logged-in users see feed-first home per Stitch blueprint) */
export function HomeHero() {
  const { isGuest } = useAuth();
  if (!isGuest) return null;
  return (
    <div className="forge-slide-up mb-10">
      <HeroSection />
    </div>
  );
}
