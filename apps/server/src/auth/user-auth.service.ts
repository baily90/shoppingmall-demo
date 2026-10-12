import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ErrorCode } from '@mall/shared';
import { BusinessException } from '../common/exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.service';
import { RegisterDto } from './dto/register.dto';
import { UserLoginDto } from './dto/user-login.dto';

@Injectable()
export class UserAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (exists) {
      throw new BusinessException(ErrorCode.PHONE_REGISTERED, '手机号已注册');
    }

    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        password,
        nickname: dto.nickname ?? `用户${dto.phone.slice(-4)}`,
      },
    });

    const tokens = await this.tokenService.issueTokens(user.id, 'user');
    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar: this.storage.toPublicUrl(user.avatar),
      },
    };
  }

  async login(dto: UserLoginDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user || user.status !== 1) {
      throw new BusinessException(ErrorCode.BAD_CREDENTIALS, '账号或密码错误');
    }
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      throw new BusinessException(ErrorCode.BAD_CREDENTIALS, '账号或密码错误');
    }

    const tokens = await this.tokenService.issueTokens(user.id, 'user');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar: this.storage.toPublicUrl(user.avatar),
      },
    };
  }

  async refresh(refreshToken: string) {
    return this.tokenService.rotate(refreshToken, 'user');
  }

  async logout(refreshToken: string) {
    await this.tokenService.revoke(refreshToken, 'user');
    return null;
  }

  async profile(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '账号不存在');
    }
    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: this.storage.toPublicUrl(user.avatar),
      gender: user.gender,
    };
  }
}
