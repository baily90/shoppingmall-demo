import { Module } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { AdminCouponController } from './admin-coupon.controller';
import { StoreCouponController } from './store-coupon.controller';

@Module({
  controllers: [AdminCouponController, StoreCouponController],
  providers: [CouponService],
  // 导出给 TradeModule：订单事务里调用 useInOrder / refundInCancel
  exports: [CouponService],
})
export class CouponModule {}
