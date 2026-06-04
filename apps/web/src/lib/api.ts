import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearAuthSession,
  getAccessToken,
  persistAuthSession,
  syncAuthCookieFromStorage,
} from '@/lib/auth-storage';
import { currentReturnPath } from '@/lib/safe-return-path';
import { getAppCheckToken } from '@/lib/app-check';
import { csrfRequestHeaders } from '@/lib/csrf';

const APP_CHECK_ROUTES = ['/auth/login', '/auth/signup', '/analytics/events'];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    syncAuthCookieFromStorage();
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const path = config.url ?? '';
    if (APP_CHECK_ROUTES.some((r) => path.includes(r)) && config.headers) {
      const appCheck = await getAppCheckToken();
      if (appCheck) config.headers['X-Firebase-AppCheck'] = appCheck;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true, headers: csrfRequestHeaders() },
        );
        const accessToken = data.data.accessToken as string;
        const newRefresh = data.data.refreshToken as string | undefined;
        const refreshedUser = data.data.user;
        persistAuthSession(
          accessToken,
          newRefresh,
          refreshedUser ? JSON.stringify(refreshedUser) : undefined,
          data.data.sessionId as string | undefined,
        );
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        clearAuthSession();
        const next = encodeURIComponent(currentReturnPath());
        window.location.href = `/session-expired?next=${next}`;
      }
    }
    return Promise.reject(error);
  },
);

export const serverApi = axios.create({
  baseURL: process.env.API_INTERNAL_URL || API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export type ApiResponse<T> = { success: boolean; data: T };
