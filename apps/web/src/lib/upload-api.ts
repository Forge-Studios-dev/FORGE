import axios from 'axios';
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  persistAuthSession,
  syncAuthCookieFromStorage,
} from '@/lib/auth-storage';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/** Long-running uploads (proxy fallback); separate from default 15s API client. */
export const uploadApi = axios.create({
  baseURL: API_URL,
  timeout: 0,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
});

uploadApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    syncAuthCookieFromStorage();
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
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const accessToken = data.data.accessToken as string;
        const newRefresh = data.data.refreshToken as string;
        persistAuthSession(
          accessToken,
          newRefresh,
          data.data.user ? JSON.stringify(data.data.user) : undefined,
        );
        original.headers.Authorization = `Bearer ${accessToken}`;
        return uploadApi(original);
      } catch {
        clearAuthSession();
        window.location.href = '/session-expired';
      }
    }
    return Promise.reject(error);
  },
);
