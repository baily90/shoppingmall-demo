import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ErrorCode } from '@mall/shared';

const ACCESS_TOKEN_KEY = 'mall_access_token';
const REFRESH_TOKEN_KEY = 'mall_refresh_token';

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setTokens = (access: string, refresh: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const request = axios.create({ baseURL: '/api', timeout: 10000 });

request.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const code = (error.response?.data as { code?: number } | undefined)?.code;
    const original = error.config as RetriableConfig | undefined;

    // 未登录/accessToken 过期 → 用 refreshToken 换新后重试一次
    if (
      code === ErrorCode.UNAUTHORIZED &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      original._retry = true;
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }
      try {
        const res = await axios.post('/api/admin/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefresh } = res.data.data as {
          accessToken: string;
          refreshToken: string;
        };
        setTokens(accessToken, newRefresh);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return request(original);
      } catch {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? error.message ?? '请求失败';
  }
  return '请求失败';
}

export default request;
