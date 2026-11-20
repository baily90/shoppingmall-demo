// 每日用量预算：按用户限制「对话次数 + token 消耗」，防止单个账号把模型额度刷爆。
//
// 设计取舍：
//   - 先查后扣，允许并发下少量超额（不做预占），实现简单、不阻塞主流程
//   - 用量表按 (user_id, day) 聚合，UTC 自然日
//   - 预算表读写失败时 fail-open（记日志放行），避免基础设施抖动导致客服整体不可用
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { intEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DAILY_REQUEST_LIMIT = intEnv('DAILY_REQUEST_LIMIT', 300);
const DAILY_TOKEN_LIMIT = intEnv('DAILY_TOKEN_LIMIT', 300_000);

function utcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class UsageStore {
  private readonly logger = new Logger(UsageStore.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // 发消息前检查预算，超限抛 429
  async assertWithinBudget(userId: string): Promise<void> {
    try {
      const usage = await this.prisma.userUsageDaily.findUnique({
        where: { userId_day: { userId, day: utcDay() } },
      });
      if (!usage) return;
      if (usage.requests >= DAILY_REQUEST_LIMIT) {
        throw new HttpException('今日对话次数已达上限，请明天再试', 429);
      }
      if (usage.tokens >= DAILY_TOKEN_LIMIT) {
        throw new HttpException('今日对话额度已用完，请明天再试', 429);
      }
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.warn(`用量预算检查失败（放行）：${e instanceof Error ? e.message : e}`);
    }
  }

  // 流结束后记一次用量（失败只记日志，不影响已发出的回答）
  async recordUsage(userId: string, tokens: number): Promise<void> {
    const day = utcDay();
    try {
      await this.prisma.userUsageDaily.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, requests: 1, tokens: Math.max(0, tokens) },
        update: {
          requests: { increment: 1 },
          tokens: { increment: Math.max(0, tokens) },
        },
      });
    } catch (e) {
      this.logger.warn(`用量记录失败：${e instanceof Error ? e.message : e}`);
    }
  }
}
