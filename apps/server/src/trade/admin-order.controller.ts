import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../common/guards/admin-jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { OrderService } from './order.service';
import { ListOrderDto, ShipOrderDto } from './dto/order.dto';

@UseGuards(AdminJwtAuthGuard, PermissionsGuard)
@Controller('admin/orders')
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @Permissions('order:list')
  list(@Query() query: ListOrderDto) {
    return this.orderService.adminList(query);
  }

  @Get(':id')
  @Permissions('order:list')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.adminDetail(id);
  }

  @Post(':id/ship')
  @Permissions('order:ship')
  ship(@Param('id', ParseIntPipe) id: number, @Body() dto: ShipOrderDto) {
    return this.orderService.ship(id, dto);
  }
}
