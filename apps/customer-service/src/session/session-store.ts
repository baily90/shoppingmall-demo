// 会话状态存储：append-only 消息日志 + 会话压缩状态（summary / 水位线 / slots）
//
// 设计要点（对应"事件溯源 + 派生投影"）：
//   1. chat_messages 是唯一真相（append-only），窗口原文不落库，靠水位线懒重建
//   2. chat_session_states 只存不可重建的部分：summary / summary_up_to_seq / slots
//   3. 并发：消息 seq 用 FOR UPDATE 悲观锁串行化；状态推进用乐观锁（CAS）
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';

// 单次 hydration 最多回填的消息数（长会话不一次性全量下发）
const DEFAULT_HISTORY_LIMIT = 200;
const MAX_HISTORY_LIMIT = 500;
const DEFAULT_SESSION_LIST_LIMIT = 50;

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

// 从 parts（JSON）里提取第一段纯文本（用于会话标题）
function extractFirstText(parts: unknown): string {
  const list = Array.isArray(parts) ? parts : [];
  for (const p of list) {
    const part = p as { type?: string; text?: string };
    if (part.type === 'text' && part.text) {
      const t = part.text.trim();
      return t.length > 30 ? `${t.slice(0, 30)}…` : t;
    }
  }
  return '';
}

