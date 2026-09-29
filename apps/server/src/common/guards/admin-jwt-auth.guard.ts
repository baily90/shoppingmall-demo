import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCode } from '@mall/shared';
import { BusinessException } from '../exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { AdminContext } from '../decorators/current-user.decorator';

/**
 * 管理端鉴权守卫：校验 accessToken（type=admin）→ 加载管理员 → 校验状态
 * → 把 {id, username, nickname, avatar, roles, permissions} 挂到 request.adminUser。
 */
@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;

    const request = context.switchToHttp().getRequest();
    const payload = request.user as JwtPayload;

    if (payload.type !== 'admin') {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '未登录或登录已失效');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!admin || admin.status !== 1) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '账号不存在或已被禁用');
    }

    const ctx: AdminContext = {
      id: admin.id,
      username: admin.username,
      nickname: admin.nickname,
      avatar: admin.avatar,
      roles: admin.roles.map((ur) => ur.role.code),
      permissions: [
        ...new Set(
          admin.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
        ),
      ],
    };
    request.adminUser = ctx;
    return true;
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '未登录或登录已失效');
    }
    return user;
  }
}
