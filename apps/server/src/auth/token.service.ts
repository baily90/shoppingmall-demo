import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { ErrorCode } from '@mall/shared';
import { BusinessException } from '../common/exceptions/business.exception';
import { RedisService } from '../redis/redis.service';
import { JwtPayload } from './strategies/jwt.strategy';

export type TokenType = 'admin' | 'user';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * JWT 双 token 的签发/校验/轮换/撤销：
 * - accessToken：无状态、短期（签名后即返回，不落库）
 * - refreshToken：长期、带 jti，落 Redis（登出删除即失效，刷新时轮换）
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async issueTokens(sub: number, type: TokenType): Promise<TokenPair> {
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const accessExpiresIn = parseInt(
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '900'),
      10,
    );
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = parseInt(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '604800'),
      10,
    );

    const accessToken = await this.jwtService.signAsync(
      { sub, type },
      { secret: accessSecret, expiresIn: accessExpiresIn },
    );

    const jti = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { sub, type, jti },
      { secret: refreshSecret, expiresIn: refreshExpiresIn },
    );

    await this.redisService.set(this.refreshKey(jti), `${type}:${sub}`, refreshExpiresIn);

    return { accessToken, refreshToken };
  }

  /** 刷新：校验 refreshToken 并在 Redis 中确认未撤销，然后轮换（旧 jti 失效） */
  async rotate(refreshToken: string, type: TokenType): Promise<TokenPair> {
    const payload = this.verifyRefresh(refreshToken, type);
    const stored = await this.redisService.get(this.refreshKey(payload.jti!));
    if (stored !== `${type}:${payload.sub}`) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '登录已失效，请重新登录');
    }
    await this.redisService.del(this.refreshKey(payload.jti!));
    return this.issueTokens(payload.sub, type);
  }

  /** 登出：删除 refreshToken，使其立即失效 */
  async revoke(refreshToken: string, type: TokenType): Promise<void> {
    const payload = this.verifyRefresh(refreshToken, type);
    await this.redisService.del(this.refreshKey(payload.jti!));
  }

  private verifyRefresh(token: string, type: TokenType): JwtPayload {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      }) as JwtPayload;
      if (payload.type !== type) {
        throw new BusinessException(ErrorCode.UNAUTHORIZED, '登录已失效，请重新登录');
      }
      return payload;
    } catch (e) {
      if (e instanceof BusinessException) throw e;
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '登录已失效，请重新登录');
    }
  }

  private refreshKey(jti: string): string {
    return `auth:refresh:${jti}`;
  }
}
