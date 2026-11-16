// 上下文组装：懒重建窗口 → token 预算裁剪 → 超限滚动摘要 → 组装 instructions + messages
//
// 职责划分（对应行业最佳实践"事件溯源 + 派生投影"）：
//   - SessionStore 管"存"（消息日志 + 水位线 + slots）
//   - 本服务管"组装"（从日志重建窗口、超预算时滚动摘要、拼出喂给模型的上下文）
//
// 存储约定：chat_messages.parts 存的是 ModelMessage 的 content（数组），
// 角色 ∈ user/assistant/tool，读回时直接重建 ModelMessage，无需再做 UIMessage 转换。
import { Inject, Injectable } from '@nestjs/common';
import { generateText, Output, type ModelMessage } from 'ai';
import { z } from 'zod';
import { chatModel } from '../llm/llm.service.js';
import { SessionStore } from '../session/session-store.js';
import { estimateJsonTokens, estimateTokens } from './token.js';

// 输入 token 预算上限：deepseek-chat 64K，只当 40K 用，留余量吸收估算误差 + 工具结果体积膨胀
const CONTEXT_BUDGET = 40_000;
// 压缩后至少保留的最近原文条数，避免把窗口挤光
const KEEP_MIN_WINDOW = 4;

export interface AssembledContext {
  instructions: string;
  messages: ModelMessage[];
}

type PartLike = {
  type: string;
  text?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
};

@Injectable()
export class ContextService {
  constructor(@Inject(SessionStore) private readonly sessionStore: SessionStore) {}

  async assemble(input: { sessionId: string; systemPrompt: string }): Promise<AssembledContext> {
    const { sessionId, systemPrompt } = input;
    const state = await this.sessionStore.getState(sessionId);
    const summaryUpToSeq = state?.summaryUpToSeq ?? 0;

    // ① 懒重建窗口（原文不落库，靠水位线从日志重建；parts 即 ModelMessage content）
    const rows = await this.sessionStore.listWindow(sessionId, summaryUpToSeq);
    let messages = rows.map((m) => ({
      role: m.role,
      content: m.parts,
    })) as unknown as ModelMessage[];

    let summary = state?.summary ?? '';
    let slots: unknown = state?.slots ?? null;

    // ② 判断是否超预算（懒触发，超了才压缩）
    const used =
      estimateTokens(systemPrompt) +
      estimateTokens(summary) +
      estimateJsonTokens(slots) +
      rows.reduce((n, m) => n + (m.tokenEst > 0 ? m.tokenEst : estimateJsonTokens(m.parts)), 0);

    if (used > CONTEXT_BUDGET && messages.length > KEEP_MIN_WINDOW) {
      // ③ 滚动摘要：挤头部 + 推进水位线 + 抽取 slots
      const compressed = await this.compress({
        sessionId,
        summary,
        summaryUpToSeq,
        slots,
        messages,
      });
      summary = compressed.summary;
      slots = compressed.slots;
      messages = compressed.messages;
    }

    // ④ 组装：摘要管背景、槽位管事实、窗口管当下
    const instructions = [
      systemPrompt,
      summary ? `【历史摘要】${summary}` : '',
      slots ? `【关键事实】${JSON.stringify(slots)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { instructions, messages };
  }

  // 滚动摘要：从窗口头部逐条挤出消息，和旧摘要一起重新摘要，推进水位线
  private async compress(input: {
    sessionId: string;
    summary: string;
    summaryUpToSeq: number;
    slots: unknown;
    messages: ModelMessage[];
  }): Promise<{ summary: string; slots: unknown; messages: ModelMessage[] }> {
    const { sessionId, summary, summaryUpToSeq, slots, messages } = input;

    // 从头部移出消息，直到不再超预算（或只剩 KEEP_MIN_WINDOW 条）
    const toSummarize: ModelMessage[] = [];
    let remaining = messages;
    while (remaining.length > KEEP_MIN_WINDOW) {
      const used =
        estimateTokens(summary) +
        estimateJsonTokens(slots) +
        remaining.reduce((n, m) => n + estimateJsonTokens(m.content), 0);
      if (used <= CONTEXT_BUDGET) break;
      toSummarize.push(remaining[0]);
      remaining = remaining.slice(1);
    }

    if (toSummarize.length === 0) return { summary, slots, messages: remaining };

    // 调 LLM：一次调用同时产出滚动摘要 + 关键事实槽位
    const result = await generateText({
      model: chatModel,
      output: Output.object({
        schema: z.object({
          summary: z.string().describe('合并旧摘要与新对话的滚动摘要'),
          slots: z.record(z.string(), z.string()).describe('关键事实槽位：订单号、诉求、承诺等'),
        }),
      }),
      prompt: [
        '你是电商购物助手的对话摘要助手。请把历史压缩成一段简洁摘要，并提取关键事实供后续对话参考。',
        '尤其要保留购物需求槽位（写入 slots 键值对）：品类/用途、品牌偏好、价格区间、其他要求。',
        `旧摘要：${summary || '（无）'}`,
        '新增对话：',
        this.renderMessages(toSummarize),
        '请输出 summary（滚动摘要）和 slots（关键事实键值对）。',
      ].join('\n'),
    });

    // 推进水位线 + 写回（乐观锁 CAS，冲突则忽略，不影响本轮模型输入的正确性）
    const newSummaryUpToSeq = summaryUpToSeq + toSummarize.length;
    await this.sessionStore.updateState({
      sessionId,
      summary: result.object.summary,
      summaryUpToSeq: newSummaryUpToSeq,
      slots: result.object.slots,
      expectedUpToSeq: summaryUpToSeq,
    });

    return { summary: result.object.summary, slots: result.object.slots, messages: remaining };
  }

  // 把 ModelMessage 渲染成摘要模型可读的文本（含工具调用/结果，因为工具结果是关键事实来源）
  private renderMessages(messages: ModelMessage[]): string {
    return messages
      .map((m) => {
        const content = m.content;
        const body = Array.isArray(content)
          ? (content as PartLike[])
              .map((p) => {
                if (p.type === 'text') return p.text ?? '';
                if (p.type === 'tool-call')
                  return `[调用 ${p.toolName} ${JSON.stringify(p.input)}]`;
                if (p.type === 'tool-result')
                  return `[${p.toolName} 返回 ${JSON.stringify(p.output)}]`;
                return '';
              })
              .filter(Boolean)
              .join(' ')
          : content;
        const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : '工具';
        return `${role}: ${body}`;
      })
      .join('\n');
  }
}
