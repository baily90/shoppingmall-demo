import type { ApiResponse } from '@mall/shared';
import request from './request';

export interface UserInfo {
  id: number;
  phone: string;
  nickname: string;
  avatar: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export const login = (phone: string, password: string) =>
  request.post<ApiResponse<LoginResult>>('/auth/login', { phone, password });

export const register = (phone: string, password: string, nickname?: string) =>
  request.post<ApiResponse<LoginResult>>('/auth/register', { phone, password, nickname });

export const logout = (refreshToken: string) => request.post('/auth/logout', { refreshToken });

export const getProfile = () => request.get<ApiResponse<UserInfo>>('/auth/profile');
