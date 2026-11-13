// 会话状态存储：append-only 消息日志 + 会话压缩状态（summary / 水位线 / slots）
//
// 设计要点（对应"事件溯源 + 派生投影"）：
//   1. chat_messages 是唯一真相（append-only），窗口原文不落库，靠水位线懒重建
//   2. chat_session_states 只存不可重建的部分：summary / summary_up_to_seq / slots
//   3. 并发：消息 seq 用 FOR UPDATE 悲观锁串行化；状态推进用乐观锁（CAS）
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type MessageRole = 'user' | 'assistant' | 'tool';

export interface AppendMessageInput {
  sessionId: string;
  role: MessageRole;
  parts: unknown; // UIMessage 的 parts（JSON），权威格式
  tokenEst?: number;
}

export interface UpdateStateInput {
  sessionId: string;
  summary: string | null;
  summaryUpToSeq: number;
  slots: unknown;
  expectedUpToSeq: number; // 乐观锁：推进前的水位线，不匹配则 CAS 失败
}

@Injectable()
export class SessionStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // —— 会话 ——
  async getSession(sessionId: string) {
    return this.prisma.chatSession.findUnique({ where: { id: sessionId } });
  }

  // —— 消息（append-only）——
  // 追加一条消息：事务内 FOR UPDATE 锁 session 行，保证同会话 seq 唯一且单调
  // 调用方需先确保 session 存在（否则外键约束失败）
  async appendMessage(input: AppendMessageInput) {
    const { sessionId, role, parts, tokenEst = 0 } = input;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM customer_service.chat_sessions WHERE id = ${sessionId} FOR UPDATE`;
      const rows = await tx.$queryRaw<Array<{ max: number }>>`
        SELECT COALESCE(MAX(seq), 0) AS max
        FROM customer_service.chat_messages
        WHERE session_id = ${sessionId}
      `;
      const seq = Number(rows[0]?.max ?? 0) + 1;
      return tx.chatMessage.create({
        data: {
          sessionId,
          seq,
          role,
          parts: parts as Prisma.InputJsonValue,
          tokenEst,
        },
      });
    });
  }

  // hydration：拉全部消息（按 seq 升序），前端挂载时回填
  async listMessages(sessionId: string) {
    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { seq: 'asc' },
    });
  }

  // 懒重建窗口：只取 seq > afterSeq 的原文（afterSeq = summary_up_to_seq）
  async listWindow(sessionId: string, afterSeq: number) {
    return this.prisma.chatMessage.findMany({
      where: { sessionId, seq: { gt: afterSeq } },
      orderBy: { seq: 'asc' },
    });
  }

  // —— 状态（summary + 水位线 + slots，乐观锁）——
  async getState(sessionId: string) {
    return this.prisma.chatSessionState.findUnique({ where: { sessionId } });
  }

  // 确保会话存在且归属当前用户 + 状态行存在：
  // 首次使用时创建并绑定 userId；存在但属于他人则拒绝（防止跨用户访问会话）
  async ensureSession(sessionId: string, userId: string) {
    const existing = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!existing) {
      await this.prisma.chatSession.create({ data: { id: sessionId, userId } });
    } else if (existing.userId !== userId) {
      throw new ForbiddenException('无权访问该会话');
    }
    // 状态行（summary / 水位线 / slots）
    await this.prisma.chatSessionState.upsert({
      where: { sessionId },
      create: { sessionId },
      update: {},
    });
  }

  // CAS 推进状态：水位线不匹配则返回 false，由调用方重试（乐观锁）
  async updateState(input: UpdateStateInput): Promise<boolean> {
    const { sessionId, summary, summaryUpToSeq, slots, expectedUpToSeq } = input;
    const result = await this.prisma.$executeRaw`
      UPDATE customer_service.chat_session_states
      SET summary = ${summary},
          summary_up_to_seq = ${summaryUpToSeq},
          slots = ${JSON.stringify(slots ?? null)}::jsonb,
          updated_at = now()
      WHERE session_id = ${sessionId}
        AND summary_up_to_seq = ${expectedUpToSeq}
    `;
    return result > 0;
  }
}
