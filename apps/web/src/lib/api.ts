import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  persistAuthSession,
  syncAuthCookieFromStorage,
} from '@/lib/auth-storage';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    syncAuthCookieFromStorage();
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const accessToken = data.data.accessToken as string;
        const newRefresh = data.data.refreshToken as string;
        const refreshedUser = data.data.user;
        persistAuthSession(
          accessToken,
          newRefresh,
          refreshedUser ? JSON.stringify(refreshedUser) : undefined,
        );
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        clearAuthSession();
        const next = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
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
