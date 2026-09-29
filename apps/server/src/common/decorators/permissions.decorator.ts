import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * 声明接口所需的权限码（<模块>:<动作>，如 'user:create'）。
 * 需配合 PermissionsGuard 使用，要求当前管理员同时拥有传入的全部权限码。
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
