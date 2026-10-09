/** 订单状态机（Order.status） */
export const OrderStatus = {
  PENDING_PAYMENT: 10, // 待支付
  PAID: 20, // 已支付（待发货）
  SHIPPED: 30, // 已发货
  COMPLETED: 40, // 已完成
  CANCELED: 50, // 已取消
  REFUNDED: 60, // 已退款（售后退款成功）
} as const;

/** 订单队列名（BullMQ） */
export const ORDER_QUEUE = 'order-queue';

/** 自动取消任务名（延迟任务：到点未支付则取消订单） */
export const AUTO_CANCEL_JOB = 'auto-cancel';

/** 待支付超时自动取消：默认 15 分钟，可用环境变量 ORDER_PAY_TIMEOUT_SECONDS 覆盖（便于联调） */
export const DEFAULT_PAY_TIMEOUT_SECONDS = 15 * 60;

/** 支付渠道（Payment.channel） */
export const PaymentChannel = {
  MOCK: 1, // mock 支付
} as const;

/** 支付状态（Payment.status） */
export const PaymentStatus = {
  PENDING: 1, // 待支付
  PAID: 2, // 已支付
} as const;
