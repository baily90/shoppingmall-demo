import { Module } from '@nestjs/common';
import { MockPaymentService } from './mock-payment.service';
import { PAYMENT_SERVICE } from './payment.service';

/**
 * 支付模块：对外只暴露 PAYMENT_SERVICE 抽象，调用方不关心底层是 Mock 还是真实渠道（仿 storage.module.ts）。
 */
@Module({
  providers: [MockPaymentService, { provide: PAYMENT_SERVICE, useExisting: MockPaymentService }],
  exports: [PAYMENT_SERVICE],
})
export class PaymentModule {}
