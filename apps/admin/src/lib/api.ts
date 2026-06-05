import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/env';
import { csrfRequestHeaders } from '@/lib/csrf';
import {
  clearAdminSession,
  getAdminAccessToken,
  persistAdminSession,
  setAdminAccessCookie,
} from '@/lib/auth-storage';

const API_URL = env.NEXT_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getAdminAccessToken();
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true, headers: csrfRequestHeaders() },
        );
        const accessToken = data.data.accessToken as string;
        persistAdminSession(accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        clearAdminSession();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export async function adminLogout(options?: { allDevices?: boolean }) {
  try {
    await api.post('/auth/logout', { allDevices: !!options?.allDevices });
  } catch {
    /* still clear local session */
  }
  clearAdminSession();
}

/** @deprecated use persistAdminSession */
export { setAdminAccessCookie };
