/**
 * 支付适配层接口：MVP 用 MockPaymentService，后续可换真实支付
 * 具体实现（MockPaymentService）在阶段 3 交易闭环时落地。
 */
export interface PaymentService {
  /** 发起支付，返回支付信息（含支付流水号） */
  createPayment(orderId: number, userId: number, amount: number): Promise<unknown>;

  /** 查询支付状态 */
  queryPayment(paymentNo: string): Promise<unknown>;
}

export const PAYMENT_SERVICE = 'PAYMENT_SERVICE';
