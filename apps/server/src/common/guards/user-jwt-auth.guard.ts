import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCode } from '@mall/shared';
import { BusinessException } from '../exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { UserContext } from '../decorators/current-user.decorator';

/**
 * C 端鉴权守卫：校验 accessToken（type=user）→ 加载会员 → 挂到 request.user。
 */
@Injectable()
export class UserJwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;

    const request = context.switchToHttp().getRequest();
    const payload = request.user as JwtPayload;

    if (payload.type !== 'user') {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '未登录或登录已失效');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 1) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '账号不存在或已被禁用');
    }

    const ctx: UserContext = {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
    };
    request.user = ctx;
    return true;
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '未登录或登录已失效');
    }
    return user;
  }
}
