/** 订单状态机（Order.status） */
export const OrderStatus = {
  PENDING_PAYMENT: 10, // 待支付
  PAID: 20, // 已支付（待发货）
  SHIPPED: 30, // 已发货
  COMPLETED: 40, // 已完成
  CANCELED: 50, // 已取消
} as const;

/** 支付渠道（Payment.channel） */
export const PaymentChannel = {
  MOCK: 1, // mock 支付
} as const;

/** 支付状态（Payment.status） */
export const PaymentStatus = {
  PENDING: 1, // 待支付
  PAID: 2, // 已支付
} as const;
