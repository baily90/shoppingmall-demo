// 对话编排：有状态会话（append-only 日志 + 懒重建窗口 + 工具循环 + 流式）
//
// 数据流：
//   appendMessage(用户消息) → assemble(懒重建窗口 + 裁剪/滚动摘要) → streamText → persistResponse(落库 assistant/tool)
import { Inject, Injectable } from '@nestjs/common';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { chatModel } from '../llm/llm.service.js';
import { ToolsService } from '../tools/tools.service.js';
import { RagService } from '../rag/rag.service.js';
import { SessionStore } from '../session/session-store.js';
import { ContextService } from './context.service.js';
import { estimateJsonTokens, estimateTokens } from './token.js';

const SYSTEM_PROMPT = `你是电商客服助手。
规则：
1. 回答退款/退货/物流/优惠券等政策类问题前，先用 getFaq 检索知识库，严格基于检索结果回答。
2. 用户问订单状态/物流/金额时，用 getOrder 查订单。
3. 用户问商品价格/库存/推荐时，用 getProduct 查商品。
4. 知识库里没有的，诚实说不知道，并引导用户转人工客服。`;

@Injectable()
export class ChatService {
  constructor(
    @Inject(ToolsService) private readonly toolsService: ToolsService,
    @Inject(RagService) private readonly ragService: RagService,
    @Inject(SessionStore) private readonly sessionStore: SessionStore,
    @Inject(ContextService) private readonly contextService: ContextService,
  ) {}

  // 每次对话按用户 token 动态创建工具集（查订单需要用户身份）
  private createTools(token: string) {
    return {
      getOrder: tool({
        description: '查询用户订单的状态/物流/金额。用户问"我的订单 xxx 到哪了/什么状态"时使用。',
        inputSchema: z.object({ orderNo: z.string().describe('订单号') }),
        execute: async ({ orderNo }) => this.toolsService.getOrder(orderNo, token),
      }),
      getProduct: tool({
        description: '查询商品的价格/库存/信息。用户问商品相关问题或求推荐时使用。',
        inputSchema: z.object({ keyword: z.string().describe('商品名或关键词') }),
        execute: async ({ keyword }) => this.toolsService.getProduct(keyword),
      }),
      getFaq: tool({
        description: '检索退款/退货/物流/优惠券等售后政策知识库。用户问规则类问题时使用。',
        inputSchema: z.object({ question: z.string().describe('要检索的问题') }),
        execute: async ({ question }) => this.ragService.search(question),
      }),
    };
  }

  // 处理一条用户消息：落库 → 组装上下文 → 流式生成
  async chat(sessionId: string, userText: string, token: string) {
    // ① 确保会话状态行存在
    await this.sessionStore.ensureState(sessionId);

    // ② 用户消息先落库（append-only，可靠；seq 由 FOR UPDATE 悲观锁分配）
    await this.sessionStore.appendMessage({
      sessionId,
      role: 'user',
      parts: [{ type: 'text', text: userText }],
      tokenEst: estimateTokens(userText),
    });

    // ③ 组装上下文（懒重建窗口 + token 预算裁剪 + 滚动摘要）
    const { instructions, messages } = await this.contextService.assemble({
      sessionId,
      systemPrompt: SYSTEM_PROMPT,
    });

    // ④ 流式生成（工具循环自动，结果已瘦身）
    return streamText({
      model: chatModel,
      instructions,
      messages,
      tools: this.createTools(token),
      stopWhen: isStepCount(6),
    });
  }

  // 落库 assistant/tool 消息（流结束后用 result.responseMessages 的完整结构）
  // 约定：parts 列存 ModelMessage 的 content，读回时直接重建 ModelMessage，不做 UIMessage 转换
  async persistResponse(sessionId: string, result: Awaited<ReturnType<ChatService['chat']>>) {
    const responseMessages = await result.responseMessages;
    for (const msg of responseMessages) {
      // 只存模型生成的消息（assistant / tool）；user 消息在 chat() 里已落库
      if (msg.role !== 'assistant' && msg.role !== 'tool') continue;
      const parts =
        typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : msg.content;
      await this.sessionStore.appendMessage({
        sessionId,
        role: msg.role,
        parts,
        tokenEst: estimateJsonTokens(parts),
      });
    }
  }
}
