'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const PREFIX = 'forge:feed-scroll:';

function storageKey(pathname: string, search: string): string {
  return `${PREFIX}${pathname}${search}`;
}

/**
 * Restore vertical scroll for feed pages when returning from watch (YouTube-style back).
 * Uses sessionStorage — cleared when the tab closes.
 */
export function useFeedScrollRestore(enabled = true) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const restoredRef = useRef(false);
  const key = storageKey(pathname, search ? `?${search}` : '');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const save = () => {
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch {
        /* quota / private mode */
      }
    };

    window.addEventListener('scroll', save, { passive: true });
    return () => {
      save();
      window.removeEventListener('scroll', save);
    };
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || restoredRef.current || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const y = parseInt(raw, 10);
      if (!Number.isFinite(y) || y <= 0) return;
      restoredRef.current = true;
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    } catch {
      /* ignore */
    }
  }, [key, enabled]);
}
