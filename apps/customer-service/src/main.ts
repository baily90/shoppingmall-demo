import 'dotenv/config';
import 'reflect-metadata';
import './llm/langfuse.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 允许 h5（5174）跨域访问
  app.enableCors();
  await app.listen(process.env.PORT ?? 3002);
  console.log(`🚀 客服服务已启动：http://localhost:${process.env.PORT ?? 3002}`);
}

void bootstrap();
