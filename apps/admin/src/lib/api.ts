import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('forge_admin_token');
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
      const refreshToken = localStorage.getItem('forge_admin_refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const accessToken = data.data.accessToken as string;
          localStorage.setItem('forge_admin_token', accessToken);
          localStorage.setItem('forge_admin_refresh_token', data.data.refreshToken as string);
          document.cookie = `forge_admin_token=${encodeURIComponent(accessToken)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        } catch {
          /* fall through */
        }
      }
      localStorage.removeItem('forge_admin_token');
      localStorage.removeItem('forge_admin_refresh_token');
      document.cookie = 'forge_admin_token=; path=/; max-age=0';
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
