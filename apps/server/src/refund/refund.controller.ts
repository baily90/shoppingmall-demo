import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { UserJwtAuthGuard } from '../common/guards/user-jwt-auth.guard';
import { CurrentUser, UserContext } from '../common/decorators/current-user.decorator';
import { RefundService } from './refund.service';
import { ApplyRefundDto, ShipBackDto } from './dto/refund.dto';

@UseGuards(UserJwtAuthGuard)
@Controller('refunds')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Post()
  apply(@CurrentUser() user: UserContext, @Body() dto: ApplyRefundDto) {
    return this.refundService.apply(user.id, dto);
  }

  @Get()
  mine(@CurrentUser() user: UserContext) {
    return this.refundService.mine(user.id);
  }

  @Get(':id')
  detail(@CurrentUser() user: UserContext, @Param('id', ParseIntPipe) id: number) {
    return this.refundService.detail(user.id, id);
  }

  @Post(':id/ship-back')
  shipBack(
    @CurrentUser() user: UserContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ShipBackDto,
  ) {
    return this.refundService.shipBack(user.id, id, dto);
  }
}
