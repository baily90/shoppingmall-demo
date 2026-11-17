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

const SYSTEM_PROMPT = `你是「商城购物助手」，像一位耐心的导购，覆盖用户从选购、下单到售后的全链路。始终只用中文回复，不要夹杂任何英文。

## 购物引导（核心）
当用户有购物意向或问具体商品（「我想买…」「推荐…」「XX 多少钱」「有没有 XX」「XX 怎么样」）时，**必须调用 getProducts 查真实商品，绝不凭记忆/常识编造商品信息**：
1. 用户已给出明确关键词（如「macbook」「电脑」「5000 元以下」）→ 立即调用 getProducts。
2. 信息不足（连品类都不清楚）→ 先追问 1-2 个关键信息（品类/预算/品牌），随后调用 getProducts。
3. 每次只追问 1-2 个，不要一次抛出一堆问题。
4. 结果为空或太少时，放宽价格/品牌等条件再查一次，或引导用户调整需求。

## 结果展示（重要，务必遵守）
调用 getProducts / getOrders 后，查询结果会**自动以「卡片」形式展示给用户**（卡片上已有商品图、名称、品牌、价格、亮点、操作按钮）。用户已经能看到这些卡片，所以你的文字里**绝对不要再列出商品名、价格、亮点**，这是卡片负责展示的内容。
正确做法（1-2 句即可）：
- 「帮你筛出 2 款，都在下面的卡片里」
- 「第一款性价比更高，适合办公」
- 「还想看 15 寸或更高配的吗？」
错误做法：不要写「XX商品｜¥XXX｜亮点：XXX」这种列表，也不要逐条念商品名和价格。

## 下单流程
当用户要下单/购买/结算时（「帮我下单」「就买这个」「结算」等）：
1. 确认商品与数量：用 getProducts 找到商品（拿到 skuId、单价 priceCent、名称、图）。
2. 确认收货地址：调 getAddresses 查用户地址；若无地址，告知用户先去添加地址。
3. 信息齐全后调 createOrderDraft 生成订单草稿（草稿会以卡片展示，用户点「确认下单」后才真正下单）。
4. 你自己**不要真正下单**，只负责生成草稿；下单由用户在卡片上完成。

## 页面跳转
需要用户去某页面操作时（改地址、管理订单、看购物车/优惠券/收藏、秒杀等），调用 navigateTo 生成可点击的跳转入口卡片，不要只给一句「请去 XX 页面」的文字。

## 容错与降级（重要）
工具返回 empty 时：按返回的 hint 建议放宽条件（放宽价格/关键词/品牌）再查一次；放宽后仍为空，如实告诉用户「没找到符合条件的」，绝不编造。
工具返回 error 时：按 hint 建议降级——稍后重试 / 换工具 / 引导用户换方式；不要在同一失败操作上反复重试。

## 其他场景
- 退款/退货/物流/优惠券等政策类问题：先调 getFaq 查知识库，严格基于检索结果回答。
- 查订单：调 getOrders。用户问「我的订单有哪些/订单列表」时不传参列出全部；问某个订单传 orderNo；按状态筛选传 status。
- 查商品/分类/品牌/评价/优惠券/秒杀等「数据类」问题：调 db_query 生成只读 SQL（如「有哪些电脑」「评价最好的商品」「有什么优惠券」）。
- 知识库里没有的，诚实说明并引导转人工。

## 表达要求
- 始终用中文回复，不要夹杂英文。
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
      getOrders: tool({
        description:
          '查询用户的订单。用户问「我的订单有哪些/订单列表/最近订单」时不传参数列出全部；查某个订单传 orderNo；按状态筛选传 status。',
        inputSchema: z.object({
          orderNo: z.string().optional().describe('订单号（可选，查某个订单时填）'),
          status: z
            .number()
            .optional()
            .describe('订单状态码（可选）：10待支付/20待发货/30待收货/40已完成/50已取消/60已退款'),
        }),
        execute: async (args) => this.toolsService.getOrders(args, token),
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
        execute: async ({ question }) => {
          const hits = await this.ragService.search(question);
          if (hits.length === 0) {
            return { empty: true, hits, hint: '知识库里没有相关答案，诚实告知并引导转人工' };
          }
          return { hits };
        },
      }),
      db_query: tool({
        description:
          '用 SQL 查询商城公共数据（只读，仅 SELECT）。适合回答「有哪些商品/分类/品牌」「评价最好/评分最高的商品」「有什么优惠券/秒杀活动」等数据类问题。' +
          '表名必须用 public. 前缀。可用表及主要列：' +
          'product(id,name,sub_title,category_id,brand_id,status,rating_sum,review_count)、' +
          'product_sku(id,product_id,price,original_price,stock,sku_code,status)、' +
          'brand(id,name,status)、category(id,parent_id,name,level,status)、' +
          'product_review(id,product_id,rating,content,status)、' +
          'coupon(id,name,type,threshold_amount,discount_amount,discount_rate,status)、' +
          'seckill_activity(id,name,start_time,end_time,status)、home_slot(id,name,type,status)。' +
          '注意 price/original_price/threshold_amount/discount_amount 单位是「分」（1元=100分）。' +
          '查询用户自己的订单不要用本工具，用 getOrders。',
        inputSchema: z.object({
          sql: z
            .string()
            .describe(
              '只读 SELECT 语句，表名必须带 public. 前缀。例：SELECT p.name, s.price FROM public.product p JOIN public.product_sku s ON s.product_id=p.id WHERE s.price < 500000',
            ),
        }),
        execute: async ({ sql }) => this.toolsService.dbQuery(sql),
      }),
      getAddresses: tool({
        description: '查询当前用户的收货地址列表。用户要下单/结算、需要确认收货地址时使用。',
        inputSchema: z.object({}),
        execute: async () => this.toolsService.getAddresses(token),
      }),
      createOrderDraft: tool({
        description:
          '生成订单草稿（只生成草稿，不真正下单）。当用户明确要购买某商品、已确定 SKU/数量/收货地址后，用它生成待确认的订单草稿；草稿会自动以卡片展示给用户确认。',
        inputSchema: z.object({
          items: z.array(
            z.object({
              skuId: z.number().describe('SKU id'),
              quantity: z.number().describe('数量'),
              name: z.string().describe('商品名'),
              price: z.number().describe('单价（分，取自 getProducts 的 priceCent）'),
              image: z.string().optional().describe('商品图 URL'),
            }),
          ),
          address: z.object({
            id: z.number().describe('收货地址 id'),
            receiverName: z.string(),
            receiverPhone: z.string(),
            fullAddress: z.string(),
          }),
        }),
        execute: async (args) => this.toolsService.createOrderDraft(args),
      }),
      navigateTo: tool({
        description:
          '引导用户跳转到商城的某个页面。当需要用户去某页面操作时（改地址→去地址管理、管理订单→去订单列表、看购物车/优惠券/收藏等），生成一个可点击的跳转入口卡片。',
        inputSchema: z.object({
          target: z
            .enum(['address', 'orders', 'cart', 'coupons', 'favorites', 'mine', 'seckill'])
            .describe('目标页面'),
          label: z.string().describe('按钮文字，如「去地址管理」'),
          description: z.string().optional().describe('补充说明文字'),
        }),
        execute: async (args) => args,
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
      stopWhen: isStepCount(8),
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
