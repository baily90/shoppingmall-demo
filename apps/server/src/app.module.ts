import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
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
    PrismaModule,
    RedisModule,
    AuthModule,
    SystemModule,
    ProductModule,
    StorageModule,
    PaymentModule,
    TradeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
