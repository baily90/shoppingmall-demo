// 对话接口：有状态会话
//   POST /chat                      → 收 { sessionId, text }，流式返回 UI message 流
//   GET  /chat/sessions/:id/messages → hydration：前端挂载/刷新时拉取历史
import { Body, Controller, Get, Headers, Inject, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { pipeUIMessageStreamToResponse, toUIMessageStream } from 'ai';
import { ChatService } from './chat.service.js';
import { SessionStore } from '../session/session-store.js';

@Controller()
export class ChatController {
  constructor(
    @Inject(ChatService) private readonly chatService: ChatService,
    @Inject(SessionStore) private readonly sessionStore: SessionStore,
  ) {}

  @Post('chat')
  async chat(
    @Body() body: { sessionId: string; text: string },
    @Headers('authorization') auth: string | undefined,
    @Res() res: Response,
  ) {
    // 从请求头提取用户 token（h5 前端传用户的 JWT）
    const token = auth?.replace(/^Bearer\s+/i, '') ?? '';
    const sessionId = body.sessionId?.trim();
    const text = body.text?.trim();

    if (!sessionId || !text) {
      res.status(400).json({ error: 'sessionId 和 text 必填' });
      return;
    }

    let result: Awaited<ReturnType<ChatService['chat']>>;
    try {
      result = await this.chatService.chat(sessionId, text, token);
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

  @Get('chat/sessions/:id/messages')
  async getMessages(@Param('id') sessionId: string) {
    const messages = await this.sessionStore.listMessages(sessionId);
    return messages.map((m) => ({ id: m.id, role: m.role, parts: m.parts }));
  }
}
