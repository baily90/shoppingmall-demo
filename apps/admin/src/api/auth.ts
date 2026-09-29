import request from './request';

export interface AdminUserInfo {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
}

export interface MenuNode {
  id: number;
  parentId?: number | null;
  code: string;
  name: string;
  type: number;
  path: string | null;
  icon: string | null;
  sort: number;
  status?: number;
  children: MenuNode[];
}

export interface AdminProfile {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
  roles: string[];
  permissions: string[];
  menus: MenuNode[];
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AdminUserInfo;
}

export const login = (username: string, password: string) =>
  request.post<{ code: number; data: LoginResult; message: string }>('/admin/auth/login', {
    username,
    password,
  });

export const logout = (refreshToken: string) =>
  request.post('/admin/auth/logout', { refreshToken });

export const getProfile = () =>
  request.get<{ code: number; data: AdminProfile; message: string }>('/admin/auth/profile');
