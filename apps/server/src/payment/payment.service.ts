/**
 * 支付适配层接口：MVP 用 MockPaymentService，后续可换真实支付。
 * 调用方通过 PAYMENT_SERVICE 抽象注入，不感知底层渠道。
 */
export interface PaymentResult {
  /** 渠道流水号（第三方支付返回，mock 下为伪造值） */
  transactionId: string;
}

export interface RefundResult {
  /** 渠道退款流水号（第三方返回，mock 下为伪造值） */
  refundTransactionId: string;
}

export interface PaymentService {
  /** 发起支付，返回支付结果（含渠道流水号） */
  createPayment(orderNo: string, amount: number): Promise<PaymentResult>;

  /** 发起退款（refundNo 作为渠道幂等键，重复调用按同一笔退款处理） */
  refund(orderNo: string, refundNo: string, amount: number): Promise<RefundResult>;
}

export const PAYMENT_SERVICE = 'PAYMENT_SERVICE';
