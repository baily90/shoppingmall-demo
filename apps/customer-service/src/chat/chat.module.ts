import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ContextService } from './context.service.js';
import { ToolsService } from '../tools/tools.service.js';
import { RagService } from '../rag/rag.service.js';
import { SessionModule } from '../session/session.module.js';
import { UserJwtGuard } from '../auth/user-jwt.guard.js';
import { UserThrottlerGuard } from '../auth/user-throttler.guard.js';

@Module({
  imports: [
    SessionModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [ChatController],
  // 守卫必须注册在本模块（声明 controller 的模块），Nest 才会通过 DI 解析它
  providers: [
    ChatService,
    ContextService,
    ToolsService,
    RagService,
    UserJwtGuard,
    UserThrottlerGuard,
  ],
})
export class ChatModule {}
