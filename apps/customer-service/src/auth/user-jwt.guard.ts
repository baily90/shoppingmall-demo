import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface UserContext {
  userId: string;
}

// 用户 JWT 鉴权：复用 mall-server 签发的用户 accessToken（同一把 JWT_ACCESS_SECRET）
// 只认 type === 'user' 的 token（admin token 不允许访问客服），校验通过后把 userId 挂到 req.user
//
// 注意：本服务用 tsx(esbuild) 运行，不发射 design:paramtypes 元数据，
// 构造注入必须显式 @Inject（与项目里其它 service 一致）。
@Injectable()
export class UserJwtGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: UserContext }>();
    const auth = req.headers.authorization;
    if (!auth) throw new UnauthorizedException('缺少登录凭证');

    const token = auth.replace(/^Bearer\s+/i, '');
    let payload: { sub?: unknown; type?: unknown };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      }) as typeof payload;
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }

    if (payload.type !== 'user' || payload.sub == null) {
      throw new UnauthorizedException('仅限用户访问');
    }
    req.user = { userId: String(payload.sub) };
    return true;
  }
}
