import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@mall/shared';
import { BusinessException } from '../exceptions/business.exception';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * 权限守卫：读取 @Permissions() 元数据，校验 request.adminUser.permissions
 * 是否包含全部要求的权限码，缺失则抛 10003（403）。
 * 必须在 AdminJwtAuthGuard 之后执行（依赖其挂载的 adminUser 上下文）。
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const owned = new Set<string>((request.adminUser?.permissions as string[]) ?? []);

    const missing = required.filter((code) => !owned.has(code));
    if (missing.length > 0) {
      throw new BusinessException(ErrorCode.FORBIDDEN, '无权限', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
