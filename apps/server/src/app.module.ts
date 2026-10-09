import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { LoggingMiddleware } from './common/middleware/logging.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
