import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { UserJwtAuthGuard } from '../common/guards/user-jwt-auth.guard';
import { CurrentUser, UserContext } from '../common/decorators/current-user.decorator';
import { OrderService } from './order.service';
import { CreateOrderDto, ListOrderDto } from './dto/order.dto';

@UseGuards(UserJwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateOrderDto) {
    return this.orderService.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: UserContext, @Query() query: ListOrderDto) {
    return this.orderService.list(user.id, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: UserContext, @Param('id', ParseIntPipe) id: number) {
    return this.orderService.detail(user.id, id);
  }

  @Post(':id/pay')
  pay(@CurrentUser() user: UserContext, @Param('id', ParseIntPipe) id: number) {
    return this.orderService.pay(user.id, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: UserContext, @Param('id', ParseIntPipe) id: number) {
    return this.orderService.cancel(user.id, id);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: UserContext, @Param('id', ParseIntPipe) id: number) {
    return this.orderService.confirm(user.id, id);
  }
}
