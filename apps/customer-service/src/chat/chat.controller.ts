// 对话接口：有状态会话（需登录）
//   POST /chat                       → 收 { sessionId, text }，流式返回 UI message 流
//   GET  /chat/sessions/:id/messages → hydration：前端挂载/刷新时拉取历史（仅限会话属主）
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { pipeUIMessageStreamToResponse, toUIMessageStream } from 'ai';
import { ChatService } from './chat.service.js';
import { SessionStore } from '../session/session-store.js';
import { UserJwtGuard, UserContext } from '../auth/user-jwt.guard.js';
import { UserThrottlerGuard } from '../auth/user-throttler.guard.js';

type AuthedRequest = Request & { user: UserContext };

@Controller()
export class ChatController {
  constructor(
    @Inject(ChatService) private readonly chatService: ChatService,
    @Inject(SessionStore) private readonly sessionStore: SessionStore,
  ) {}

  @UseGuards(UserJwtGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('chat')
  async chat(
    @Body() body: { sessionId: string; text: string },
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

    let result: Awaited<ReturnType<ChatService['chat']>>;
    try {
      result = await this.chatService.chat(sessionId, text, token, userId);
    } catch (err) {
      console.error('❌ chat 处理失败：', err);
      res.status(500).json({ error: '处理失败' });
      return;
    }

    // v7 推荐：result.stream → UI message 流 → 写入响应
    const uiStream = toUIMessageStream({ stream: result.stream });
    await pipeUIMessageStreamToResponse({ response: res, stream: uiStream });

    // 流写完，落库 assistant/tool 消息（失败不影响已发出的响应，只记日志）
    try {
      await this.chatService.persistResponse(sessionId, result);
    } catch (err) {
      console.error('❌ 落库 assistant/tool 消息失败：', err);
    }
  }

  @UseGuards(UserJwtGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('chat/sessions/:id/messages')
  async getMessages(@Param('id') sessionId: string, @Req() req: AuthedRequest) {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session || session.userId !== req.user.userId) {
      throw new ForbiddenException('无权访问该会话');
    }
    const messages = await this.sessionStore.listMessages(sessionId);
    return messages.map((m) => ({ id: m.id, role: m.role, parts: m.parts }));
  }
}
