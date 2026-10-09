/** 售后单类型（RefundOrder.type） */
export const RefundType = {
  REFUND_ONLY: 1, // 仅退款（已支付未发货）
  RETURN_REFUND: 2, // 退货退款（已发货）
} as const;

/**
 * 售后状态机（RefundOrder.status）
 *   仅退款：  10 → 40（同意即退款）/ 90（拒绝）
 *   退货退款：10 → 20（同意待退货）→ 30（已退货待收货）→ 40（确认收货退款）/ 90（拒绝）
 */
export const RefundStatus = {
  PENDING_REVIEW: 10, // 待商家审核
  APPROVED_WAIT_RETURN: 20, // 已同意，待买家退货（仅退货退款）
  RETURNED_WAIT_RECEIVE: 30, // 已退货，待商家收货（仅退货退款）
  REFUNDED: 40, // 退款成功
  REJECTED: 90, // 已拒绝
} as const;

/** 进行中的售后状态（用于「一单同时只允许一笔售后」的部分唯一索引） */
export const ACTIVE_REFUND_STATUSES = [
  RefundStatus.PENDING_REVIEW,
  RefundStatus.APPROVED_WAIT_RETURN,
  RefundStatus.RETURNED_WAIT_RECEIVE,
];
