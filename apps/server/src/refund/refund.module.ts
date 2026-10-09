import { Module } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { RefundController } from './refund.controller';
import { AdminRefundController } from './admin-refund.controller';
import { RefundService } from './refund.service';

@Module({
  imports: [PaymentModule], // 退款走支付抽象层（PAYMENT_SERVICE）
  controllers: [RefundController, AdminRefundController],
  providers: [RefundService],
  exports: [RefundService],
})
export class RefundModule {}
