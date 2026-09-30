import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { OrderService } from './order.service';
import { AUTO_CANCEL_JOB, ORDER_QUEUE } from './order.constant';

/**
 * 订单队列消费者：处理延迟任务（目前只有「到点自动取消」）。
 * 下单时塞入一个 delay=超时时长 的任务，到点后由这里消费并取消未支付的订单。
 */
@Processor(ORDER_QUEUE)
export class OrderProcessor extends WorkerHost {
  constructor(private readonly orderService: OrderService) {
    super();
  }

  async process(job: Job<{ orderId: number }>) {
    if (job.name === AUTO_CANCEL_JOB) {
      // cancelPendingOrder 自带幂等校验，用户已支付/已取消时不会误伤
      await this.orderService.cancelPendingOrder(job.data.orderId);
    }
  }
}
