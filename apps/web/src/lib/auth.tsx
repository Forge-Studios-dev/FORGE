'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { csrfRequestHeaders } from '@/lib/csrf';
import {
  AUTH_SESSION_EVENT,
  clearAuthSession,
  getAccessToken,
  persistAuthSession,
} from '@/lib/auth-storage';
import { getStoredUser } from '@/lib/permissions';
import {
  canApplyForCreator,
  canEngage,
  canGoLive,
  canUpload,
  canUseLibrary,
  canViewPersonalizedFeed,
  getTier,
  isApprovedCreator,
  isPlatformAdmin,
  type AccessTier,
} from '@/lib/access';
import { disconnectSocket } from '@/lib/socket';
import { User } from '@/types';

type AuthContextValue = {
  user: User | null;
  isGuest: boolean;
  isLoading: boolean;
  /** YouTube-style access tier (guest → viewer → creator_* → admin). */
  accessTier: AccessTier;
  isCreator: boolean;
  isPending: boolean;
  isRejected: boolean;
  canEngage: boolean;
  canUseLibrary: boolean;
  canUpload: boolean;
  canGoLive: boolean;
  canApplyForCreator: boolean;
  /** Platform operator — use admin app, not consumer Studio/upload. */
  isPlatformAdmin: boolean;
  /** Signed-in personalized feed (YouTube For You). */
  canViewPersonalizedFeed: boolean;
  role: User['role'] | null;
  /** JWT for Socket.IO and other client-only realtime (null when guest). */
  accessToken: string | null;
  refresh: () => void;
  logout: (options?: { allDevices?: boolean }) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Window-focus remounts were calling GET /users/me on every Alt-Tab; throttle quiet revisits. */
const ME_FOCUS_MIN_INTERVAL_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  /** False until mount — keeps SSR and first client paint identical (avoids hydration errors). */
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const lastMeFetchAtRef = useRef(0);

  const refresh = useCallback(() => {
    setUser(getStoredUser());
  }, []);

  const fetchMe = useCallback(
    (opts?: { force?: boolean }) => {
      const token = getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      const now = Date.now();
      if (!opts?.force && now - lastMeFetchAtRef.current < ME_FOCUS_MIN_INTERVAL_MS) {
        setUser(getStoredUser());
        return;
      }
      lastMeFetchAtRef.current = now;
      setIsLoading(true);
      api
        .get<{ data: User }>('/users/me')
        .then(({ data }) => {
          const me = data.data;
          if (me.role === 'admin') {
            clearAuthSession();
            setUser(null);
            return;
          }
          localStorage.setItem('forge_user', JSON.stringify(me));
          setUser(me);
        })
        .catch((err: { response?: { status?: number } }) => {
          if (err.response?.status === 401) {
            clearAuthSession();
            setUser(null);
            const next =
              typeof window !== 'undefined'
                ? window.location.pathname + window.location.search
                : '';
            router.replace(
              next ? `/session-expired?next=${encodeURIComponent(next)}` : '/session-expired',
            );
            return;
          }
          setUser(getStoredUser());
        })
        .finally(() => setIsLoading(false));
    },
    [router],
  );

  useEffect(() => {
    refresh();
    setHydrated(true);
    fetchMe({ force: true });

    const onSessionChange = () => {
      refresh();
      fetchMe({ force: true });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'forge_user' || e.key === 'forge_session_id') onSessionChange();
    };
    const onFocus = () => {
      refresh();
      fetchMe();
    };

    window.addEventListener(AUTH_SESSION_EVENT, onSessionChange);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, onSessionChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh, fetchMe]);

  const logout = useCallback(
    (options?: { allDevices?: boolean }) => {
      const token = getAccessToken();
      if (token) {
        // CSRF required when forge_refresh cookie is present (cookie sessions).
        void api
          .post(
            '/auth/logout',
            { allDevices: !!options?.allDevices },
            { headers: csrfRequestHeaders() },
          )
          .catch(() => undefined);
      }
      clearAuthSession();
      disconnectSocket();
      setUser(null);
      router.push('/login');
    },
    [router],
  );

  const value = useMemo<AuthContextValue>(() => {
    if (!hydrated) {
      return {
        user: null,
        isGuest: true,
        isLoading: true,
        accessTier: 'guest',
        isCreator: false,
        isPending: false,
        isRejected: false,
        canEngage: false,
        canUseLibrary: false,
        canUpload: false,
        canGoLive: false,
        canApplyForCreator: false,
        isPlatformAdmin: false,
        canViewPersonalizedFeed: false,
        role: null,
        accessToken: null,
        refresh,
        logout,
      };
    }
    const token = getAccessToken();
    const hasToken = !!token;
    const isGuest = !hasToken || (!isLoading && !user);
    const accessTier = getTier(user, hasToken && !!user);
    const isCreator = isApprovedCreator(accessTier);
    const platformAdmin = isPlatformAdmin(accessTier);
    const isPending = accessTier === 'creator_pending';
    const isRejected = accessTier === 'creator_rejected';
    const session = hasToken && !!user;
    return {
      user,
      isGuest,
      isLoading: hasToken && isLoading,
      accessTier,
      isCreator,
      isPending,
      isRejected,
      canEngage: canEngage(user, session),
      canUseLibrary: canUseLibrary(user, session),
      canUpload: canUpload(user, session),
      canGoLive: canGoLive(user, session),
      canApplyForCreator: canApplyForCreator(accessTier),
      isPlatformAdmin: platformAdmin,
      canViewPersonalizedFeed: canViewPersonalizedFeed(accessTier),
      role: user?.role ?? null,
      accessToken: token,
      refresh,
      logout,
    };
  }, [hydrated, user, isLoading, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { persistAuthSession };
