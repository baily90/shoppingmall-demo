// 用户画像存储（跨会话长期记忆）：存用户偏好/预算/用途等自然语言事实
//
// 两个关键约束：
//   1. 有上限：facts 无限增长会每轮全量注入、挤占上下文，超过上限时用压缩模型归并
//   2. 不丢更新：读-改-写用 updatedAt 做乐观锁 CAS，冲突时重试一次
import { Inject, Injectable, Logger } from '@nestjs/common';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { intEnv } from '../config/env.js';
import { compressModel } from '../llm/llm.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_FACTS = intEnv('USER_PROFILE_MAX_FACTS', 20);
const CONSOLIDATE_TO = Math.min(MAX_FACTS, intEnv('USER_PROFILE_CONSOLIDATE_TO', 12));
const CONSOLIDATE_TIMEOUT_MS = intEnv('USER_PROFILE_CONSOLIDATE_TIMEOUT_MS', 15_000);

@Injectable()
export class UserProfileStore {
  private readonly logger = new Logger(UserProfileStore.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // 读用户全部长期事实（最多 MAX_FACTS 条）
  async getFacts(userId: string): Promise<string[]> {
    const profile = await this.readProfile(userId);
    return profile.facts.slice(-MAX_FACTS);
  }

  // 追加一条事实（去空、去重；超上限时归并压缩）
  async addFact(userId: string, fact: string, attempt = 0): Promise<void> {
    const trimmed = fact?.trim();
    if (!trimmed) return;

    const { facts: existing, updatedAt } = await this.readProfile(userId);
    if (existing.includes(trimmed)) return; // 已存在，跳过

    let facts = [...existing, trimmed];
    if (facts.length > MAX_FACTS) {
      facts = await this.consolidate(facts);
    }

    // 首次写入：并发创建可能撞主键，重试一次走更新分支
    if (!updatedAt) {
      try {
        await this.prisma.userProfile.create({ data: { userId, facts: facts as never } });
      } catch (e) {
        if (attempt === 0) {
          await this.addFact(userId, trimmed, 1);
          return;
        }
        this.logger.warn(`用户画像写入失败：${e instanceof Error ? e.message : e}`);
      }
      return;
    }

    // 乐观锁：只有 updatedAt 没变才写入，避免并发 remember 互相覆盖
    const result = await this.prisma.userProfile.updateMany({
      where: { userId, updatedAt },
      data: { facts: facts as never },
    });
    if (result.count === 0 && attempt === 0) {
      await this.addFact(userId, trimmed, 1);
    }
  }

  private async readProfile(userId: string): Promise<{ facts: string[]; updatedAt?: Date }> {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const facts = Array.isArray(profile?.facts) ? (profile.facts as string[]) : [];
    return {
      facts: facts.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim()),
      updatedAt: profile?.updatedAt,
    };
  }

  // 归并压缩：去重、消解矛盾（保留新信息）、压到 CONSOLIDATE_TO 条以内。
  // 失败时退化为「保留最新的 MAX_FACTS 条」，不影响主流程。
  private async consolidate(facts: string[]): Promise<string[]> {
    try {
      const result = await generateText({
        model: compressModel,
        temperature: 0,
        abortSignal: AbortSignal.timeout(CONSOLIDATE_TIMEOUT_MS),
        output: Output.object({
          schema: z.object({
            facts: z
              .array(z.string())
              .describe(`合并后的用户画像事实，最多 ${CONSOLIDATE_TO} 条，每条一句话`),
          }),
        }),
        prompt: [
          '你是用户画像整理助手。请合并去重下面这些用户事实，消解矛盾（保留较新的信息），',
          `压缩到最多 ${CONSOLIDATE_TO} 条，每条一句话、只保留对购物推荐有用的偏好/预算/用途。`,
          '不要编造用户没提过的信息。',
          '',
          '事实列表：',
          facts.map((f, i) => `${i + 1}. ${f}`).join('\n'),
        ].join('\n'),
      });
      const merged = result.output.facts
        .map((f) => f.trim())
        .filter(Boolean)
        .slice(0, MAX_FACTS);
      return merged.length > 0 ? merged : facts.slice(-MAX_FACTS);
    } catch (e) {
      this.logger.warn(
        `用户画像归并失败，退化为保留最新 ${MAX_FACTS} 条：${e instanceof Error ? e.message : e}`,
      );
      return facts.slice(-MAX_FACTS);
    }
  }
}
