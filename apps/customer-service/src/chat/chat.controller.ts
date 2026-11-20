// 对话接口：有状态会话（需登录）
//   POST /chat                       → 收 { sessionId, text }，流式返回 UI message 流
//   GET  /chat/sessions/:id/messages → hydration：前端挂载/刷新时拉取历史（仅限会话属主）
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { propagateAttributes } from '@langfuse/tracing';
import type { LanguageModelUsage } from 'ai';
import { createUIMessageStream, pipeUIMessageStreamToResponse, toUIMessageStream } from 'ai';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { ChatService, type PartialTurn } from './chat.service.js';
import { SessionStore } from '../session/session-store.js';
import { UsageStore } from '../session/usage-store.js';
import { UserJwtGuard, UserContext } from '../auth/user-jwt.guard.js';
import { UserThrottlerGuard } from '../auth/user-throttler.guard.js';

type AuthedRequest = Request & { user: UserContext };

// 固定文本（注入拒绝 / 语义缓存命中）直接合成 UI 流，不调用模型
function fixedUIMessageStream(text: string) {
  return createUIMessageStream({
    execute: ({ writer }) => {
      const id = randomUUID();
      writer.write({ type: 'text-start', id });
      writer.write({ type: 'text-delta', id, delta: text });
      writer.write({ type: 'text-end', id });
    },
  });
}

@Controller()
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    @Inject(ChatService) private readonly chatService: ChatService,
    @Inject(SessionStore) private readonly sessionStore: SessionStore,
    @Inject(UsageStore) private readonly usageStore: UsageStore,
  ) {}

  @UseGuards(UserJwtGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('chat')
  async chat(
    @Body() body: { sessionId: string; text: string; retry?: boolean },
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const userId = req.user.userId;
    const sessionId = body.sessionId?.trim();
    const text = body.text?.trim();

    if (!sessionId || !text) {
      res.status(400).json({ error: 'sessionId 和 text 必填' });
      return;
    }

    // 用户关闭页面/断网时中止生成，避免继续烧 token
    const abort = new AbortController();
    let finished = false;
    res.on('close', () => {
      if (!finished) abort.abort();
    });

    // 每日次数/token 预算（超限抛 429，交给全局异常过滤器）
    await this.usageStore.assertWithinBudget(userId);

    // userId / sessionId 作为 trace 级属性写入 Langfuse，方便按用户排查与看成本
    await propagateAttributes(
      {
        userId,
        sessionId,
        tags: ['customer-service'],
        metadata: { channel: 'h5' },
      },
      async () => {
        const turn = await this.chatService.chat(sessionId, text, token, userId, {
          abortSignal: abort.signal,
          retry: body.retry === true,
        });

        // 固定文本：注入拒绝 / 语义缓存命中，零 LLM 调用
        if (turn.kind === 'fixed') {
          try {
            await pipeUIMessageStreamToResponse({
              response: res,
              stream: fixedUIMessageStream(turn.text),
            });
            finished = true;
          } finally {
            try {
              await this.chatService.persistFixedResponse(sessionId, turn.text);
            } catch (err) {
              this.logger.error(`落库固定回复失败：${err instanceof Error ? err.message : err}`);
            }
            await this.usageStore.recordUsage(userId, 0);
          }
          return;
        }

        // 边流边累计：客户端断连时 responseMessages 会 reject，靠这份快照兜底落库
        const partial: PartialTurn = { text: '', toolCalls: [] };
        const tappedStream = turn.result.stream.pipeThrough(
          new TransformStream<Record<string, unknown>, Record<string, unknown>>({
            transform(chunk, controller) {
              if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
                partial.text += chunk.text;
              } else if (
                chunk.type === 'tool-call' &&
                typeof chunk.toolCallId === 'string' &&
                typeof chunk.toolName === 'string'
              ) {
                partial.toolCalls.push({
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName,
                  input: chunk.input,
                });
              }
              controller.enqueue(chunk);
            },
          }),
        ) as typeof turn.result.stream;

        let usage: LanguageModelUsage | undefined;
        try {
          const uiStream = toUIMessageStream({
            stream: tappedStream,
            // 不把供应商原始错误透给用户
            onError: (error) => {
              this.logger.error(
                `流式生成失败：${error instanceof Error ? error.message : String(error)}`,
              );
              return '服务暂时不可用，请稍后再试';
            },
          });
          await pipeUIMessageStreamToResponse({ response: res, stream: uiStream });
          finished = true;
        } finally {
          // 关键：即使客户端中途断开，也把已经生成的部分落库，刷新后不丢回答
          try {
            usage = await turn.result.usage;
          } catch {
            // 中断时 usage 可能拿不到，忽略
          }
          try {
            await this.chatService.persistResponse(sessionId, turn);
          } catch (err) {
            // 中断时拿不到完整 responseMessages，用流式累计内容兜底
            this.logger.warn(
              `落库完整回复失败（改用部分内容兜底）：${err instanceof Error ? err.message : err}`,
            );
            try {
              await this.chatService.persistPartialResponse(sessionId, partial);
            } catch (fallbackErr) {
              this.logger.error(
                `落库部分回复失败：${fallbackErr instanceof Error ? fallbackErr.message : fallbackErr}`,
              );
            }
          }
          // 只有完整跑完才写语义缓存（中断的半截回答不缓存）
          if (finished) {
            try {
              await this.chatService.cacheResponse(text, turn);
            } catch (err) {
              this.logger.error(`语义缓存写入失败：${err instanceof Error ? err.message : err}`);
            }
          }
          await this.usageStore.recordUsage(userId, usage?.totalTokens ?? 0);
        }
      },
    ).catch((err) => {
      // 客户端主动断开：响应已不可写，直接结束
      if (abort.signal.aborted || res.headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }
      throw err;
    });
  }

  @UseGuards(UserJwtGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('chat/sessions/:id/messages')
  async getMessages(
    @Param('id') sessionId: string,
    @Query('limit') limit: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session || session.userId !== req.user.userId) {
      throw new ForbiddenException('无权访问该会话');
    }
    return this.sessionStore.listMessagesForUI(sessionId, parseLimit(limit, 200, 500));
  }

  // 列出当前用户的会话（历史会话抽屉用）
  @UseGuards(UserJwtGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('chat/sessions')
  listSessions(@Query('limit') limit: string | undefined, @Req() req: AuthedRequest) {
    return this.sessionStore.listSessions(req.user.userId, parseLimit(limit, 50, 200));
  }

  // 删除某个会话（仅属主）
  @UseGuards(UserJwtGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Delete('chat/sessions/:id')
  async deleteSession(@Param('id') sessionId: string, @Req() req: AuthedRequest) {
    await this.sessionStore.deleteSession(sessionId, req.user.userId);
    return { ok: true };
  }
}

function parseLimit(raw: string | undefined, fallback: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}
