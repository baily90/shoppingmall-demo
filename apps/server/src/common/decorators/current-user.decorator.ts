import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 管理端鉴权后挂到 request 上的上下文（由 AdminJwtAuthGuard 填充） */
export interface AdminContext {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
  roles: string[];
  permissions: string[];
}

/** C 端鉴权后挂到 request 上的上下文（由 UserJwtAuthGuard 填充） */
export interface UserContext {
  id: number;
  phone: string;
  nickname: string;
  avatar: string | null;
}

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.adminUser;
  },
);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
