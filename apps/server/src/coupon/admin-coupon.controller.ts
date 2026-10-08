import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtAuthGuard } from '../common/guards/admin-jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CouponService } from './coupon.service';
import { CreateCouponDto, ListCouponDto, UpdateCouponDto } from './dto/coupon.dto';

@UseGuards(AdminJwtAuthGuard, PermissionsGuard)
@Controller('admin/coupons')
export class AdminCouponController {
  constructor(private readonly couponService: CouponService) {}

  @Get()
  @Permissions('coupon:list')
  list(@Query() query: ListCouponDto) {
    return this.couponService.adminList(query);
  }

  @Get(':id')
  @Permissions('coupon:list')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.couponService.adminDetail(id);
  }

  @Post()
  @Permissions('coupon:create')
  create(@Body() dto: CreateCouponDto) {
    return this.couponService.create(dto);
  }

  @Patch(':id')
  @Permissions('coupon:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCouponDto) {
    return this.couponService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('coupon:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.couponService.remove(id);
  }
}
