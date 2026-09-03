import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken } from '@/lib/auth-storage';
import { refreshAccessToken } from '@/lib/auth-refresh';
import { currentReturnPath } from '@/lib/safe-return-path';
import { getAppCheckToken } from '@/lib/app-check';
import { env } from '@/env';

const APP_CHECK_ROUTES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/analytics/events',
];

const API_URL = env.NEXT_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
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
    const url = original?.url ?? '';
    if (error.response?.status === 401 && original && !original._retry && !url.includes('/auth/refresh')) {
      original._retry = true;
      try {
        const accessToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        const next = encodeURIComponent(currentReturnPath());
        window.location.href = `/session-expired?next=${next}`;
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Server-only axios instance. Prefer `process.env.API_INTERNAL_URL` over
 * `env.API_INTERNAL_URL` — this module is also imported by client components
 * (via `api`), and t3-env throws if a server key is touched in the browser.
 */
export const serverApi = axios.create({
  baseURL:
    (typeof window === 'undefined' ? process.env.API_INTERNAL_URL : undefined) || API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export type ApiResponse<T> = { success: boolean; data: T };
