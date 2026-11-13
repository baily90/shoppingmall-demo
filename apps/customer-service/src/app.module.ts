import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ChatModule } from './chat/chat.module.js';
import { SessionModule } from './session/session.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 提供限流存储/选项（全局）；限流守卫在 controller 里按用户维度应用
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    ChatModule,
    SessionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
