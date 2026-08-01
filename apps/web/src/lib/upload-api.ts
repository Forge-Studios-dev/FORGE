import axios from 'axios';
import { getAccessToken } from '@/lib/auth-storage';
import { refreshAccessToken } from '@/lib/auth-refresh';
import { currentReturnPath } from '@/lib/safe-return-path';

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
    const url = original?.url ?? '';
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !url.includes('/auth/refresh')
    ) {
      original._retry = true;
      try {
        const accessToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return uploadApi(original);
      } catch {
        const next = encodeURIComponent(currentReturnPath());
        window.location.href = `/session-expired?next=${next}`;
      }
    }
    return Promise.reject(error);
  },
);
