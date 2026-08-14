import axios from 'axios';
import { clearAuthSession, persistAuthSession } from '@/lib/auth-storage';
import { csrfRequestHeaders } from '@/lib/csrf';
import { env } from '@/env';

const API_URL = env.NEXT_PUBLIC_API_URL;

/** Single-flight refresh so parallel 401s don't stampede `/auth/refresh`. */
let inflight: Promise<string> | null = null;

/**
 * Refresh the access token using the HttpOnly refresh cookie.
 * Concurrent callers share one in-flight request.
 */
export function refreshAccessToken(): Promise<string> {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data } = await axios.post(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true, headers: csrfRequestHeaders(), timeout: 10_000 },
      );
      const accessToken = data.data.accessToken as string;
      persistAuthSession(
        accessToken,
        data.data.refreshToken as string | undefined,
        data.data.user ? JSON.stringify(data.data.user) : undefined,
        data.data.sessionId as string | undefined,
      );
      return accessToken;
    } catch (err) {
      clearAuthSession();
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
