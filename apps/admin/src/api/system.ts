import request from './request';
import type { MenuNode } from './auth';

export interface AdminUserRow {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
  status: number;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { role: { id: number; name: string; code: string } }[];
}

export interface RoleRow {
  id: number;
  name: string;
  code: string;
  description: string | null;
  status: number;
  sort: number;
  permissions: { permissionId: number }[];
}

export interface CreateUserPayload {
  username: string;
  password: string;
  nickname: string;
  status?: number;
  roleIds?: number[];
}

export interface UpdateUserPayload {
  nickname?: string;
  status?: number;
  password?: string;
}

export interface CreateRolePayload {
  name: string;
  code: string;
  description?: string;
  status?: number;
  sort?: number;
}

export interface UpdateRolePayload {
  name?: string;
  code?: string;
  description?: string;
  status?: number;
  sort?: number;
}

export interface CreatePermissionPayload {
  parentId?: number | null;
  type: number;
  name: string;
  code: string;
  path?: string;
  icon?: string;
  sort?: number;
  status?: number;
}

export interface UpdatePermissionPayload {
  parentId?: number | null;
  type?: number;
  name?: string;
  code?: string;
  path?: string;
  icon?: string;
  sort?: number;
  status?: number;
}

export interface PageResult<T> {
  list: T[];
  total: number;
}

export interface PageQuery {
  page: number;
  pageSize: number;
  keyword?: string;
}

// ==================== 用户 ====================
export const listUsers = (params: PageQuery) =>
  request.get<{ code: number; data: PageResult<AdminUserRow>; message: string }>('/admin/users', {
    params,
  });
export const createUser = (data: CreateUserPayload) => request.post('/admin/users', data);
export const updateUser = (id: number, data: UpdateUserPayload) =>
  request.patch(`/admin/users/${id}`, data);
export const deleteUser = (id: number) => request.delete(`/admin/users/${id}`);
export const assignUserRoles = (id: number, roleIds: number[]) =>
  request.put(`/admin/users/${id}/roles`, { roleIds });

// ==================== 角色 ====================
export const listRoles = (params: PageQuery) =>
  request.get<{ code: number; data: PageResult<RoleRow>; message: string }>('/admin/roles', {
    params,
  });
export const createRole = (data: CreateRolePayload) => request.post('/admin/roles', data);
export const updateRole = (id: number, data: UpdateRolePayload) =>
  request.patch(`/admin/roles/${id}`, data);
export const deleteRole = (id: number) => request.delete(`/admin/roles/${id}`);
export const assignRolePermissions = (id: number, permissionIds: number[]) =>
  request.put(`/admin/roles/${id}/permissions`, { permissionIds });

// ==================== 权限 ====================
export const listPermissions = () =>
  request.get<{ code: number; data: MenuNode[]; message: string }>('/admin/permissions');
export const createPermission = (data: CreatePermissionPayload) =>
  request.post('/admin/permissions', data);
export const updatePermission = (id: number, data: UpdatePermissionPayload) =>
  request.patch(`/admin/permissions/${id}`, data);
export const deletePermission = (id: number) => request.delete(`/admin/permissions/${id}`);
