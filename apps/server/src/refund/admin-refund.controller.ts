import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../common/guards/admin-jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RefundService } from './refund.service';
import { ListRefundDto, ReviewRefundDto } from './dto/refund.dto';

@UseGuards(AdminJwtAuthGuard, PermissionsGuard)
@Controller('admin/refunds')
export class AdminRefundController {
  constructor(private readonly refundService: RefundService) {}

  @Get()
  @Permissions('aftersale:list')
  list(@Query() query: ListRefundDto) {
    return this.refundService.adminList(query);
  }

  @Get(':id')
  @Permissions('aftersale:list')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.refundService.adminDetail(id);
  }

  @Post(':id/review')
  @Permissions('aftersale:review')
  review(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewRefundDto) {
    return this.refundService.review(id, dto);
  }

  @Post(':id/confirm-receipt')
  @Permissions('aftersale:review')
  confirmReceipt(@Param('id', ParseIntPipe) id: number) {
    return this.refundService.confirmReceipt(id);
  }
}
