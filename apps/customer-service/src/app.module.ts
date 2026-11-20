import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ChatModule } from './chat/chat.module.js';
import { SessionModule } from './session/session.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 结构化日志（nestjs-pino）：生产输出 JSON，开发用 pino-pretty 美化
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req: any) =>
          (typeof req?.headers?.['x-request-id'] === 'string' && req.headers['x-request-id']) ||
          randomUUID(),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
        // 日志里脱敏敏感头（Authorization 里有用户 token）
        redact: { paths: ['req.headers.authorization'], censor: '***' },
      },
    }),
    // 提供限流存储/选项（全局）；限流守卫在 controller 里按用户维度应用
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    ChatModule,
    SessionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
