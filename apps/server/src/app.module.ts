import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { SystemModule } from './system/system.module';
import { ProductModule } from './product/product.module';
import { StorageModule } from './storage/storage.module';
import { PaymentModule } from './payment/payment.module';
import { TradeModule } from './trade/trade.module';
import { StatsModule } from './stats/stats.module';
import { CouponModule } from './coupon/coupon.module';
import { SeckillModule } from './seckill/seckill.module';
import { RefundModule } from './refund/refund.module';
import { ReviewModule } from './review/review.module';
import { FavoriteModule } from './favorite/favorite.module';
import { HomeModule } from './home/home.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 结构化日志（nestjs-pino）：生产输出 JSON（docker logs 采集），开发用 pino-pretty 美化
    LoggerModule.forRoot({
      pinoHttp: {
        // 复用上游 x-request-id 作为请求 id，否则生成一个（保留原 LoggingMiddleware 的 traceId 语义）
        genReqId: (req: any) =>
          (typeof req?.headers?.['x-request-id'] === 'string' && req.headers['x-request-id']) ||
          randomUUID(),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
        // 日志里脱敏敏感头（如 Authorization）
        redact: { paths: ['req.headers.authorization'], censor: '***' },
      },
    }),
    // BullMQ 全局连接：复用阶段 1 的 Redis（订单延迟任务用）
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    // 全局限流：默认每 IP 每分钟 100 次（登录/注册/下单等敏感接口再单独收紧）
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    SystemModule,
    ProductModule,
    StorageModule,
    PaymentModule,
    TradeModule,
    StatsModule,
    CouponModule,
    SeckillModule,
    RefundModule,
    ReviewModule,
    FavoriteModule,
    HomeModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
