import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { UserJwtAuthGuard } from '../common/guards/user-jwt-auth.guard';
import { CurrentUser, UserContext } from '../common/decorators/current-user.decorator';
import { CouponService } from './coupon.service';

/** 商城端优惠券：领券中心（公开）+ 我的券/领券（需登录） */
@Controller('coupons')
export class StoreCouponController {
  constructor(private readonly couponService: CouponService) {}

  @Get()
  storeList() {
    return this.couponService.storeList();
  }

  @UseGuards(UserJwtAuthGuard)
  @Get('mine')
  mine(@CurrentUser() user: UserContext) {
    return this.couponService.mine(user.id);
  }

  @UseGuards(UserJwtAuthGuard)
  @Post(':id/receive')
  receive(@CurrentUser() user: UserContext, @Param('id', ParseIntPipe) id: number) {
    return this.couponService.receive(user.id, id);
  }
}
