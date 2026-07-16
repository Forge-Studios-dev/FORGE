import axios from 'axios';
import { clearAuthSession, getAccessToken, persistAuthSession } from '@/lib/auth-storage';
import { currentReturnPath } from '@/lib/safe-return-path';
import { csrfRequestHeaders } from '@/lib/csrf';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/** Long-running uploads (proxy fallback); separate from default 15s API client. */
export const uploadApi = axios.create({
  baseURL: API_URL,
  timeout: 0,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
  withCredentials: true,
});

uploadApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

uploadApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, {
          withCredentials: true,
          headers: csrfRequestHeaders(),
        });
        const accessToken = data.data.accessToken as string;
        persistAuthSession(
          accessToken,
          data.data.refreshToken,
          data.data.user ? JSON.stringify(data.data.user) : undefined,
          data.data.sessionId as string | undefined,
        );
        original.headers.Authorization = `Bearer ${accessToken}`;
        return uploadApi(original);
      } catch {
        clearAuthSession();
        const next = encodeURIComponent(currentReturnPath());
        window.location.href = `/session-expired?next=${next}`;
      }
    }
    return Promise.reject(error);
  },
);
