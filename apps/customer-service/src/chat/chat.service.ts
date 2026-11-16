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

const SYSTEM_PROMPT = `你是「商城购物助手」，像一位耐心的导购，覆盖用户从选购、下单到售后的全链路。

## 购物引导（核心）
当用户有购物意向（如「我想买…」「推荐一款…」）时：
1. 逐步收集关键需求：品类/用途、品牌偏好、价格区间、其他要求（尺寸/颜色/性能等）。
2. 每次只追问 1-2 个最关键的缺失信息，不要一次抛出一堆问题。
3. 需求足够后调用 getProducts 检索，严格基于真实结果推荐，绝不编造商品。
4. 推荐时用中文简洁呈现：商品名、品牌、价格、亮点、推荐理由；可给 2-3 个备选并说明差异。
5. 结果为空或太少时，放宽价格/品牌等条件再查一次，或引导用户调整需求。

## 其他场景
- 退款/退货/物流/优惠券等政策类问题：先调 getFaq 查知识库，严格基于检索结果回答。
- 订单状态/物流/金额：调 getOrder 查订单。
- 知识库里没有的，诚实说明并引导转人工。

## 表达要求
- 简洁、口语化、友好，避免长篇大论。
- 价格统一用「元」，如 ¥5999。`;

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
      getProducts: tool({
        description:
          '检索/筛选在售商品，支持关键词、品牌、价格区间。用户有购物意向、要推荐或按条件筛选商品时使用。',
        inputSchema: z.object({
          keyword: z.string().optional().describe('商品名或关键词'),
          brand: z.string().optional().describe('品牌名，如「华为」'),
          priceMin: z.number().optional().describe('最低价格（元）'),
          priceMax: z.number().optional().describe('最高价格（元）'),
          limit: z.number().optional().describe('返回条数，默认 5'),
        }),
        execute: async (args) => this.toolsService.getProducts(args),
      }),
      getFaq: tool({
        description: '检索退款/退货/物流/优惠券等售后政策知识库。用户问规则类问题时使用。',
        inputSchema: z.object({ question: z.string().describe('要检索的问题') }),
        execute: async ({ question }) => this.ragService.search(question),
      }),
    };
  }

  // 处理一条用户消息：落库 → 组装上下文 → 流式生成
  async chat(sessionId: string, userText: string, token: string, userId: string) {
    // ① 确保会话存在且归属当前用户（首次创建并绑定 userId）
    await this.sessionStore.ensureSession(sessionId, userId);

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
