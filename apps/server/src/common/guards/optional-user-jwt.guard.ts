import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExtractJwt } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { UserContext } from '../decorators/current-user.decorator';

/**
 * 可选 C 端鉴权：带合法 user token 时把用户挂到 request.user，无 token / token 无效则按匿名放行。
 * 用于「公开接口里识别当前用户」的场景（如商品评价列表标记 mine，供详情页置顶「我的评价」）。
 */
@Injectable()
export class OptionalUserJwtGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);
    if (!token) return true;

    try {
      const ok = (await super.canActivate(context)) as boolean;
      if (!ok) return true;

      const payload = request.user as JwtPayload;
      if (payload.type !== 'user') return true;

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status !== 1) return true;

      const ctx: UserContext = {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
      };
      request.user = ctx;
    } catch {
      // token 无效/过期，按匿名处理
    }
    return true;
  }
}