@Injectable()
export class SessionStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // —— 会话 ——
  async getSession(sessionId: string) {
    return this.prisma.chatSession.findUnique({ where: { id: sessionId } });
  }

  // 列出当前用户的会话（标题取首条用户消息，按更新时间倒序；默认最多 50 条）
  async listSessions(userId: string, limit = DEFAULT_SESSION_LIST_LIMIT) {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), DEFAULT_SESSION_LIST_LIMIT * 4),
      include: {
        messages: {
          where: { role: 'user' },
          orderBy: { seq: 'asc' },
          take: 1,
          select: { parts: true },
        },
      },
    });
    return sessions.map((s) => ({
      id: s.id,
      title: s.title ?? (extractFirstText(s.messages[0]?.parts) || '新会话'),
      updatedAt: s.updatedAt,
    }));
  }

  // 删除会话（仅属主），消息/状态随外键级联删除
  async deleteSession(sessionId: string, userId: string) {
    const existing = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!existing || existing.userId !== userId) {
      throw new ForbiddenException('无权访问该会话');
    }
    await this.prisma.chatSession.delete({ where: { id: sessionId } });
  }

  // —— 消息（append-only）——
  // 批量追加：一次事务只锁一次 session 行、只查一次 MAX(seq)，避免一轮对话 8 步就抢 9 次锁。
  // 调用方需先确保 session 存在（否则外键约束失败）。
  async appendMessages(inputs: AppendMessageInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const sessionId = inputs[0].sessionId;
    if (inputs.some((input) => input.sessionId !== sessionId)) {
      throw new Error('appendMessages 只支持同一会话的消息');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM customer_service.chat_sessions WHERE id = ${sessionId} FOR UPDATE`;
      const rows = await tx.$queryRaw<Array<{ max: number }>>`
        SELECT COALESCE(MAX(seq), 0) AS max
        FROM customer_service.chat_messages
        WHERE session_id = ${sessionId}
      `;
      let seq = Number(rows[0]?.max ?? 0);
      const data = inputs.map((input) => ({
        sessionId,
        seq: ++seq,
        role: input.role,
        parts: input.parts as Prisma.InputJsonValue,
        tokenEst: input.tokenEst ?? 0,
      }));
      await tx.chatMessage.createMany({ data });
      return data.length;
    });
  }

  async appendMessage(input: AppendMessageInput) {
    return this.appendMessages([input]);
  }

  // 最后一条用户消息的完整文本（重试时用来判断上次是否已落库，避免重复写入或误删上一轮回答）
  async lastUserText(sessionId: string): Promise<string | null> {
    const row = await this.prisma.chatMessage.findFirst({
      where: { sessionId, role: 'user' },
      orderBy: { seq: 'desc' },
      select: { parts: true },
    });
    if (!row) return null;
    const parts = Array.isArray(row.parts) ? (row.parts as Array<Record<string, unknown>>) : [];
    const text = parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => String(p.text))
      .join('');
    return text || null;
  }

  // 重新生成：删掉最后一条用户消息之后的所有消息（上一次失败/中断留下的半截 assistant/tool），
  // 用户消息本身保留，避免重试时同一个问题在历史里出现两次。
  async truncateAfterLastUser(sessionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM customer_service.chat_sessions WHERE id = ${sessionId} FOR UPDATE`;
      const rows = await tx.$queryRaw<Array<{ seq: number | null }>>`
        SELECT MAX(seq) AS seq
        FROM customer_service.chat_messages
        WHERE session_id = ${sessionId} AND role = 'user'
      `;
      const seq = rows[0]?.seq;
      if (seq == null) return;
      await tx.chatMessage.deleteMany({
        where: { sessionId, seq: { gt: Number(seq) } },
      });
    });
  }

  // hydration：按 seq 升序拉消息；传 limit 时只取最近 limit 条（长会话不整段下发）
  async listMessages(sessionId: string, limit?: number) {
    if (!limit) {
      return this.prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { seq: 'asc' },
      });
    }
    const rows = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { seq: 'desc' },
      take: Math.min(Math.max(limit, 1), MAX_HISTORY_LIMIT),
    });
    return rows.reverse();
  }

  // hydration（给前端）：把 tool-result 合并回 assistant 的 tool-call，转成 UIMessage 结构。
  // 存储层仍是 ModelMessage 结构（上下文组装要用），此处只做「读侧投影」，
  // 让前端能据此渲染文本气泡 + 商品/订单卡片（工具输出随历史一起回填，刷新不丢）。
  async listMessagesForUI(sessionId: string, limit = DEFAULT_HISTORY_LIMIT) {
    const rows = await this.listMessages(sessionId, limit);

    // tool-result 按 toolCallId 索引（tool 消息存的是 ModelMessage 的 tool-result content）
    const toolOutputs = new Map<string, unknown>();
    for (const m of rows) {
      if (m.role !== 'tool') continue;
      const parts = m.parts as unknown as Array<{
        type?: string;
        toolCallId?: string;
        output?: unknown;
      }>;
      for (const p of parts) {
        if (p.type === 'tool-result' && p.toolCallId) toolOutputs.set(p.toolCallId, p.output);
      }
    }

    return rows
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => {
        if (m.role !== 'assistant') return { id: m.id, role: m.role, parts: m.parts };
        const parts = (m.parts as unknown as Array<Record<string, unknown>>).map((p) => {
          if (p.type === 'tool-call') {
            const raw = toolOutputs.get(String(p.toolCallId));
            // 存储层 tool-result 的 output 是 DataContent 信封 { type: 'json', value: ... }，解包成裸值
            const output =
              raw && typeof raw === 'object' && 'value' in (raw as object)
                ? (raw as { value: unknown }).value
                : raw;
            return {
              type: 'dynamic-tool',
              toolName: p.toolName,
              toolCallId: p.toolCallId,
              input: p.input,
              output,
              state: 'output-available',
            };
          }
          return p;
        });
        return { id: m.id, role: m.role, parts };
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
  // 首次使用时创建并绑定 userId；存在但属于他人则拒绝（防止跨用户访问会话）。
  // 并发首条消息可能同时 create，撞唯一键后回查一次，避免 500。
  async ensureSession(sessionId: string, userId: string) {
    let existing = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!existing) {
      try {
        existing = await this.prisma.chatSession.create({ data: { id: sessionId, userId } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          existing = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
        } else {
          throw e;
        }
      }
    }
    if (existing && existing.userId !== userId) {
      throw new ForbiddenException('无权访问该会话');
    }

    // 状态行（summary / 水位线 / slots）：createMany + skipDuplicates 天然幂等，避免并发 upsert 撞主键
    await this.prisma.chatSessionState.createMany({
      data: [{ sessionId }],
      skipDuplicates: true,
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
