import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TradeModule } from '../trade/trade.module';
import { SeckillController } from './seckill.controller';
import { AdminSeckillController } from './admin-seckill.controller';
import { SeckillService } from './seckill.service';
import { SeckillProcessor } from './seckill.processor';
import { SECKILL_QUEUE } from './seckill.constant';

@Module({
  imports: [
    forwardRef(() => TradeModule), // 复用 OrderService 落单；与 TradeModule 成环（取消回补），用 forwardRef 解开
    BullModule.registerQueue({
      name: SECKILL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    }),
  ],
  controllers: [SeckillController, AdminSeckillController],
  providers: [SeckillService, SeckillProcessor],
  exports: [SeckillService], // 供 TradeModule 在取消订单时回补秒杀配额
})
export class SeckillModule {}
