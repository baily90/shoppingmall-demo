/**
 * 支付适配层接口：MVP 用 MockPaymentService，后续可换真实支付。
 * 调用方通过 PAYMENT_SERVICE 抽象注入，不感知底层渠道。
 */
export interface PaymentResult {
  /** 渠道流水号（第三方支付返回，mock 下为伪造值） */
  transactionId: string;
}

export interface PaymentService {
  /** 发起支付，返回支付结果（含渠道流水号） */
  createPayment(orderNo: string, amount: number): Promise<PaymentResult>;
}

export const PAYMENT_SERVICE = 'PAYMENT_SERVICE';
