import 'dotenv/config';
import 'reflect-metadata';
import './llm/langfuse.js';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { listEnv, validateEnv } from './config/env.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';

async function bootstrap() {
  // 启动期校验：缺 key 直接给出可读错误，而不是运行时 undefined 才炸
  validateEnv();

  // bufferLogs：启动期日志先缓冲，等 pino logger 就位后再输出
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // CORS：默认放开（本地开发），生产用 CORS_ORIGINS 限定域名
  const corsOrigins = listEnv('CORS_ORIGINS');
  app.enableCors({ origin: corsOrigins ?? true });

  app.useGlobalFilters(new HttpExceptionFilter());
  // 让限流/日志能拿到代理后的真实客户端 IP
  app.getHttpAdapter().getInstance()?.set?.('trust proxy', 1);
  // 优雅停机：Prisma 连接、OTel span 在退出前收尾
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  app.get(Logger).log(`🚀 客服服务已启动：http://localhost:${port}`);
}

void bootstrap();
