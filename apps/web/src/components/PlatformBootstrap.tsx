'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AUTH_SESSION_EVENT } from '@/lib/auth-storage';
import { registerFcmTokenIfPossible } from '@/lib/fcm';
import { trackPageView } from '@/lib/analytics';

/** FCM registration + sampled page analytics after auth. */
export function PlatformBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    void registerFcmTokenIfPossible();
    const onAuth = () => void registerFcmTokenIfPossible();
    window.addEventListener(AUTH_SESSION_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, onAuth);
  }, []);

  return null;
}
