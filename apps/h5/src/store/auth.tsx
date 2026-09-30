import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as userApi from '../api/user';
import type { UserInfo } from '../api/user';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../api/request';

interface AuthContextValue {
  user: UserInfo | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (getAccessToken()) {
      userApi
        .getProfile()
        .then((res) => setUser(res.data.data))
        .catch(() => clearTokens())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const res = await userApi.login(phone, password);
    setTokens(res.data.data.accessToken, res.data.data.refreshToken);
    setUser(res.data.data.user);
  }, []);

  const register = useCallback(async (phone: string, password: string, nickname?: string) => {
    const res = await userApi.register(phone, password, nickname);
    setTokens(res.data.data.accessToken, res.data.data.refreshToken);
    setUser(res.data.data.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await userApi.logout(refreshToken);
      } catch {
        // 忽略登出接口异常，本地仍清理
      }
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
