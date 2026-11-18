// 用户画像存储（跨会话长期记忆）：存用户偏好/预算/用途等自然语言事实
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UserProfileStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // 读用户全部长期事实
  async getFacts(userId: string): Promise<string[]> {
    const p = await this.prisma.userProfile.findUnique({ where: { userId } });
    return (p?.facts as string[] | undefined) ?? [];
  }

  // 追加一条事实（去空、去重，upsert）
  async addFact(userId: string, fact: string): Promise<void> {
    const trimmed = fact?.trim();
    if (!trimmed) return;
    const existing = await this.getFacts(userId);
    if (existing.includes(trimmed)) return; // 已存在，跳过
    const facts = [...existing, trimmed];
    await this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId, facts: facts as never },
      update: { facts: facts as never },
    });
  }
}
