import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { ORDER_QUEUE } from './trade/order.constant';

const BOARD_PORT = 3001;

/**
 * Bull Board 队列可视化面板：独立端口 3001，方便查看队列里的任务。
 * 只读地连上同一个 Redis，展示 order-queue 的延迟/等待/完成/失败任务。
 */
export function startQueueBoard() {
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = Number(process.env.REDIS_PORT ?? 6379);

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/');

  const orderQueue = new Queue(ORDER_QUEUE, {
    connection: { host, port },
  });

  createBullBoard({
    queues: [new BullMQAdapter(orderQueue)],
    serverAdapter,
  });

  const app = serverAdapter.getRouter();
  app.listen(BOARD_PORT, () => {
    console.log(`Bull Board 队列面板: http://localhost:${BOARD_PORT}`);
  });
}
