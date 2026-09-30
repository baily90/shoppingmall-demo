import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PaymentResult, PaymentService } from './payment.service';

/**
 * Mock 支付：同步返回成功，不接入真实渠道。
 * 后续接入微信/支付宝时，新增实现类并在 payment.module.ts 里替换 PAYMENT_SERVICE 的 provide 即可。
 */
@Injectable()
export class MockPaymentService implements PaymentService {
  async createPayment(orderNo: string, _amount: number): Promise<PaymentResult> {
    return { transactionId: `MOCK-${orderNo}-${Date.now()}-${randomUUID().slice(0, 6)}` };
  }
}
