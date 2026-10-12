import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ErrorCode } from '@mall/shared';
import { BusinessException } from '../common/exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../permission/permission.service';
import { TokenService } from './token.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly tokenService: TokenService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { username: dto.username },
    });
    if (!admin || admin.status !== 1) {
      throw new BusinessException(ErrorCode.BAD_CREDENTIALS, '账号或密码错误');
    }
    const ok = await bcrypt.compare(dto.password, admin.password);
    if (!ok) {
      throw new BusinessException(ErrorCode.BAD_CREDENTIALS, '账号或密码错误');
    }

    const tokens = await this.tokenService.issueTokens(admin.id, 'admin');
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      ...tokens,
      user: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        avatar: this.storage.toPublicUrl(admin.avatar),
      },
    };
  }

  async refresh(refreshToken: string) {
    return this.tokenService.rotate(refreshToken, 'admin');
  }

  async logout(refreshToken: string) {
    await this.tokenService.revoke(refreshToken, 'admin');
    return null;
  }

  async profile(adminId: number) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      include: { roles: { include: { role: true } } },
    });
    if (!admin) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '账号不存在');
    }

    const [permissions, menus] = await Promise.all([
      this.permissionService.getAdminPermissionCodes(adminId),
      this.permissionService.getAdminMenus(adminId),
    ]);

    return {
      id: admin.id,
      username: admin.username,
      nickname: admin.nickname,
      avatar: this.storage.toPublicUrl(admin.avatar),
      roles: admin.roles.map((ur) => ur.role.code),
      permissions,
      menus,
    };
  }
}
