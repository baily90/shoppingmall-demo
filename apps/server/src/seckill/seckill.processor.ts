import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { OrderService } from '../trade/order.service';
import { SeckillService } from './seckill.service';
import type { SeckillJobData } from './seckill.service';
import { SECKILL_CREATE_ORDER_JOB, SECKILL_QUEUE } from './seckill.constant';

/**
 * 秒杀落单消费者：抢到资格后由这里异步建单（把慢的 DB 写从抢购热路径上摘掉）。
 * 带重试（attempts=3）+ 幂等（requestId 作为 idempotencyKey），最终失败才回补资格。
 */
@Processor(SECKILL_QUEUE)
export class SeckillProcessor extends WorkerHost {
  constructor(
    private readonly seckillService: SeckillService,
    private readonly orderService: OrderService,
  ) {
    super();
  }

  async process(job: Job<SeckillJobData>) {
    if (job.name !== SECKILL_CREATE_ORDER_JOB) return;
    const data = job.data;
    try {
      const { id } = await this.orderService.createSeckillOrder({
        userId: data.userId,
        skuId: data.skuId,
        activityId: data.activityId,
        price: data.price,
        quantity: data.quantity,
        idempotencyKey: data.requestId,
      });
      await this.seckillService.markSuccess(data.requestId, id);
    } catch (e) {
      // 幂等自愈：若订单其实已创建（如 markSuccess 前一步失败），补记成功而不是误退款
      const existing = await this.orderService.findOrderByRequestId(data.requestId);
      if (existing) {
        await this.seckillService.markSuccess(data.requestId, existing.id);
        return;
      }
      // 仅最后一次尝试失败才回补资格 + 记失败；否则重抛触发 BullMQ 重试
      const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1) - 1;
      if (isLastAttempt) {
        await this.seckillService.refundQuota(data.activityId, data.skuId, data.userId);
        await this.seckillService.markFail(data.requestId, (e as Error).message ?? '抢购失败');
      }
      throw e;
    }
  }
}
